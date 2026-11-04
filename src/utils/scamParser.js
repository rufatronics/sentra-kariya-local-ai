// src/utils/scamParser.js
// Extract URLs and structural metadata from a text message.
// All judgment, classification, and reasoning is left to Gemma 4.

export function extractScamFeatures(text) {
  const normalizedText = text || '';

  // Extract URLs from text
  const urlRegex = /https?:\/\/[^\s$.?#].[^\s]*/gi;
  const matches = normalizedText.match(urlRegex) || [];
  const urls = [...new Set(matches)]; // Unique links

  const linkFindings = urls.map(urlStr => {
    let cleanUrl = urlStr;
    // Strip trailing punctuation (common in texts)
    cleanUrl = urlStr.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]+$/g, '');

    let domain = '';
    let tld = '';
    let isShortener = false;
    let path = '';

    try {
      const parsed = new URL(cleanUrl);
      domain = parsed.hostname;
      path = parsed.pathname;

      // Extract TLD
      const parts = domain.split('.');
      if (parts.length > 1) {
        tld = parts[parts.length - 1];
      }

      // Check for common link shorteners
      const shorteners = [
        'bit.ly', 'tinyurl.com', 'tiny.cc', 't.co', 'lnkd.in', 'rebrand.ly',
        'is.gd', 'shorte.st', 'cutt.ly', 'ow.ly', 'buff.ly', 'mcaf.ee'
      ];
      isShortener = shorteners.includes(domain.toLowerCase());
    } catch {
      // Fallback for malformed URLs
      const match = cleanUrl.match(/^(?:https?:\/\/)?([^/]+)/i);
      if (match) {
        domain = match[1];
        const parts = domain.split('.');
        if (parts.length > 1) {
          tld = parts[parts.length - 1];
        }
      }
    }

    // Measure mismatched display link if we had HTML context.
    // For raw SMS/chats, href is display text itself so we default mismatch to false.
    return {
      rawUrl: cleanUrl,
      domain: domain,
      tld: tld,
      isUrlShortener: isShortener,
      urlLength: cleanUrl.length,
      pathLength: path.length,
      domainPartsCount: domain.split('.').length
    };
  });

  // Calculate raw text features
  const wordCount = normalizedText.split(/\s+/).filter(Boolean).length;
  const sentenceCount = normalizedText.split(/[.!?]+/).filter(Boolean).length;

  // Count specific exclamation markers, uppercase ratios, digits ratio
  const exclamationCount = (normalizedText.match(/!/g) || []).length;
  const digitsCount = (normalizedText.match(/\d/g) || []).length;
  const lettersCount = (normalizedText.match(/[a-zA-Z]/g) || []).length;
  const uppercaseCount = (normalizedText.match(/[A-Z]/g) || []).length;

  const uppercaseRatio = lettersCount > 0 ? uppercaseCount / lettersCount : 0;
  const digitsRatio = normalizedText.length > 0 ? digitsCount / normalizedText.length : 0;

  return {
    rawText: normalizedText,
    wordCount,
    sentenceCount,
    exclamationCount,
    digitsRatio,
    uppercaseRatio,
    extractedLinksCount: linkFindings.length,
    links: linkFindings
  };
}
