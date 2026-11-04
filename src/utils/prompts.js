// prompts.js — All Gemma 4 prompt templates

export const SYSTEM_PROMPTS = {
  formHelper: `You are ClearForm, a friendly form assistant. 
Reply ONLY with your actual response — no bullet points explaining what you are about to do, no meta-commentary, no "User says", no "Persona", no thinking out loud.
Use simple words. Be warm and brief. One question at a time.`,

  tcCompare: `You are ClearForm, a plain-language document assistant.
Reply ONLY with your actual response — no thinking out loud, no bullet planning, no meta-commentary.
Use simple everyday words. Be clear and concise.`,

  chat: `You are ClearForm, a friendly assistant that helps people understand forms and documents.
Reply ONLY with your actual answer — do not narrate your thought process, do not list what you are about to do, do not use bullet points to plan your response.
Use simple, clear language. Be warm and direct. Keep responses short.`
}

export function buildFieldExtractionPrompt(documentText) {
  return {
    systemPrompt: SYSTEM_PROMPTS.formHelper,
    userPrompt: `Look at this form and find all blank fields that need to be filled in.

Return ONLY valid JSON — no explanation, no markdown, no backticks.

Format:
{
  "formTitle": "name of the form",
  "fields": [
    {
      "id": "unique_id",
      "label": "exact label from form",
      "type": "text|email|phone|date|number|checkbox|radio|textarea|name|address",
      "required": true,
      "placeholder": "example value",
      "helpText": "one plain-English sentence explaining this field"
    }
  ]
}

Form content:
${documentText}`
  }
}

export function buildFormQuestionPrompt(field, previousAnswers) {
  const context = previousAnswers.length > 0
    ? `Already answered: ${previousAnswers.map(a => `${a.label}: ${a.value}`).join(', ')}.\n\n`
    : ''

  return {
    systemPrompt: SYSTEM_PROMPTS.formHelper,
    userPrompt: `${context}Ask the user for their "${field.label}" in one friendly sentence.
${field.type === 'phone' ? 'Give an example like: (555) 123-4567' : ''}
${field.type === 'email' ? 'Give an example like: name@email.com' : ''}
${field.type === 'date' ? 'Give an example like: January 15, 1990' : ''}
${!field.required ? 'Mention they can skip this.' : ''}
Just write the question — nothing else.`
  }
}

export function buildValidationPrompt(field, userAnswer) {
  return {
    systemPrompt: SYSTEM_PROMPTS.formHelper,
    userPrompt: `Is "${userAnswer}" a valid answer for a "${field.label}" field (type: ${field.type})?
Return ONLY valid JSON:
{
  "valid": true,
  "normalizedValue": "cleaned up answer",
  "errorMessage": ""
}`
  }
}

export function buildSimplifyPrompt(legalText) {
  return {
    systemPrompt: SYSTEM_PROMPTS.tcCompare,
    userPrompt: `Rewrite this legal text so a 10-year-old can understand it.
Short sentences. Everyday words. Keep all important facts (costs, deadlines, penalties, cancellation).
Use these sections only where they apply: What this is / What it costs / What you can do / What you cannot do / How to cancel / Watch out for.
Write the simplified version directly — no intro, no preamble.

Legal text:
${legalText}`
  }
}

export function buildComparePrompt(textA, textB, labelA = 'Document A', labelB = 'Document B') {
  return {
    systemPrompt: SYSTEM_PROMPTS.tcCompare,
    useThinking: true,
    userPrompt: `Compare these two documents. Find key differences that affect a regular person.

Return ONLY valid JSON — no explanation, no markdown:
{
  "summary": "2 sentence plain-English summary",
  "recommendation": "one clear sentence about which is more user-friendly and why",
  "differences": [
    {
      "topic": "plain English topic (e.g. Cost, Cancellation, Privacy)",
      "docA": "what ${labelA} says in plain English",
      "docB": "what ${labelB} says in plain English",
      "userNote": "one sentence about what this means for the user"
    }
  ]
}

${labelA}:
${textA}

${labelB}:
${textB}`
  }
}

export function buildExplainClausePrompt(clause, context = '') {
  return {
    systemPrompt: SYSTEM_PROMPTS.tcCompare,
    userPrompt: `Explain this in very simple words that a 10-year-old would understand:

"${clause}"

${context ? `Context: ${context}` : ''}

Write 2-3 short sentences. Just the explanation — no intro, no "This means that".`
  }
}

export function buildChatPrompt(userMessage, history = []) {
  return {
    systemPrompt: SYSTEM_PROMPTS.chat,
    userPrompt: userMessage,
    history
  }
    }

