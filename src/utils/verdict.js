const T = { ela: 8, fftPeaks: 6, noiseRatio: 0.12, baselineVar: 40, spacingVar: 120, lumStep: 12 }

const REC = {
  genuine: 'No strong signs of editing found. Still confirm important documents with the issuer.',
  edited: 'Parts of this image look changed. Do not rely on it until you verify with the issuing office.',
  'AI-generated': 'This image shows patterns common in computer-made pictures. Verify with the issuing office before trusting it.',
  're-shared-copy': 'This looks like a copy saved or shared many times. Ask for the original document.'
}

export function computeVerdict(s) {
  const f = {}
  let pts = 0
  const ela = s.ela?.score ?? 0
  const peaks = s.fft?.detectedPeaksCount ?? 0
  const nz = s.noiseConsistency || {}
  const ratio = nz.totalBlocksAnalyzed ? nz.highDeviationBlocksCount / nz.totalBlocksAnalyzed : 0
  const tl = s.textLineAlignment || {}
  const step = s.recompressionEstimate?.averageLuminanceStep

  if (ela > T.ela) { f.ela = 1; pts += 25 }
  if (peaks >= T.fftPeaks) { f.fft = 1; pts += 30 }
  if (ratio > T.noiseRatio) { f.noise = 1; pts += 25 }
  if (tl.detectedCount >= 3 && (tl.baselineYVariance > T.baselineVar || tl.verticalSpacingVariance > T.spacingVar)) { f.text = 1; pts += 15 }
  if (step != null && step > T.lumStep) { f.recompress = 1; pts += 10 }

  const risk = Math.min(100, pts)
  let classification = 'genuine'
  if (risk >= 25) classification = f.fft ? 'AI-generated' : (f.ela || f.noise || f.text) ? 'edited' : 're-shared-copy'

  const row = (title, flagged, finding, ok) => ({
    title, finding: flagged ? finding : ok, implication: flagged ? 'Unusual' : 'Normal'
  })
  const sections = [
    row('Error Level Analysis', f.ela, `Compression difference is high (${ela.toFixed(1)}), which can mean edited areas.`, `Compression difference is normal (${ela.toFixed(1)}).`),
    row('Frequency Analysis', f.fft, `${peaks} repeating patterns found, common in computer-made images.`, `${peaks} repeating patterns, within the normal range.`),
    row('Noise Consistency', f.noise, `${Math.round(ratio * 100)}% of blocks differ from the rest, which can mean pasted or edited areas.`, 'Image noise is consistent across the page.'),
    row('Text Alignment', f.text, 'Text lines are unevenly aligned or spaced.', 'Text lines are evenly aligned.'),
    row('Stamps and Signatures', false, '', `${s.stampIsolation?.detectedCount ?? 0} stamp or signature areas found.`),
    row('Saving History', f.recompress, 'The file was compressed heavily, likely saved or shared many times.', 'No sign of heavy re-saving.')
  ]
  const flagged = Object.keys(f)
  return {
    classification, risk, confidenceScore: 100 - risk, sections, flagged,
    recommendation: REC[classification],
    fallbackSummary: classification === 'genuine'
      ? 'No strong signs of editing were found in this document.'
      : `This document shows signs of possible editing (${flagged.join(', ')}). Please verify it.`
  }
}

const SYS = 'You explain document check results to non-technical people. Write at most 2 short, plain sentences. Never change the verdict. No lists, no JSON.'

export async function makeReport({ signals, call, translate, lang = 'en' }) {
  const v = computeVerdict(signals)
  let summary = v.fallbackSummary
  try {
    const { text } = await call({
      systemPrompt: SYS,
      userPrompt: `Verdict: ${v.classification}. Risk: ${v.risk}/100. Findings: ${v.flagged.length ? v.flagged.join(', ') : 'none'}. Explain this result simply.`,
      temperature: 0.2, maxTokens: 70
    })
    if (text.length > 10) summary = text
  } catch {}

  const report = { confidenceScore: v.confidenceScore, classification: v.classification, summary, recommendation: v.recommendation, sections: v.sections }
  if (lang !== 'ha') return report

  try {
    const flat = [summary, v.recommendation, ...v.sections.flatMap(x => [x.title, x.finding, x.implication])]
    const out = await translate(flat, 'en', 'ha')
    report.summary = out[0]
    report.recommendation = out[1]
    report.sections = v.sections.map((x, i) => ({ title: out[2 + i * 3], finding: out[3 + i * 3], implication: out[4 + i * 3] }))
  } catch {}
  return report
}
