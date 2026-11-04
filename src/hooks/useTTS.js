// useTTS.js
import { useState, useCallback, useEffect } from 'react'

function cleanForSpeech(text) {
  return text
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/\n+/g, '. ')
    .replace(/\.{2,}/g, '.')
    .trim()
}

export function useTTS() {
  const [speaking, setSpeaking] = useState(false)
  const [supported] = useState(() => 'speechSynthesis' in window)
  const [autoRead, setAutoRead] = useState(
    () => localStorage.getItem('clearform_autoread') === 'true'
  )

  const getVoice = useCallback(() => {
    const voices = window.speechSynthesis.getVoices()
    return (
      voices.find(v => v.lang.startsWith('en') && v.localService && v.name.includes('Google')) ||
      voices.find(v => v.lang.startsWith('en') && v.localService) ||
      voices.find(v => v.lang.startsWith('en')) ||
      voices[0]
    )
  }, [])

  const speak = useCallback((text) => {
    if (!supported || !text) return
    window.speechSynthesis.cancel()

    const clean = cleanForSpeech(text)

    // Split into chunks of ~200 chars at sentence boundaries
    // This prevents the browser from cutting off long responses
    const sentences = clean.match(/[^.!?]+[.!?]+/g) || [clean]
    const chunks = []
    let current = ''
    for (const sentence of sentences) {
      if ((current + sentence).length > 200) {
        if (current) chunks.push(current.trim())
        current = sentence
      } else {
        current += sentence
      }
    }
    if (current.trim()) chunks.push(current.trim())

    let chunkIndex = 0

    const speakNext = () => {
      if (chunkIndex >= chunks.length) {
        setSpeaking(false)
        return
      }
      const utterance = new SpeechSynthesisUtterance(chunks[chunkIndex])
      utterance.voice = getVoice()
      utterance.rate = 0.92
      utterance.pitch = 1.0
      utterance.volume = 1.0
      utterance.onend = () => {
        chunkIndex++
        speakNext()
      }
      utterance.onerror = () => setSpeaking(false)
      window.speechSynthesis.speak(utterance)
    }

    setSpeaking(true)
    speakNext()
  }, [supported, getVoice])

  const stop = useCallback(() => {
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [])

  const toggleAutoRead = useCallback(() => {
    setAutoRead(prev => {
      const next = !prev
      localStorage.setItem('clearform_autoread', String(next))
      return next
    })
  }, [])

  // Fix Chrome bug — speech cuts out after ~15s
  useEffect(() => {
    if (!supported) return
    const id = setInterval(() => {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause()
        window.speechSynthesis.resume()
      }
    }, 10000)
    return () => clearInterval(id)
  }, [supported])

  return { speak, stop, speaking, supported, autoRead, toggleAutoRead }
      }

// .
