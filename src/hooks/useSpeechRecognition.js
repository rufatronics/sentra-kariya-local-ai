// useSpeechRecognition.js
import { useState, useCallback, useRef, useEffect } from 'react'

export function useSpeechRecognition({ onResult, onError, language = 'en-US' } = {}) {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [supported, setSupported] = useState(false)
  const recognitionRef = useRef(null)

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    setSupported(!!SR)
    if (!SR) return

    const recognition = new SR()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = language
    recognition.maxAlternatives = 1

    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)

    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1]
      const text = result[0].transcript
      setTranscript(text)
      if (result.isFinal) onResult?.(text)
    }

    recognition.onerror = (event) => {
      setIsListening(false)
      if (event.error !== 'aborted') onError?.(event.error)
    }

    recognitionRef.current = recognition
  }, [language, onResult, onError])

  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListening) return
    setTranscript('')
    try { recognitionRef.current.start() } catch {}
  }, [isListening])

  const stopListening = useCallback(() => {
    if (!recognitionRef.current || !isListening) return
    try { recognitionRef.current.stop() } catch {}
  }, [isListening])

  const toggle = useCallback(() => {
    isListening ? stopListening() : startListening()
  }, [isListening, startListening, stopListening])

  return { isListening, transcript, supported, startListening, stopListening, toggle }
}

// .