// --- Verify Mode Prompts ---
export function buildVerifyPrompt(forensicsData, lang = 'en') {
  const langInstructions = {
    en: "Write all report fields, section titles, findings, implications, and recommendations in standard English.",
    ha: "Write all report fields, findings, implications, and recommendations in Hausa. Translate technical terms to plain Hausa so low-literacy northern Nigerian users understand easily.",
    pcm: "Write all report fields, findings, implications, and recommendations in Nigerian Pidgin English (e.g., 'trust score', 'wetin we find', 'wetin e mean'). Keep the phrasing extremely accessible."
  };

  const instruction = langInstructions[lang] || langInstructions.en;

  return {
    systemPrompt: `You are ClearForm, a document verification expert powered by Gemma 4.
Analyze the provided JSON forensic signals to evaluate if a document is genuine, edited, AI-generated, a repeatedly saved copy, or fabricated.

CRITICAL RULES:
1. Always be calibrated, precise, and non-alarmist. Flag only what the evidence actually supports.
2. Return ONLY a single valid JSON object. No explanation outside the JSON. No markdown other than the JSON itself.
3. The recommendation must never be a legal or absolute claim. E.g. "verify with issuing institution" or "examine the physical stamp".
4. ${instruction}

JSON response format:
{
  "confidenceScore": 85,
  "classification": "genuine | edited-genuine | AI-generated | re-shared-copy | fabricated-from-scratch",
  "summary": "Plain-language summary of reasoning in one or two simple sentences that a non-technical user can understand.",
  "recommendation": "A friendly, calibrated recommendation.",
  "sections": [
    {
      "title": "Error Level Analysis (ELA)",
      "finding": "What the ELA score shows and what it implies.",
      "implication": "implication explanation"
    },
    {
      "title": "Frequency Domain Analysis (FFT)",
      "finding": "What the periodic frequency peaks imply about diffusion/GAN generation.",
      "implication": "implication explanation"
    },
    {
      "title": "Noise Consistency Map",
      "finding": "What local variance deviation blocks imply about localized edits/copying.",
      "implication": "implication explanation"
    },
    {
      "title": "Text Line Alignment Analysis",
      "finding": "What line contours and baseline y-variance imply about textual alignment or digital manipulation.",
      "implication": "implication explanation"
    },
    {
      "title": "Stamp & Signature Isolation",
      "finding": "What the isolated blue/red stamp region analysis implies.",
      "implication": "implication explanation"
    },
    {
      "title": "Re-compression Table Estimate",
      "finding": "What JPEG DQT tables or compression metrics imply about repeated saving depth.",
      "implication": "implication explanation"
    }
  ]
}`,
    userPrompt: `Evaluate this document forensic payload. Determine the verdict and construct the structured report.

Forensic Payload:
${JSON.stringify(forensicsData, null, 2)}`
  };
}

// --- Scam Check Mode Prompts ---
export function buildScamCheckPrompt(scamPayload, lang = 'en') {
  const langInstructions = {
    en: "Write all response fields, red flags, link check reasons, and recommendations in standard English.",
    ha: "Write all response fields, red flags, link check reasons, and recommendations in clear plain Hausa so users understand immediately.",
    pcm: "Write all response fields, red flags, link check reasons, and recommendations in Nigerian Pidgin English (e.g., 'No send money!', 'Fake bank domain')."
  };

  const instruction = langInstructions[lang] || langInstructions.en;

  return {
    systemPrompt: `You are ClearForm, a friendly assistant specialized in checking messages for potential scams, powered by Gemma 4.
Analyze the provided text and URL features to evaluate risk levels.

CRITICAL RULES:
1. Do not flag normal or legitimate links as suspicious by default. Only flag real red flags (such as lookalike domains, suspicious TLDs, known url shortener hiding destination, or mismatched display text vs actual href).
2. All analysis must be structured, helpful, and non-alarmist.
3. Return ONLY a single valid JSON object. No explanation outside the JSON. No markdown other than the JSON itself.
4. ${instruction}

JSON response format:
{
  "riskLevel": "low | medium | high",
  "confidenceScore": 90,
  "summary": "A friendly plain-language summary of the overall verdict.",
  "recommendation": "A helpful recommendation (e.g., 'don't send money or personal info until you verify directly with the company').",
  "redFlags": [
    {
      "flag": "indicator name",
      "explanation": "Why this matters in a simple one-line sentence."
    }
  ],
  "links": [
    {
      "url": "the link analyzed",
      "status": "clean | flagged",
      "reason": "Specific reason explaining why it was flagged or marked clean."
    }
  ]
}`,
    userPrompt: `Evaluate this message payload for scam risk and analyze the extracted links.

Message Payload:
${JSON.stringify(scamPayload, null, 2)}`
  };
}
