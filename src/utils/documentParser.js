// documentParser.js
// Strategy: for images → pass directly to Gemma 4 vision (no OCR overhead)
// For PDFs → extract text with pdf.js, fall back to Gemma 4 vision if scan

export async function extractTextFromFile(file) {
  const type = file.type

  if (type.startsWith('image/')) {
    // Resize & compress image to avoid huge base64 payload fetch errors
    const compressedResult = await resizeAndCompressImage(file)
    return { mode: 'image', base64: compressedResult.base64, mimeType: compressedResult.mimeType, text: null }
  }

  if (type === 'application/pdf') {
    try {
      const text = await extractPDFText(file)
      if (text && text.trim().length > 50) {
        return { mode: 'text', text, base64: null }
      }
      // Scanned PDF — render first page as image and pass to Gemma 4 vision
      const { base64, mimeType } = await pdfToImage(file)
      return { mode: 'image', base64, mimeType, text: null }
    } catch {
      const { base64, mimeType } = await pdfToImage(file)
      return { mode: 'image', base64, mimeType, text: null }
    }
  }

  if (type === 'text/plain') {
    const text = await file.text()
    return { mode: 'text', text, base64: null }
  }

  throw new Error(`Unsupported file type: ${type}. Please use PDF, JPG, PNG, or TXT.`)
}

async function extractPDFText(file) {
  // Dynamic import to avoid bundle bloat
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  let fullText = ''

  for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = textContent.items.map(item => item.str).join(' ')
    fullText += pageText + '\n\n'
  }

  return fullText
}

async function pdfToImage(file) {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const page = await pdf.getPage(1)

  const viewport = page.getViewport({ scale: 2.0 })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height

  const ctx = canvas.getContext('2d')
  await page.render({ canvasContext: ctx, viewport }).promise

  const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
  const base64 = dataUrl.split(',')[1]
  return { base64, mimeType: 'image/jpeg' }
}

export async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export async function resizeAndCompressImage(file, maxWidth = 1024, maxHeight = 1024, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      // Calculate new dimensions keeping aspect ratio
      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas compression failed'));
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result.split(',')[1];
          resolve({ base64, mimeType: 'image/jpeg' });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      }, 'image/jpeg', quality);

      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image for resizing'));
    };
  });
}
