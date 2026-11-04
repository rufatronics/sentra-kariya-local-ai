// FormFiller.jsx
// React Component supporting low-literacy users in Nigeria to fill official documents.
// Features step-by-step audio/visual questions, localized templates, and vision-based parsing.

import { useState, useEffect, useRef, useCallback } from 'react'
import { useGeminiAPI } from '../hooks/useGeminiAPI'
import { useTTS } from '../hooks/useTTS'
import { useOfflineCache } from '../hooks/useOfflineCache'
import { DocumentUploader } from './DocumentUploader'
import { VoiceInput } from './VoiceInput'
import { ProgressIndicator } from './ProgressIndicator'
import {
  buildFieldExtractionPrompt,
  buildFormQuestionPrompt,
  SYSTEM_PROMPTS
} from '../utils/prompts'
import { validateField, normalizeAnswer } from '../utils/validators'
import { parseFieldsFromResponse } from '../utils/extractFields'
import { TRANSLATIONS } from '../utils/translations'

/**
 * Returns localized templates configured specifically for Nigerian document contexts (NIN, School Admission, Tenancy).
 * Dynamically binds names, labels, and helper prompts to the user's active selected language.
 *
 * @param {string} lang - Active language ID ('ha', 'en', 'pcm')
 * @returns {Array<Object>} Localized templates list
 */
function getLocalizedTemplates(lang) {
  const t = TRANSLATIONS[lang] || TRANSLATIONS.ha; // Defaults to Hausa
  return [
    {
      id: 'nin',
      label: t.tmplNID,
      icon: '🇳🇬',
      fields: [
        { id: 'full_name',      label: t.fieldNINName,       type: 'name',    required: true,  helpText: t.fieldNINNameHelp },
        { id: 'dob',            label: t.fieldNINDob,        type: 'date',    required: true,  helpText: t.fieldNINDobHelp },
        { id: 'phone',          label: t.fieldNINPhone,      type: 'phone',   required: true,  helpText: t.fieldNINPhoneHelp },
        { id: 'state_origin',   label: t.fieldNINState,      type: 'text',    required: true,  helpText: t.fieldNINStateHelp }
      ]
    },
    {
      id: 'admission',
      label: t.tmplAdmission,
      icon: '🏫',
      fields: [
        { id: 'student_name',   label: t.fieldAdmName,       type: 'name',    required: true,  helpText: t.fieldAdmNameHelp },
        { id: 'reg_num',        label: t.fieldAdmReg,        type: 'text',    required: true,  helpText: t.fieldAdmRegHelp },
        { id: 'course',         label: t.fieldAdmCourse,     type: 'text',    required: true,  helpText: t.fieldAdmCourseHelp }
      ]
    },
    {
      id: 'tenancy',
      label: t.tmplTenancy,
      icon: '📜',
      fields: [
        { id: 'tenant_name',    label: t.fieldTenTenant,     type: 'name',    required: true,  helpText: t.fieldTenTenantHelp },
        { id: 'rent_amount',    label: t.fieldTenRent,       type: 'number',  required: true,  helpText: t.fieldTenRentHelp },
        { id: 'witness_name',   label: t.fieldTenWitness,    type: 'text',    required: false, helpText: t.fieldTenWitnessHelp }
      ]
    },
    {
      id: 'custom',
      label: t.tmplCustom,
      icon: '📤',
      fields: null
    }
  ]
}

/**
 * Main form filler engine guiding low-literacy users through complex forms using standard/local templates.
 * Relies on voice inputs, offline caches, and step-by-step progress bars to minimize cognitive load.
 */
