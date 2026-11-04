// discontinued
// api/gemma.js — NO LONGER USED
// App now calls OpenRouter and Gemini directly from the browser.
// This file is kept so Vercel doesn't complain about the /api route in vercel.json.
// You can safely delete it and remove the api rewrite from vercel.json if you want.

export default function handler(req, res) {
  res.status(410).json({ error: 'This proxy is no longer used. App calls AI providers directly.' })
}
