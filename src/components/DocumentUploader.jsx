// DocumentUploader.jsx
import { useState, useCallback } from 'react'
import { extractTextFromFile, formatFileSize } from '../utils/documentParser'

export function DocumentUploader({ onExtracted, label = 'Upload Document', accept = '.pdf,.png,.jpg,.jpeg,.txt' }) {
  const [dragging, setDragging] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [file, setFile] = useState(null)
  const [error, setError] = useState(null)

  const process = useCallback(async (f) => {
    setProcessing(true)
    setError(null)
    setFile(f)
    try {
      const result = await extractTextFromFile(f)
      onExtracted({ file: f, ...result })
    } catch (err) {
      setError(err.message)
      setFile(null)
    } finally {
      setProcessing(false)
    }
  }, [onExtracted])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) process(f)
  }, [process])

  const onInput = useCallback((e) => {
    const f = e.target.files[0]
    if (f) process(f)
  }, [process])

  return (
    <div className="space-y-2">
      <label
        onDrop={onDrop}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        className={`
          flex flex-col items-center justify-center gap-3 w-full min-h-36
          border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200
          ${dragging ? 'border-amber bg-amber/10' : 'border-white/20 hover:border-white/40 hover:bg-white/5'}
          ${processing ? 'opacity-60 cursor-wait' : ''}
        `}
        aria-label={label}
      >
        <input
          type="file"
          accept={accept}
          onChange={onInput}
          className="sr-only"
          aria-hidden="true"
          disabled={processing}
        />

        {processing ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-amber border-t-transparent rounded-full animate-spin" aria-hidden="true" />
            <p className="text-white/60 text-sm">Reading document…</p>
          </div>
        ) : file ? (
          <div className="flex flex-col items-center gap-1 text-center px-4">
            <div className="w-10 h-10 bg-teal/20 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-paper text-sm font-medium truncate max-w-xs">{file.name}</p>
            <p className="text-white/40 text-xs">{formatFileSize(file.size)}</p>
            <p className="text-white/40 text-xs mt-1">Click to replace</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-center px-4">
            <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-white/60 text-sm">{label}</p>
            <p className="text-white/30 text-xs">PDF, PNG, JPG, or TXT · drag & drop or tap</p>
          </div>
        )}
      </label>

      {error && (
        <p role="alert" className="text-red-400 text-sm px-1">{error}</p>
      )}
    </div>
  )
}

// .