export function FormFiller({ onProviderChange, lang = 'ha' }) {
  const t = TRANSLATIONS[lang] || TRANSLATIONS.ha; // Access translations localized dictionary
  const FORM_TEMPLATES = getLocalizedTemplates(lang);

  const [stage, setStage]           = useState('select')
  const [template, setTemplate]     = useState(null)
  const [fields, setFields]         = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers]       = useState({})
  const [currentInput, setCurrentInput] = useState('')
  const [question, setQuestion]     = useState('')
  const [validationMsg, setValidationMsg] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [sessionId]                 = useState(() => `form_${Date.now()}`)

  const { call, callJSON, loading, provider } = useGeminiAPI()
  const { speak, autoRead, toggleAutoRead }   = useTTS()
  const { saveFormProgress }                  = useOfflineCache()
  const inputRef = useRef(null)

  const currentField   = fields[currentIndex]

  // Sync state changes in API provider to App components
  useEffect(() => { onProviderChange?.(provider) }, [provider, onProviderChange])

  // Fetches localized questions step-by-step from Gemma 4 model or defaults back to clear localized placeholders
  const askQuestion = useCallback(async (index, fs, ans) => {
    const field = fs[index]
    if (!field) return

    const previousAnswers = fs.slice(0, index)
      .map(f => ({ label: f.label, value: ans[f.id] || '' }))
      .filter(a => a.value)

    const prompt = buildFormQuestionPrompt(field, previousAnswers)

    try {
      const { text } = await call({
        systemPrompt: SYSTEM_PROMPTS.formHelper,
        userPrompt: `${prompt.userPrompt}\nTranslate this final question to: ${lang === 'ha' ? 'Hausa' : lang === 'pcm' ? 'Nigerian Pidgin' : 'English'}`
      })
      setQuestion(text)
      if (autoRead) speak(text)
    } catch {
      // Fallback text if API is unresponsive
      const fallback = `${lang === 'ha' ? 'Don Allah shigar da' : lang === 'pcm' ? 'Enter your' : 'Please enter your'} ${field.label}.`
      setQuestion(fallback)
      if (autoRead) speak(fallback)
    }
  }, [call, speak, autoRead, lang])

  const startTemplate = useCallback(async (tmpl) => {
    setTemplate(tmpl)
    if (tmpl.fields) {
      setFields(tmpl.fields)
      setStage('filling')
      setCurrentIndex(0)
      setAnswers({})
      askQuestion(0, tmpl.fields, {})
    }
  }, [askQuestion])

  // Handles custom document uploads (vision-based pipeline parsing)
  const handleDocumentExtracted = useCallback(async ({ mode, text, base64, mimeType }) => {
    setExtracting(true)
    try {
      const prompt = buildFieldExtractionPrompt(text || 'Extract all form fields from this image.')

      const { text: rawResponse } = await call({
        systemPrompt: SYSTEM_PROMPTS.formHelper,
        userPrompt: prompt.userPrompt,
        imageBase64: mode === 'image' ? base64 : null,
        mimeType:    mode === 'image' ? mimeType : null,
        maxTokens: 1024,
        temperature: 0.1
      })

      const result = parseFieldsFromResponse(rawResponse)
      const extractedFields = result?.fields || []
      if (extractedFields.length === 0) throw new Error('No fields found.')

      setFields(extractedFields)
      setStage('filling')
      setCurrentIndex(0)
      setAnswers({})
      askQuestion(0, extractedFields, {})
    } catch (err) {
      alert(`Could not read form: ${err.message}`)
    } finally {
      setExtracting(false)
    }
  }, [call, askQuestion])

  // Handles input submissions (validates input formats like Phone/NIN/Date and saves to IDB caches)
  const submitAnswer = useCallback(async (value) => {
    const v = String(value).trim()

    if (!v && currentField?.required) {
      const msg = t.formRequiredError
      setValidationMsg(msg)
      speak(msg)
      return
    }

    if (v) {
      const { valid, error } = validateField(currentField.type, v)
      if (!valid) {
        setValidationMsg(error)
        speak(error)
        return
      }
    }

    setValidationMsg('')
    const normalized = v ? normalizeAnswer(currentField.type, v) : ''
    const newAnswers  = { ...answers, [currentField.id]: normalized }
    setAnswers(newAnswers)
    setCurrentInput('')
    saveFormProgress(sessionId, fields, newAnswers)

    const nextIndex = currentIndex + 1
    if (nextIndex < fields.length) {
      setCurrentIndex(nextIndex)
      askQuestion(nextIndex, fields, newAnswers)
    } else {
      setStage('review')
      speak(lang === 'ha' ? 'An gama! Don Allah duba amsoshinka kafin ka ajiye.' : 'All done! Please review your answers.')
    }
  }, [currentField, answers, currentIndex, fields, sessionId, speak, askQuestion, saveFormProgress, t, lang])

  const goBack = useCallback(() => {
    if (currentIndex > 0) {
      const prev = currentIndex - 1
      setCurrentIndex(prev)
      setCurrentInput(answers[fields[prev]?.id] || '')
      setValidationMsg('')
      askQuestion(prev, fields, answers)
    }
  }, [currentIndex, answers, fields, askQuestion])

  useEffect(() => { inputRef.current?.focus() }, [currentIndex])

  // Stage 1: Selection screen for template lists (Mobile optimized, generous touch targets)
  if (stage === 'select') {
    return (
      <div className="space-y-6 animate-fade-up">
        <div>
          <h2 className="font-display text-2xl font-bold text-paper mb-1">{t.formTitle}</h2>
          <p className="text-white/50 text-sm">{t.formDesc}</p>
        </div>

        <div className="grid gap-3">
          {FORM_TEMPLATES.map(tmpl => (
            <button
              key={tmpl.id}
              onClick={() => tmpl.id === 'custom' ? setTemplate(tmpl) : startTemplate(tmpl)}
              className={`
                flex items-center gap-4 p-4 rounded-2xl text-left border transition-all duration-200
                hover:border-amber/40 hover:bg-amber/5 focus-visible:ring-4 focus-visible:ring-amber/30
                focus-visible:outline-none active:scale-95
                ${template?.id === tmpl.id ? 'border-amber/40 bg-amber/5' : 'border-white/10 bg-white/5'}
              `}
            >
              <span className="text-3xl" aria-hidden="true">{tmpl.icon}</span>
              <div>
                <p className="font-display font-semibold text-paper">{tmpl.label}</p>
                <p className="text-white/40 text-xs mt-0.5">
                  {tmpl.fields ? `${tmpl.fields.length} ${lang === 'ha' ? 'tambayoyi' : lang === 'pcm' ? 'questions' : 'questions'}` : t.formUploadLabel}
                </p>
              </div>
              <svg className="w-4 h-4 text-white/20 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
              </svg>
            </button>
          ))}
        </div>

        {template?.id === 'custom' && (
          <div className="animate-fade-up">
            {extracting ? (
              <div className="flex items-center gap-3 p-4 card">
                <div className="w-6 h-6 border-2 border-amber border-t-transparent rounded-full animate-spin flex-shrink-0"/>
                <p className="text-white/60 text-sm">{t.formReading}</p>
              </div>
            ) : (
              <DocumentUploader label={t.formUploadLabel} onExtracted={handleDocumentExtracted}/>
            )}
          </div>
        )}
      </div>
    )
  }

  // Stage 2: Question-by-question flow
  if (stage === 'filling') {
    return (
      <div className="space-y-6 animate-fade-up">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">{template?.label || 'Document Form'}</h2>
          <button
            onClick={toggleAutoRead}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${autoRead ? 'border-teal/50 text-teal bg-teal/10' : 'border-white/20 text-white/40'}`}
          >
            {autoRead ? t.formSpeechOn : t.formSpeechOff}
          </button>
        </div>

        <ProgressIndicator current={currentIndex} total={fields.length}/>

        <div className="card p-5 space-y-4">
          {loading ? (
            <div className="flex gap-1.5 py-2" aria-live="polite" aria-label="Loading question">
              <span className="typing-dot"/><span className="typing-dot"/><span className="typing-dot"/>
            </div>
          ) : (
            <p className="text-paper text-lg leading-relaxed" aria-live="polite">{question}</p>
          )}

          <div className="flex gap-3">
            <input
              ref={inputRef}
              type={currentField?.type === 'number' ? 'number' : currentField?.type === 'date' ? 'date' : 'text'}
              value={currentInput}
              onChange={e => setCurrentInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitAnswer(currentInput)}
              placeholder={t.formPlaceholder}
              className="input-field flex-1"
              aria-label={currentField?.label}
              disabled={loading}
              autoComplete="off"
            />
            <VoiceInput onResult={text => setCurrentInput(text)} disabled={loading}/>
          </div>

          {validationMsg && <p role="alert" className="text-amber text-sm">{validationMsg}</p>}
          {currentField?.helpText && <p className="text-white/30 text-xs">{currentField.helpText}</p>}
        </div>

        <div className="flex gap-3">
          {currentIndex > 0 && (
            <button onClick={goBack} className="btn-secondary flex-1">{t.formBack}</button>
          )}
          <button onClick={() => submitAnswer(currentInput)} disabled={loading} className="btn-primary flex-1">
            {currentIndex === fields.length - 1 ? t.formReview : t.formNext}
          </button>
        </div>

        {!currentField?.required && (
          <button onClick={() => submitAnswer('')} className="w-full text-white/30 text-sm hover:text-white/50 transition-colors">
            {t.formSkip}
          </button>
        )}
      </div>
    )
  }

  // Stage 3: Summary reviews with editable input triggers
  if (stage === 'review') {
    return (
      <div className="space-y-6 animate-fade-up">
        <div>
          <h2 className="font-display text-2xl font-bold">{lang === 'ha' ? 'Duba Amsoshinka' : 'Review Your Answers'}</h2>
          <p className="text-white/50 text-sm">
            {lang === 'ha' ? 'Tabbatar komai daidai ne. Kuna iya danna kowanne don gyarawa.' : 'Check everything looks right. Tap any answer to change it.'}
          </p>
        </div>

        <div className="space-y-2">
          {fields.map((field, i) => (
            <div key={field.id} className="card p-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-white/40 text-xs uppercase tracking-wide mb-0.5">{field.label}</p>
                <p className="text-paper font-medium truncate">
                  {answers[field.id] || <span className="text-white/20 italic">{lang === 'ha' ? 'Ba a amsa ba' : 'Not answered'}</span>}
                </p>
              </div>
              <button
                onClick={() => {
                  setCurrentIndex(i)
                  setCurrentInput(answers[field.id] || '')
                  setStage('filling')
                  askQuestion(i, fields, answers)
                }}
                className="text-amber text-xs hover:underline flex-shrink-0"
              >
                {lang === 'ha' ? 'Gyara' : 'Edit'}
              </button>
            </div>
          ))}
        </div>

        <button onClick={() => setStage('done')} className="btn-primary w-full text-lg py-4">
          {t.formAllDone}
        </button>
      </div>
    )
  }

  // Stage 4: Completed output files (JSON and localized restarts)
  if (stage === 'done') {
    const downloadJSON = () => {
      const data = {}
      fields.forEach(f => { data[f.label] = answers[f.id] || '' })
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const a    = document.createElement('a')
      a.href     = URL.createObjectURL(blob)
      a.download = `${template?.label || 'form'}-answers.json`
      a.click()
    }

    return (
      <div className="flex flex-col items-center gap-6 py-8 text-center animate-fade-up">
        <div className="w-20 h-20 rounded-full bg-teal/20 flex items-center justify-center text-4xl">✓</div>
        <div>
          <h2 className="font-display text-2xl font-bold">{lang === 'ha' ? 'An Kammala Fom!' : 'Form Complete!'}</h2>
          <p className="text-white/50 text-sm mt-1">
            {lang === 'ha'
              ? `Kyakkyawan aiki — an amsa dukkan tambayoyi ${fields.length}.`
              : `Great job — all ${fields.length} questions answered.`}
          </p>
        </div>
        <div className="flex flex-col gap-3 w-full">
          <button onClick={downloadJSON} className="btn-primary w-full">{t.formDownload}</button>
          <button
            onClick={() => { setStage('select'); setTemplate(null); setAnswers({}); setFields([]) }}
            className="btn-secondary w-full"
          >
            {t.formAnother}
          </button>
        </div>
      </div>
    )
  }
}
