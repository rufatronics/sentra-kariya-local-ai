// extractFields.js
// Robust field extraction that survives messy model output.
// Strategy: try JSON parse → try to find JSON inside text → build fields from plain text

export function parseFieldsFromResponse(rawText) {
  if (!rawText) return null

  // 1. Strip markdown fences and try direct parse
  const stripped = rawText
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim()

  try {
    const parsed = JSON.parse(stripped)
    if (parsed?.fields?.length) return parsed
  } catch {}

  // 2. Find the first { ... } block in the text
  const firstBrace = stripped.indexOf('{')
  const lastBrace  = stripped.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      const jsonSlice = stripped.slice(firstBrace, lastBrace + 1)
      const parsed = JSON.parse(jsonSlice)
      if (parsed?.fields?.length) return parsed
    } catch {}
  }

  // 3. Find a [...] array block
  const firstBracket = stripped.indexOf('[')
  const lastBracket  = stripped.lastIndexOf(']')
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    try {
      const arr = JSON.parse(stripped.slice(firstBracket, lastBracket + 1))
      if (Array.isArray(arr) && arr.length) {
        return { formTitle: 'Your Form', fields: arr }
      }
    } catch {}
  }

  // 4. Last resort — parse plain-text field labels line by line
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean)
  const fields = []
  for (const line of lines) {
    // Match lines like "- Full Name (required)" or "• Email Address"
    const match = line.match(/[-•*]\s*(.+?)(?:\s*[\(\[](.+?)[\)\]])?$/)
    if (match) {
      const label = match[1].trim()
      if (label.length > 1 && label.length < 80) {
        fields.push({
          id:       label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
          label,
          type:     guessType(label),
          required: /required|mandatory/i.test(line),
          helpText: ''
        })
      }
    }
  }

  if (fields.length) return { formTitle: 'Your Form', fields }
  return null
}

function guessType(label) {
  const l = label.toLowerCase()
  if (/email/.test(l))                     return 'email'
  if (/phone|mobile|tel/.test(l))          return 'phone'
  if (/date|birth|dob|born/.test(l))       return 'date'
  if (/address|street|city|zip/.test(l))   return 'address'
  if (/name/.test(l))                      return 'name'
  if (/income|salary|amount|number/.test(l)) return 'number'
  if (/note|comment|describe/.test(l))     return 'textarea'
  return 'text'
}

// .
