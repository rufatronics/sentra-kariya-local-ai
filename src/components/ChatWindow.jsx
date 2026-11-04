// ChatWindow.jsx
import { useState, useRef, useEffect, useCallback } from 'react'
import { useGeminiAPI } from '../hooks/useGeminiAPI'
import { useTTS } from '../hooks/useTTS'
import { useOfflineCache } from '../hooks/useOfflineCache'
import { VoiceInput } from './VoiceInput'
import { buildChatPrompt } from '../utils/prompts'

const SUGGESTIONS = [
  'What does "indemnify" mean?',
  'Is this contract safe to sign?',
  'What should I watch out for in a rental agreement?',
  'Explain what a liability clause is.',
  'What does "at will" employment mean?'
]

function MessageBubble({ msg, onSpeak }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-fade-up`}>
      <div className={`
        w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm
        ${isUser ? 'bg-amber/20 text-amber' : 'bg-teal/20 text-teal'}
      `} aria-hidden="true">
        {isUser ? '👤' : '✦'}
      </div>
      <div className={`
        max-w-[80%] rounded-2xl px-4 py-3 leading-relaxed text-sm
        ${isUser ? 'bg-amber/10 text-paper rounded-tr-sm' : 'bg-white/5 text-paper/90 rounded-tl-sm'}
      `}>
        <p className="whitespace-pre-wrap">{msg.content}</p>
        {!isUser && (
          <button
            onClick={() => onSpeak(msg.content)}
            className="mt-2 text-white/20 hover:text-white/50 transition-colors text-xs"
            aria-label="Read this message aloud"
          >
            🔊
          </button>
        )}
      </div>
    </div>
  )
}

export function ChatWindow() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hi! I\'m ClearForm. I can help you understand forms, contracts, or any tricky documents. What would you like to know?',
      id: 'welcome'
    }
  ])
  const [input, setInput] = useState('')
  const [streamingMsg, setStreamingMsg] = useState('')
  const messagesEndRef = useRef(null)

  const { stream, loading } = useGeminiAPI()
  const { speak } = useTTS()
  const { saveChatHistory, getChatHistory } = useOfflineCache()

  // Load persisted history on mount
  useEffect(() => {
    const saved = getChatHistory()
    if (saved.length > 0) {
      setMessages([messages[0], ...saved])
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingMsg])

  const sendMessage = useCallback(async (text) => {
    const t = text.trim()
    if (!t || loading) return

    const userMsg = { role: 'user', content: t, id: Date.now() }
    const history = messages.filter(m => m.id !== 'welcome').map(m => ({ role: m.role, content: m.content }))

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setStreamingMsg('')

    const prompt = buildChatPrompt(t, history)

    try {
      const fullText = await stream({
        systemPrompt: prompt.systemPrompt,
        userPrompt: t,
        history,
        onChunk: (_, full) => setStreamingMsg(full)
      })

      const assistantMsg = { role: 'assistant', content: fullText, id: Date.now() + 1 }
      setMessages(prev => {
        const updated = [...prev, assistantMsg]
        saveChatHistory(updated.filter(m => m.id !== 'welcome'))
        return updated
      })
    } catch (err) {
      const errMsg = { role: 'assistant', content: `Sorry, I had trouble with that. Please try again.`, id: Date.now() + 1 }
      setMessages(prev => [...prev, errMsg])
    } finally {
      setStreamingMsg('')
    }
  }, [messages, loading, stream, saveChatHistory])

  const clearHistory = useCallback(() => {
    setMessages([messages[0]])
    localStorage.removeItem('clearform_chat')
  }, [messages])

  return (
    <div className="flex flex-col h-full min-h-[500px]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-bold">Ask Anything</h2>
        <button onClick={clearHistory} className="text-white/20 text-xs hover:text-white/50 transition-colors">
          Clear chat
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1 max-h-[400px]" role="log" aria-live="polite" aria-label="Chat messages">
        {messages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} onSpeak={speak} />
        ))}
        {streamingMsg && (
          <div className="flex gap-3 animate-fade-up">
            <div className="w-8 h-8 rounded-full bg-teal/20 text-teal flex items-center justify-center flex-shrink-0 text-sm" aria-hidden="true">✦</div>
            <div className="max-w-[80%] bg-white/5 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-paper/90 leading-relaxed">
              <p className="whitespace-pre-wrap">{streamingMsg}</p>
              <span className="inline-block w-1 h-4 bg-amber/60 animate-pulse ml-0.5 align-middle" aria-hidden="true"/>
            </div>
          </div>
        )}
        {loading && !streamingMsg && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-teal/20 flex items-center justify-center flex-shrink-0 text-sm" aria-hidden="true">✦</div>
            <div className="bg-white/5 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1.5 items-center" aria-label="Loading response">
              <span className="typing-dot" aria-hidden="true"/>
              <span className="typing-dot" aria-hidden="true"/>
              <span className="typing-dot" aria-hidden="true"/>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
          {SUGGESTIONS.slice(0, 3).map(s => (
            <button
              key={s}
              onClick={() => sendMessage(s)}
              className="flex-shrink-0 text-xs px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/50 hover:text-white/80 hover:border-white/30 transition-all"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
          placeholder="Ask about your document…"
          className="input-field flex-1"
          aria-label="Type your question"
          disabled={loading}
        />
        <VoiceInput onResult={text => { setInput(text); sendMessage(text) }} disabled={loading} />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || loading}
          className="btn-primary px-4 py-3 text-sm"
          aria-label="Send message"
        >
          →
        </button>
      </div>
    </div>
  )
}

// .
