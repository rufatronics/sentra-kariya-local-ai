import { useState, useEffect } from 'react'
import { subscribeStatus, checkWebGPU, getSetup, saveSetup, loadLLM, loadTranslator } from '../hooks/useLocalAI'

function Bar({ pct, state }) {
  if (state === 'idle') return null
  return (
    <div className="mt-2">
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className={`h-full ${state === 'error' ? 'bg-red-400' : 'bg-teal'} transition-all`} style={{ width: `${state === 'error' ? 100 : pct}%` }} />
      </div>
      <p className="text-[11px] text-white/40 mt-1">{state === 'ready' ? 'Ready' : state === 'error' ? 'Failed' : `${pct}%`}</p>
    </div>
  )
}

export function SetupScreen({ onDone, manage = false }) {
  const saved = getSetup()
  const [gpu, setGpu] = useState(null)
  const [sel, setSel] = useState({ llm: saved ? saved.llm : true, nllb: saved ? saved.nllb : true })
  const [phase, setPhase] = useState(saved && !manage ? 'loading' : 'choose')
  const [errs, setErrs] = useState({})
  const [s, setS] = useState({ llm: 'idle', nllb: 'idle', llmPct: 0, nllbPct: 0 })

  useEffect(() => subscribeStatus(setS), [])
  useEffect(() => {
    checkWebGPU().then(g => { setGpu(g); if (!g.ok) setSel(v => ({ ...v, llm: false })) })
    if (saved && !manage) start({ llm: saved.llm, nllb: saved.nllb })
  }, [])

  async function start(choice) {
    saveSetup(choice)
    setErrs({}); setPhase('loading')
    const e = {}
    if (choice.llm) { try { await loadLLM() } catch (x) { console.error(x); e.llm = x.message } }
    if (choice.nllb) { try { await loadTranslator() } catch (x) { console.error(x); e.nllb = x.message } }
    setErrs(e)
    if (!e.llm && !e.nllb) onDone()
  }

  const skip = () => { saveSetup({ llm: false, nllb: false }); onDone() }
  const hasErr = errs.llm || errs.nllb
  const gpuBad = gpu && !gpu.ok

  return (
    <div className="min-h-dvh max-w-lg mx-auto bg-ink text-paper px-5 py-8 flex flex-col">
      <h1 className="font-display font-black text-2xl">Welcome</h1>
      <p className="text-white/50 text-sm mt-1">Set up on-device AI. It downloads once, then works offline and nothing leaves your device. Wi-Fi is recommended.</p>

      <div className="mt-6 space-y-3">
        <label className={`block rounded-xl border border-white/10 p-4 ${gpuBad ? 'opacity-50' : ''}`}>
          <div className="flex items-start gap-3">
            <input type="checkbox" className="mt-1" checked={sel.llm} disabled={gpuBad || phase === 'loading'} onChange={e => setSel({ ...sel, llm: e.target.checked })} />
            <div className="flex-1">
              <p className="font-bold">Llama 3.2 1B <span className="text-white/40 font-normal">· about 1 GB</span></p>
              <p className="text-white/50 text-xs mt-0.5">Writes plain-language explanations of results. Needs a WebGPU-compatible device.</p>
              {gpuBad && <p className="text-amber text-xs mt-1">{gpu.reason}</p>}
              {phase === 'loading' && sel.llm && <Bar pct={s.llmPct} state={errs.llm ? 'error' : s.llm === 'ready' ? 'ready' : 'loading'} />}
              {errs.llm && <p className="text-red-300 text-xs mt-1">Could not load the AI model. {errs.llm}</p>}
            </div>
          </div>
        </label>

        <label className="block rounded-xl border border-white/10 p-4">
          <div className="flex items-start gap-3">
            <input type="checkbox" className="mt-1" checked={sel.nllb} disabled={phase === 'loading'} onChange={e => setSel({ ...sel, nllb: e.target.checked })} />
            <div className="flex-1">
              <p className="font-bold">Translation (NLLB) <span className="text-white/40 font-normal">· about 0.6 GB</span></p>
              <p className="text-white/50 text-xs mt-0.5">Translates results into Hausa, Yoruba and Igbo. Optional: without it, results show in English.</p>
              {phase === 'loading' && sel.nllb && <Bar pct={s.nllbPct} state={errs.nllb ? 'error' : s.nllb === 'ready' ? 'ready' : 'loading'} />}
              {errs.nllb && <p className="text-red-300 text-xs mt-1">Could not load translation. {errs.nllb}</p>}
            </div>
          </div>
        </label>
      </div>

      <p className="text-white/40 text-xs mt-4">Skipping a model keeps basic mode: document forensics and rule-based checks still work.</p>

      <div className="mt-auto pt-6 space-y-2">
        {phase === 'choose' && (
          <>
            <button type="button" className="w-full rounded-xl bg-amber text-ink font-bold py-3"
              onClick={() => (sel.llm || sel.nllb) ? start(sel) : skip()}>
              {sel.llm || sel.nllb ? 'Download and continue' : 'Continue in basic mode'}
            </button>
            {(sel.llm || sel.nllb) && <button type="button" className="w-full rounded-xl border border-white/10 py-3 text-white/70" onClick={skip}>Skip for now</button>}
            {manage && <button type="button" className="w-full py-2 text-white/40 text-sm" onClick={onDone}>Close</button>}
          </>
        )}
        {phase === 'loading' && !hasErr && <p className="text-center text-white/50 text-sm">Preparing… keep this page open.</p>}
        {phase === 'loading' && hasErr && (
          <>
            <button type="button" className="w-full rounded-xl bg-amber text-ink font-bold py-3" onClick={() => start(sel)}>Retry</button>
            <button type="button" className="w-full rounded-xl border border-white/10 py-3 text-white/70" onClick={skip}>Continue in basic mode</button>
          </>
        )}
      </div>
    </div>
  )
}
