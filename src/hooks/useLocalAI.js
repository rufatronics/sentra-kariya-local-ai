import { useState, useCallback } from 'react'

const LLM_ID = 'Llama-3.2-1B-Instruct-q4f16_1-MLC'
const NLLB_ID = 'Xenova/nllb-200-distilled-600M'
const CODES = { en: 'eng_Latn', ha: 'hau_Latn', yo: 'yor_Latn', ig: 'ibo_Latn' }

let enginePromise = null
let translatorPromise = null
const listeners = new Set()
const status = { llm: 'idle', nllb: 'idle', progress: '', gpu: null }
const emit = () => listeners.forEach(f => f({ ...status }))

export function subscribeStatus(fn) {
  listeners.add(fn)
  fn({ ...status })
  return () => listeners.delete(fn)
}

export async function checkWebGPU() {
  let r
  if (!('gpu' in navigator)) r = { ok: false, reason: 'This browser has no WebGPU. Local Llama needs a WebGPU-compatible device, so the app uses rule-based checks only.' }
  else {
    try {
      const ad = await navigator.gpu.requestAdapter()
      r = ad ? { ok: true, reason: '' } : { ok: false, reason: 'WebGPU is present but no usable graphics adapter was found. Local Llama is off; the app uses rule-based checks only.' }
    } catch { r = { ok: false, reason: 'WebGPU could not start on this device. Local Llama is off; the app uses rule-based checks only.' } }
  }
  status.gpu = r; emit()
  return r
}

export function loadLLM() {
  if (!enginePromise) {
    enginePromise = (async () => {
      const g = await checkWebGPU()
      if (!g.ok) { status.llm = 'unavailable'; emit(); throw new Error(g.reason) }
      status.llm = 'loading'; emit()
      const { CreateMLCEngine } = await import('@mlc-ai/web-llm')
      const engine = await CreateMLCEngine(LLM_ID, {
        initProgressCallback: r => { status.progress = r.text; emit() }
      })
      status.llm = 'ready'; emit()
      return engine
    })().catch(e => {
      enginePromise = null
      if (status.llm !== 'unavailable') status.llm = 'error'
      emit()
      throw e
    })
  }
  return enginePromise
}

export function loadTranslator() {
  if (!translatorPromise) {
    status.nllb = 'loading'; emit()
    translatorPromise = (async () => {
      const { pipeline, env } = await import('@huggingface/transformers')
      env.allowLocalModels = false
      env.backends.onnx.wasm.wasmPaths = '/ort/'
      const last = {}
      return pipeline('translation', NLLB_ID, {
        dtype: 'q8',
        device: 'wasm',
        progress_callback: p => {
          if (!p.file) return
          const n = Math.floor(p.progress || 0)
          if (last[p.file] === n) return
          last[p.file] = n
          status.progress = `Downloading translation model: ${n}%`; emit()
        }
      })
    })().then(t => { status.nllb = 'ready'; emit(); return t })
      .catch(e => { translatorPromise = null; status.nllb = 'error'; emit(); throw e })
  }
  return translatorPromise
}

const splitSentences = t => t.split(/(?<=[.?!])\s+|\n+/).map(x => x.trim()).filter(Boolean)

export async function translate(text, from, to) {
  if (from === to || from === 'pcm' || to === 'pcm') return text
  if (!CODES[from] || !CODES[to]) return text
  const t = await loadTranslator()
  const one = async str => {
    const parts = splitSentences(str)
    if (!parts.length) return str
    const out = []
    for (const p of parts) {
      const r = await t(p, { src_lang: CODES[from], tgt_lang: CODES[to] })
      out.push(r[0].translation_text)
    }
    return out.join(' ')
  }
  if (!Array.isArray(text)) return one(text)
  const res = []
  for (const x of text) res.push(await one(x))
  return res
}

function buildMessages(systemPrompt, userPrompt, history = []) {
  const m = []
  if (systemPrompt) m.push({ role: 'system', content: systemPrompt })
  for (const h of history.slice(-4)) m.push({ role: h.role === 'model' ? 'assistant' : h.role, content: h.content })
  m.push({ role: 'user', content: userPrompt })
  return m
}

function parseJSON(text) {
  const clean = text.replace(/```(?:json)?\s*/gi, '').replace(/```\s*$/g, '').trim()
  const a = clean.indexOf('{'), b = clean.lastIndexOf('}')
  try { return JSON.parse(a >= 0 ? clean.slice(a, b + 1) : clean) } catch { return null }
}

export function useLocalAI() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [streamText, setStreamText] = useState('')

  const call = useCallback(async ({ systemPrompt, userPrompt, history = [], temperature = 0.2, maxTokens = 256 }) => {
    setLoading(true); setError(null)
    try {
      const engine = await loadLLM()
      const r = await engine.chat.completions.create({
        messages: buildMessages(systemPrompt, userPrompt, history),
        temperature, max_tokens: maxTokens
      })
      const text = r.choices[0]?.message?.content?.trim()
      if (!text) throw new Error('Empty response')
      return { text }
    } catch (e) { setError(e.message); throw e } finally { setLoading(false) }
  }, [])

  const stream = useCallback(async ({ systemPrompt, userPrompt, history = [], temperature = 0.3, maxTokens = 256, onChunk = null }) => {
    setLoading(true); setError(null); setStreamText('')
    try {
      const engine = await loadLLM()
      const it = await engine.chat.completions.create({
        messages: buildMessages(systemPrompt, userPrompt, history),
        temperature, max_tokens: maxTokens, stream: true
      })
      let full = ''
      for await (const c of it) {
        const d = c.choices[0]?.delta?.content || ''
        if (d) { full += d; setStreamText(full); onChunk && onChunk(d, full) }
      }
      return full
    } catch (e) { setError(e.message); throw e } finally { setLoading(false) }
  }, [])

  const callJSON = useCallback(async opts => {
    const { text } = await call({ ...opts, temperature: 0.1, maxTokens: opts.maxTokens || 400 })
    const parsed = parseJSON(text)
    if (!parsed) throw new Error('Model did not return valid JSON')
    return parsed
  }, [])

  return { call, stream, callJSON, loading, error, streamText, provider: 'local' }
}
