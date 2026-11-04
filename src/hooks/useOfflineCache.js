// useOfflineCache.js — IndexedDB via `idb` for documents, localStorage for prefs
import { useState, useCallback } from 'react'
import { openDB } from 'idb'

const DB_NAME = 'clearform-db'
const DB_VERSION = 1

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('documents')) {
        db.createObjectStore('documents', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('api-cache')) {
        db.createObjectStore('api-cache', { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains('form-progress')) {
        db.createObjectStore('form-progress', { keyPath: 'id' })
      }
    }
  })
}

export function useOfflineCache() {
  const [saving, setSaving] = useState(false)

  // --- Documents (IndexedDB — handles large files) ---
  const saveDocument = useCallback(async (id, file, extractedText) => {
    setSaving(true)
    try {
      const db = await getDB()
      await db.put('documents', {
        id,
        name: file.name,
        type: file.type,
        size: file.size,
        text: extractedText,
        savedAt: Date.now()
      })
    } finally {
      setSaving(false)
    }
  }, [])

  const getDocument = useCallback(async (id) => {
    const db = await getDB()
    return db.get('documents', id)
  }, [])

  const getAllDocuments = useCallback(async () => {
    const db = await getDB()
    return db.getAll('documents')
  }, [])

  const deleteDocument = useCallback(async (id) => {
    const db = await getDB()
    await db.delete('documents', id)
  }, [])

  // --- API cache ---
  const cacheAPIResponse = useCallback(async (key, response, ttlMs = 3600_000) => {
    const db = await getDB()
    await db.put('api-cache', { key, response, expiresAt: Date.now() + ttlMs })
  }, [])

  const getCachedResponse = useCallback(async (key) => {
    const db = await getDB()
    const entry = await db.get('api-cache', key)
    if (!entry) return null
    if (entry.expiresAt < Date.now()) {
      await db.delete('api-cache', key)
      return null
    }
    return entry.response
  }, [])

  // --- Form progress (localStorage — small, fast) ---
  const saveFormProgress = useCallback((sessionId, fields, answers) => {
    try {
      localStorage.setItem(`clearform_progress_${sessionId}`, JSON.stringify({
        fields, answers, savedAt: Date.now()
      }))
    } catch { /* storage full */ }
  }, [])

  const getFormProgress = useCallback((sessionId) => {
    try {
      const raw = localStorage.getItem(`clearform_progress_${sessionId}`)
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  }, [])

  const clearFormProgress = useCallback((sessionId) => {
    localStorage.removeItem(`clearform_progress_${sessionId}`)
  }, [])

  // --- Chat history ---
  const saveChatHistory = useCallback((history) => {
    try {
      // Keep last 50 messages only
      const trimmed = history.slice(-50)
      localStorage.setItem('clearform_chat', JSON.stringify(trimmed))
    } catch {}
  }, [])

  const getChatHistory = useCallback(() => {
    try {
      return JSON.parse(localStorage.getItem('clearform_chat') || '[]')
    } catch { return [] }
  }, [])

  return {
    saving,
    saveDocument, getDocument, getAllDocuments, deleteDocument,
    cacheAPIResponse, getCachedResponse,
    saveFormProgress, getFormProgress, clearFormProgress,
    saveChatHistory, getChatHistory
  }
}

// .
