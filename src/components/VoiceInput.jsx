// VoiceInput.jsx
import { useEffect } from 'react'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'

export function VoiceInput({ onResult, disabled, className = '' }) {
  const { isListening, transcript, supported, toggle } = useSpeechRecognition({
    onResult
  })

  if (!supported) return null

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <button
        onClick={toggle}
        disabled={disabled}
        aria-label={isListening ? 'Stop recording' : 'Start voice input'}
        aria-pressed={isListening}
        className={`
          relative w-14 h-14 rounded-full flex items-center justify-center
          transition-all duration-300 focus-visible:ring-4 focus-visible:ring-amber/50
          focus-visible:outline-none disabled:opacity-40 disabled:cursor-not-allowed
          ${isListening
            ? 'bg-amber text-ink mic-active scale-110'
            : 'bg-white/10 text-paper hover:bg-white/20 border border-white/20'
          }
        `}
      >
        {isListening ? (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="6" y="4" width="4" height="16" rx="1"/>
            <rect x="14" y="4" width="4" height="16" rx="1"/>
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
          </svg>
        )}
      </button>
      {isListening && transcript && (
        <p className="text-white/60 text-sm italic truncate max-w-xs" aria-live="polite">
          "{transcript}"
        </p>
      )}
    </div>
  )
}

// .
