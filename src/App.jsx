// src/App.jsx
// Main entry point for Kariya: A specialized application designed to empower
// low-literacy or non-literate individuals in Nigeria to fill forms, analyze
// documents for AI synthesis, and identify SMS/job scams.
// Default language is Hausa to prioritize reach in Northern Nigerian communities,
// and it supports dynamic language toggle to English and Nigerian Pidgin.

import { useState, useEffect } from 'react'
import { FormFiller } from './components/FormFiller'
import { TCCompare } from './components/TCCompare'
import { ChatWindow } from './components/ChatWindow'
import { VerifyView } from './components/VerifyView'
import { ScamCheckView } from './components/ScamCheckView'
import { InstallPrompt } from './components/InstallPrompt'

import { LANGUAGES, TRANSLATIONS } from './utils/translations'
import { subscribeStatus, checkWebGPU } from './hooks/useLocalAI'

function badgeState(s) {
  if (s.llm === 'loading' || s.nllb === 'loading') return ['loading model…', true]
  if (s.llm === 'ready') return ['local AI', false]
  if (s.nllb === 'ready') return ['local translation', false]
  if (s.gpu && !s.gpu.ok) return ['rule-based only', true]
  return ['local AI · on demand', false]
}

function ProviderBadge() {
  const [s, setS] = useState({ llm: 'idle', nllb: 'idle', progress: '', gpu: null })
  useEffect(() => {
    const off = subscribeStatus(setS)
    checkWebGPU()
    return off
  }, [])
  const [label, warn] = badgeState(s)
  return (
    <div className="ml-auto flex flex-col items-end" title={s.gpu && !s.gpu.ok ? s.gpu.reason : s.progress}>
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full animate-pulse-slow ${warn ? 'bg-amber' : 'bg-teal'}`} aria-hidden="true"/>
        <span className={`text-xs font-mono ${warn ? 'text-amber' : 'text-teal'}`}>{label}</span>
      </div>
      {s.gpu && !s.gpu.ok && <span className="text-[10px] text-white/40 max-w-[11rem] text-right leading-tight">{s.gpu.reason}</span>}
      {(s.llm === 'loading' || s.nllb === 'loading') && s.progress && <span className="text-[10px] text-white/40 max-w-[11rem] text-right leading-tight truncate">{s.progress}</span>}
    </div>
  )
}

export default function App() {
  // Navigation active tab (defaults to 'form' i.e. "Cika Takarda")
  const [activeTab, setActiveTab] = useState('form')
  // Track LLM fallback status
  const [, setProvider]   = useState(null)
  // DEFAULT LANGUAGE: Hausa ('ha')
  const [lang, setLang]           = useState('ha')

  const t = TRANSLATIONS[lang] || TRANSLATIONS.ha;

  // Render bottom navigation tabs with localized strings and visual emojis
  const dynamicTabs = [
    { id: 'form',    label: t.form,    icon: '📝', shortLabel: t.form.split(' ')[0] },
    { id: 'compare', label: t.compare, icon: '⚖️', shortLabel: t.compare.split(' ')[0] },
    { id: 'chat',    label: t.chat,    icon: '💬', shortLabel: t.chat.split(' ')[0] },
    { id: 'verify',  label: t.verify,  icon: '🛡️', shortLabel: t.verify.split(' ')[0] },
    { id: 'scam',    label: t.scam,    icon: '🎯', shortLabel: t.scam.split(' ')[0] }
  ];

  return (
    <div className="min-h-dvh flex flex-col max-w-lg mx-auto relative bg-ink">
      {/* Ambient background blur for professional mobile layout */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-amber/5 rounded-full blur-3xl"/>
        <div className="absolute top-1/2 -left-32 w-80 h-80 bg-teal/5 rounded-full blur-3xl"/>
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-amber/3 rounded-full blur-3xl"/>
      </div>

      {/* Header section with brand logo (KY for Kariya) and language selector */}
      <header className="px-4 pt-4 pb-2 flex items-center gap-3 border-b border-white/5 bg-ink/50 backdrop-blur">
        <div className="w-8 h-8 bg-amber rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-ink text-sm font-display font-black">KY</span>
        </div>
        <div>
          <h1 className="font-display font-black text-paper text-lg leading-tight">Kariya</h1>
          <p className="text-white/30 text-xs leading-tight">{t.subTitle}</p>
        </div>
        <ProviderBadge />

        {/* Multilingual Selector dropdown */}
        <div className="flex items-center gap-1.5 ml-2">
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="bg-white/10 border border-white/20 text-paper text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-amber/50 font-medium"
            aria-label="Select Language"
          >
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id} className="bg-ink text-paper">
                {l.flag} {l.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Main content body (rendered as tabs to avoid reset of state when navigating) */}
      <main className="flex-1 px-4 py-4 overflow-y-auto pb-24" id="main-content" tabIndex="-1">
        <div className={activeTab === 'form'    ? 'block' : 'hidden'} role="tabpanel" id="panel-form"    aria-labelledby="tab-form">
          <FormFiller onProviderChange={setProvider} lang={lang} />
        </div>
        <div className={activeTab === 'compare' ? 'block' : 'hidden'} role="tabpanel" id="panel-compare" aria-labelledby="tab-compare">
          <TCCompare lang={lang} />
        </div>
        <div className={activeTab === 'chat'    ? 'block' : 'hidden'} role="tabpanel" id="panel-chat"    aria-labelledby="tab-chat">
          <ChatWindow lang={lang} />
        </div>
        <div className={activeTab === 'verify'  ? 'block' : 'hidden'} role="tabpanel" id="panel-verify"  aria-labelledby="tab-verify">
          <VerifyView lang={lang} />
        </div>
        <div className={activeTab === 'scam'    ? 'block' : 'hidden'} role="tabpanel" id="panel-scam"    aria-labelledby="tab-scam">
          <ScamCheckView lang={lang} />
        </div>
      </main>

      {/* Persistent Bottom Tab Navigation for intuitive mobile feel */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-ink/95 backdrop-blur-xl border-t border-white/10 pb-safe px-2 pt-2 z-50" aria-label="Main navigation">
        <div className="flex">
          {dynamicTabs.map(tab => (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-all duration-200
                focus-visible:ring-2 focus-visible:ring-amber/50 focus-visible:outline-none
                ${activeTab === tab.id ? 'text-amber bg-amber/10 font-bold' : 'text-white/30 hover:text-white/60 hover:bg-white/5'}
              `}
            >
              <span className="text-xl" aria-hidden="true">{tab.icon}</span>
              <span className="text-[10px] font-body font-medium truncate max-w-[70px]">{tab.shortLabel}</span>
            </button>
          ))}
        </div>
      </nav>

      <InstallPrompt />
    </div>
  )
}
