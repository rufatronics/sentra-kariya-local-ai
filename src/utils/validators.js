// validators.js

export function validateField(type, value) {
  const v = String(value).trim()
  if (!v) return { valid: false, error: 'This field cannot be empty.' }

  switch (type) {
    case 'email': {
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
      return ok ? { valid: true } : { valid: false, error: 'Please enter a valid email address like hello@example.com' }
    }
    case 'phone': {
      const digits = v.replace(/\D/g, '')
      const ok = digits.length >= 10 && digits.length <= 15
      return ok ? { valid: true, normalized: formatPhone(digits) } : { valid: false, error: 'Please enter a valid phone number with at least 10 digits.' }
    }
    case 'date': {
      const d = new Date(v)
      const ok = !isNaN(d.getTime())
      return ok ? { valid: true } : { valid: false, error: 'Please enter a valid date, for example: January 15, 1990 or 01/15/1990.' }
    }
    case 'number': {
      const ok = !isNaN(parseFloat(v)) && isFinite(v)
      return ok ? { valid: true } : { valid: false, error: 'Please enter a number.' }
    }
    default:
      return { valid: true }
  }
}

function formatPhone(digits) {
  if (digits.length === 10) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
  return digits
}

export function normalizeAnswer(type, value) {
  switch (type) {
    case 'phone': return value.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')
    case 'email': return value.toLowerCase().trim()
    case 'name': return value.trim().replace(/\b\w/g, c => c.toUpperCase())
    default: return value.trim()
  }
}

// .
