// VerifyView.jsx
// React component implementing document verification forensics for low-literacy users.
// Analyzes certificates, ID cards, and school letters to determine digital alterations or AI generation.
// It integrates client-side image signal extractors (ELA, FFT, Noise Consistency, OpenCV line detection)
// and leverages the local model to produce clean summaries translated into Hausa, English, or Pidgin.

import { TRANSLATIONS } from '../utils/translations'
import { useState, useCallback, useRef } from 'react'
import { useGeminiAPI } from '../hooks/useGeminiAPI'
import { useTTS } from '../hooks/useTTS'
import { DocumentUploader } from './DocumentUploader'
import { makeReport } from '../utils/verdict'
import { translate } from '../hooks/useLocalAI'
import {
  performELA,
  performFFTCheck,
  performNoiseConsistency,
  performOpenCVForensics,
  parseJPEGQuantization
} from '../utils/forensics'

export function VerifyView({ lang = 'ha' }) {
  // Pull language-specific translations (defaulting to Hausa)
  const t = TRANSLATIONS[lang] || TRANSLATIONS.ha;

  const [doc, setDoc] = useState(null)
  const [forensicSignals, setForensicSignals] = useState(null)
  const [report, setReport] = useState(null)
  const [stage, setStage] = useState('upload') // upload | processing | results
  const [loadingMsg, setLoadingMsg] = useState('')
  const [expandedSections, setExpandedSections] = useState({})

  const { call, loading } = useGeminiAPI()
  const { speak } = useTTS()
  const imageRef = useRef(null)

  // Accordion controller for the detailed signals report
  const toggleSection = (index) => {
    setExpandedSections(prev => ({ ...prev, [index]: !prev[index] }))
  }

  const handleDocumentSelected = useCallback((extractedData) => {
    setDoc(extractedData)
    setForensicSignals(null)
    setReport(null)
    setStage('upload')
  }, [])

  /**
   * Executes the pipeline:
   * 1. Renders selected image onto a hidden canvas.
   * 2. Runs classical image metrics client-side (ELA, FFT, local variance, text alignments).
   * 3. Queries the local model via system and user prompts passing raw metrics.
   * 4. Converts the response JSON to a user-friendly report and reads out the summary aloud.
   */
  const runAnalysis = useCallback(async () => {
    if (!doc) return
    setStage('processing')
    setLoadingMsg(t.verifyProcessingDesc)

    try {
      // 1. Create a dynamic image element from base64
      const img = new Image()
      img.src = `data:${doc.mimeType || 'image/jpeg'};base64,${doc.base64}`

      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = () => reject(new Error('Failed to render document image on canvas'))
      })

      // 2. Perform Client-Side classical image forensic extraction
      setLoadingMsg(t.verifyProcessingDesc)
      const elaResult = await performELA(img, 0.85)

      setLoadingMsg(t.verifyProcessingDesc)
      const fftResult = await performFFTCheck(img)

      setLoadingMsg(t.verifyProcessingDesc)
      const noiseResult = await performNoiseConsistency(img)

      setLoadingMsg(t.verifyProcessingDesc)
      const opencvResult = await performOpenCVForensics(img)

      setLoadingMsg(t.verifyProcessingDesc)
      const dqtResult = await parseJPEGQuantization(doc.file)

      // Package everything in a single payload
      const signals = {
        ela: { score: elaResult.score, heatmapDataUrl: elaResult.heatmapDataUrl },
        fft: fftResult,
        noiseConsistency: noiseResult,
        textLineAlignment: {
          detectedCount: opencvResult.textLinesDetectedCount || 0,
          baselineYVariance: opencvResult.textLineBaselineYVariance || 0,
          verticalSpacingVariance: opencvResult.textLineVerticalSpacingVariance || 0
        },
        stampIsolation: {
          detectedCount: opencvResult.detectedStampRegionsCount || 0,
          regions: opencvResult.stampRegionsList || []
        },
        recompressionEstimate: dqtResult
      }

      setForensicSignals(signals)

      // 3. Request LLM Report from the local model
      setLoadingMsg(t.verifyProcessingDesc)
      const reportResponse = await makeReport({ signals, call, translate, lang })

      setReport(reportResponse)
      setStage('results')

      // Use Text-to-Speech to read results to low-literacy users
      if (reportResponse.summary) {
        speak(reportResponse.summary)
      }
    } catch (err) {
      console.error(err)
      alert('The check could not be completed. Please try again.')
      setStage('upload')
    }
  }, [doc, call, speak, lang, t])

  const reset = () => {
    setDoc(null)
    setForensicSignals(null)
    setReport(null)
    setStage('upload')
    setLoadingMsg('')
  }

  // --- UPLOAD VIEW ---
  if (stage === 'upload') {
    return (
      <div className="space-y-6 animate-fade-up">
        <div>
          <h2 className="font-display text-2xl font-bold text-paper mb-1">{t.verifyTitle}</h2>
          <p className="text-white/50 text-sm">{t.verifyDesc}</p>
        </div>

        <DocumentUploader
          label={t.verifyUploader}
          accept="image/*"
          onExtracted={handleDocumentSelected}
        />

        {doc && (
          <div className="space-y-4 animate-fade-up">
            <div className="relative aspect-[3/4] max-h-72 rounded-2xl overflow-hidden border border-white/10 bg-white/5 mx-auto">
              <img
                src={`data:${doc.mimeType || 'image/jpeg'};base64,${doc.base64}`}
                alt="Uploaded document thumbnail"
                className="w-full h-full object-contain"
              />
            </div>

            <button onClick={runAnalysis} className="btn-primary w-full text-lg py-4">
              {t.verifyAnalysisBtn}
            </button>
          </div>
        )}
      </div>
    )
  }

  // --- LOADING/PROCESSING VIEW ---
  if (stage === 'processing') {
    return (
      <div className="flex flex-col items-center gap-6 py-16 text-center animate-fade-up">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border-4 border-amber/20"/>
          <div className="absolute inset-0 rounded-full border-4 border-t-amber animate-spin"/>
          <span className="absolute inset-0 flex items-center justify-center text-2xl" aria-hidden="true">🛡️</span>
        </div>
        <div>
          <h2 className="font-display text-xl font-bold">{t.verifyProcessingTitle}</h2>
          <p className="text-white/40 text-sm mt-1">{loadingMsg || t.verifyProcessingDesc}</p>
        </div>
      </div>
    )
  }

  // Map classification categories to visual severity indicators
  const classificationColors = {
    'genuine': 'border-teal/30 bg-teal/5 text-teal-light',
    'edited-genuine': 'border-amber/30 bg-amber/5 text-amber',
    'AI-generated': 'border-purple-500/30 bg-purple-500/5 text-purple-400',
    're-shared-copy': 'border-blue-500/30 bg-blue-500/5 text-blue-400',
    'fabricated-from-scratch': 'border-red-500/30 bg-red-500/5 text-red-400'
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold">{t.verifyResultsTitle}</h2>
        <button onClick={reset} className="text-white/30 text-xs hover:text-white/60">{t.verifyStartNew}</button>
      </div>

      {report && (
        <>
          {/* Verdict Box */}
          <div className={`card p-5 border-2 ${classificationColors[report.classification] || 'border-amber/20 bg-amber/5'} space-y-3`}>
            <div className="flex items-center justify-between">
              <span className="text-white/40 text-xs uppercase tracking-widest">{t.verifyClassification}</span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 font-semibold font-mono">
                {t.verifyConfidence}: {report.confidenceScore}%
              </span>
            </div>
            <p className="text-2xl font-display font-black capitalize leading-none">
              {report.classification?.replace(/-/g, ' ')}
            </p>
            <p className="text-paper text-sm leading-relaxed">{report.summary}</p>
            {report.recommendation && (
              <div className="pt-2 border-t border-white/5 text-xs font-medium">
                💡 {report.recommendation}
              </div>
            )}
          </div>

          {/* Canvas ELA Heatmap Preview */}
          {forensicSignals?.ela?.heatmapDataUrl && (
            <div className="card p-4 space-y-2">
              <p className="font-display font-bold text-sm text-paper/80">{t.verifyHeatmapTitle}</p>
              <div className="relative aspect-[3/4] max-h-72 rounded-xl overflow-hidden border border-white/10 bg-black">
                <img
                  src={forensicSignals.ela.heatmapDataUrl}
                  alt="Error level analysis heatmap"
                  className="w-full h-full object-contain"
                />
              </div>
              <p className="text-white/40 text-[11px] leading-snug">
                {t.verifyHeatmapDesc}
              </p>
            </div>
          )}

          {/* Section Breakdowns */}
          <div className="space-y-3">
            <h3 className="font-display font-semibold text-paper/80">{t.verifySignalsTitle}</h3>
            {report.sections?.map((section, idx) => {
              const isExpanded = !!expandedSections[idx];
              return (
                <div key={idx} className="card overflow-hidden">
                  <button
                    onClick={() => toggleSection(idx)}
                    className="w-full flex items-center justify-between p-4 text-left font-display font-semibold text-sm hover:bg-white/5 transition-colors"
                  >
                    <span>{section.title}</span>
                    <span className="text-white/30 text-xs">{isExpanded ? 'Collapse ▲' : 'Expand ▼'}</span>
                  </button>
                  {isExpanded && (
                    <div className="p-4 pt-0 border-t border-white/5 bg-white/[0.01] space-y-2 animate-fade-down">
                      <p className="text-paper/90 text-sm leading-relaxed">{section.finding}</p>
                      {section.implication && (
                        <p className="text-white/40 text-xs italic">🔍 {section.implication}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
