// ScamCheckView.jsx
// React component supporting scam and SMS fraud checks tailored for Nigerian phone and job scam contexts.
// Parses pasted/spoken SMS messages, parses URLs and domain risk metrics, and uses Gemma 4
// to output a structured safety report available in Hausa, English, or Pidgin English.

import { TRANSLATIONS } from '../utils/translations'
import { useState, useCallback } from 'react'
import { useGeminiAPI } from '../hooks/useGeminiAPI'
import { useTTS } from '../hooks/useTTS'
import { VoiceInput } from './VoiceInput'
import { extractScamFeatures } from '../utils/scamParser'
import { buildScamCheckPrompt } from '../utils/prompts'

export function ScamCheckView({ lang = 'ha' }) {
  // Bind UI labels dynamically to translations dictionary (defaults to Hausa)
  const t = TRANSLATIONS[lang] || TRANSLATIONS.ha;

  const [inputText, setInputText] = useState('')
  const [report, setReport] = useState(null)
  const [stage, setStage] = useState('input') // input | processing | results
  const [expandedSection, setExpandedSection] = useState('') // flags | links

  const { callJSON, loading } = useGeminiAPI()
  const { speak } = useTTS()

  /**
   * Runs the scam check pipeline:
   * 1. Extracts linguistic metadata and URLs from user's text message.
   * 2. Packages payload and queries Gemma 4.
   * 3. Renders result risk card and reads aloud plain-language summary via TTS.
   */
  const runAnalysis = useCallback(async () => {
    if (!inputText.trim()) return
    setStage('processing')

    try {
      // 1. Run local feature/link extractor
      const scamPayload = extractScamFeatures(inputText)

      // 2. Formulate dynamic localized prompt and query Gemma 4
      const prompt = buildScamCheckPrompt(scamPayload, lang)
      const reportResponse = await callJSON({
        systemPrompt: prompt.systemPrompt,
        userPrompt: prompt.userPrompt,
        useThinking: false,
        temperature: 0.1
      })

      setReport(reportResponse)
      setStage('results')

      // Use Text-to-Speech to read results to user
      if (reportResponse.summary) {
        speak(reportResponse.summary)
      }
    } catch (err) {
      alert(`Scam evaluation failed: ${err.message}`)
      setStage('input')
    }
  }, [inputText, callJSON, speak, lang])

  const reset = () => {
    setInputText('')
    setReport(null)
    setStage('input')
    setExpandedSection('')
  }

  // --- INPUT STAGE ---
  if (stage === 'input') {
    return (
      <div className="space-y-6 animate-fade-up">
        <div>
          <h2 className="font-display text-2xl font-bold text-paper mb-1">{t.scamTitle}</h2>
          <p className="text-white/50 text-sm">{t.scamDesc}</p>
        </div>

        <div className="card p-5 space-y-4">
          <textarea
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder={t.scamPlaceholder}
            className="input-field w-full min-h-36 resize-none"
            aria-label="Message text to analyze"
          />

          <div className="flex justify-center">
            <VoiceInput onResult={setInputText} />
          </div>
        </div>

        <button
          onClick={runAnalysis}
          disabled={!inputText.trim() || loading}
          className="btn-primary w-full text-lg py-4 disabled:opacity-40"
        >
          {t.scamBtn}
        </button>
      </div>
    )
  }

  // --- PROCESSING STAGE ---
  if (stage === 'processing') {
    return (
      <div className="flex flex-col items-center gap-6 py-16 text-center animate-fade-up">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border-4 border-amber/20"/>
          <div className="absolute inset-0 rounded-full border-4 border-t-amber animate-spin"/>
          <span className="absolute inset-0 flex items-center justify-center text-2xl" aria-hidden="true">🎯</span>
        </div>
        <div>
          <h2 className="font-display text-xl font-bold">{t.scamProcessingTitle}</h2>
          <p className="text-white/40 text-sm mt-1">{t.scamProcessingDesc}</p>
        </div>
      </div>
    )
  }

  // Map risk metrics to clear color codes
  const riskColors = {
    low: 'border-teal/30 bg-teal/5 text-teal-light',
    medium: 'border-amber/30 bg-amber/5 text-amber',
    high: 'border-red-500/30 bg-red-500/5 text-red-400'
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold">{t.scamResultsTitle}</h2>
        <button onClick={reset} className="text-white/30 text-xs hover:text-white/60">{t.verifyStartNew}</button>
      </div>

      {report && (
        <>
          {/* Prominent Risk Level Card */}
          <div className={`card p-5 border-2 ${riskColors[report.riskLevel] || 'border-amber/20 bg-amber/5'} space-y-3`}>
            <div className="flex items-center justify-between">
              <span className="text-white/40 text-xs uppercase tracking-widest">{t.scamRisk}</span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 font-semibold font-mono capitalize">
                {report.riskLevel}
              </span>
            </div>
            <p className="text-2xl font-display font-black leading-none uppercase">
              {report.riskLevel === 'high' ? (lang === 'ha' ? 'HADARI MAI GIRMA' : 'HIGH RISK') : report.riskLevel === 'medium' ? (lang === 'ha' ? 'HAdarin Tsaka-Tsaki' : 'MEDIUM RISK') : (lang === 'ha' ? 'HADARI MAI KANKANTA' : 'LOW RISK')}
            </p>
            <p className="text-paper text-sm leading-relaxed">{report.summary}</p>
            {report.recommendation && (
              <div className="pt-2 border-t border-white/5 text-xs font-medium">
                💡 {report.recommendation}
              </div>
            )}
          </div>

          {/* Expandable Section 1: Red flags list */}
          <div className="card overflow-hidden">
            <button
              onClick={() => setExpandedSection(prev => prev === 'flags' ? '' : 'flags')}
              className="w-full flex items-center justify-between p-4 text-left font-display font-semibold text-sm hover:bg-white/5 transition-colors"
            >
              <span className="flex items-center gap-2">
                🚩 {t.scamIndicators} ({report.redFlags?.length || 0})
              </span>
              <span className="text-white/30 text-xs">{expandedSection === 'flags' ? 'Collapse ▲' : 'Expand ▼'}</span>
            </button>
            {expandedSection === 'flags' && (
              <div className="p-4 pt-0 border-t border-white/5 bg-white/[0.01] space-y-3 animate-fade-down">
                {report.redFlags && report.redFlags.length > 0 ? (
                  report.redFlags.map((rf, idx) => (
                    <div key={idx} className="space-y-0.5 text-sm">
                      <p className="font-semibold text-amber capitalize">{rf.flag}</p>
                      <p className="text-white/60 leading-relaxed">{rf.explanation}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-teal-light text-sm italic">{lang === 'ha' ? 'Babu mabuɗan yaudara da aka gano a rubutun.' : 'No specific linguistic scam indicators found.'}</p>
                )}
              </div>
            )}
          </div>

          {/* Expandable Section 2: Specific link checks */}
          <div className="card overflow-hidden">
            <button
              onClick={() => setExpandedSection(prev => prev === 'links' ? '' : 'links')}
              className="w-full flex items-center justify-between p-4 text-left font-display font-semibold text-sm hover:bg-white/5 transition-colors"
            >
              <span className="flex items-center gap-2">
                🔗 {t.scamLinks} ({report.links?.length || 0})
              </span>
              <span className="text-white/30 text-xs">{expandedSection === 'links' ? 'Collapse ▲' : 'Expand ▼'}</span>
            </button>
            {expandedSection === 'links' && (
              <div className="p-4 pt-0 border-t border-white/5 bg-white/[0.01] space-y-3 animate-fade-down">
                {report.links && report.links.length > 0 ? (
                  report.links.map((link, idx) => (
                    <div key={idx} className="p-3 bg-white/5 rounded-xl space-y-1.5 text-sm">
                      <p className="font-mono text-xs text-white/50 truncate break-all">{link.url}</p>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                          link.status === 'flagged' ? 'bg-red-500/20 text-red-400' : 'bg-teal/20 text-teal-light'
                        }`}>
                          {link.status}
                        </span>
                      </div>
                      <p className="text-white/70 leading-relaxed text-xs">{link.reason}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-white/40 text-sm italic">{t.scamNoLinks}</p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
