// ProgressIndicator.jsx
export function ProgressIndicator({ current, total, className = '' }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0

  return (
    <div className={`space-y-1.5 ${className}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Question ${current + 1} of ${total}`}>
      <div className="flex justify-between text-xs text-white/40">
        <span>Question {current + 1} of {total}</span>
        <span>{pct}% done</span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// .
