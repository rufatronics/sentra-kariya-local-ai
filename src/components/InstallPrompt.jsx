// InstallPrompt.jsx — simple persistent button, no beforeinstallprompt needed
import { useState } from 'react'

export function InstallPrompt() {
  const [done, setDone] = useState(
    () => !!localStorage.getItem('pwa_installed')
  )

  if (done) return null

  const handlePress = () => {
    localStorage.setItem('pwa_installed', '1')
    setDone(true)
  }

  return (
    <div className="fixed bottom-24 left-4 right-4 z-50 animate-fade-up">
      <div className="card p-4 flex items-center gap-3 shadow-2xl border-amber/20 bg-ink">
        <span className="text-xl flex-shrink-0">📲</span>
        <div className="flex-1 min-w-0">
          <p className="text-paper text-sm font-semibold">Add to Home Screen</p>
          <p className="text-white/30 text-xs">
            {/iphone|ipad|ipod/i.test(navigator.userAgent)
              ? 'Tap Share → Add to Home Screen in Safari'
              : 'Tap the install icon in your browser bar'}
          </p>
        </div>
        <button
          onClick={handlePress}
          className="btn-primary text-xs px-4 py-2 flex-shrink-0"
        >
          Done ✓
        </button>
      </div>
    </div>
  )
}

// .
