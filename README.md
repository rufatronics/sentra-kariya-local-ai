# Kariya — Multi-lingual Document Verification & Scam Protection Assistant

> An offline-first, voice-guided Progressive Web App (PWA) designed for the **GDG BUK Gemma Hackathon**, empowering low-literacy or non-literate individuals in Nigeria to fill out forms, detect synthetic/AI documents, and scan SMS messages for scam indicators.
>
> Powered by **Gemma 4** (`gemma-4-26b-a4b-it`) with default **Hausa (Arewacin Najeriya)** support, alongside Nigerian Pidgin English and standard English.

---

## GDG BUK Gemma Hackathon Submission

This project is specifically customized and extended for the **GDG Bayero University Kano (BUK) Gemma Hackathon**. "Kariya" (meaning *Protection* or *Shield* in Hausa) acts as a protective digital shield against fraud, document forgery, and complex legal jargon for communities across Nigeria.

---

## Key Features

### 1. 📝 Cika Takarda (Voice-Guided Form Filling)
- **Local Nigerian Templates**: National ID (NIN) Enrollment, School Admission Letters, and Tenancy/Land Lease Agreements.
- **Voice-by-Voice Guidance**: Reads out questions in standard Hausa, Pidgin, or English, validates input formats (e.g. Phone, date of birth) and writes to local IDB caches.
- **Smart Vision Extraction**: Upload a physical document; Gemma 4 reads and parses the required blanks automatically.

### 2. 🛡️ Tantance Doc (Client-Side Document Forensics)
Runs a zero-backend, pure client-side forensic pipeline on document images to find edits or AI generation:
- **Error Level Analysis (ELA)**: Re-saves to 85% quality via Canvas API, pixel-diffs against the original, and outputs a visual color-coded heatmap with anomaly indicators.
- **1D FFT Artifact Spectrum**: Runs Fourier transform peaks analysis using `fft.js` to flag high-frequency periodic patterns characteristic of synthetic diffusion or GAN generation.
- **Noise Consistency Maps**: Computes local block variance using a Laplacian high-pass convolution filter, flagging regions deviating from the overall image median.
- **Text Line Alignment (OpenCV.js)**: Group contours horizontally to measure baseline y-variance and line-spacing consistency (flagging localized modifications).
- **Stamp & Signature Isolation (OpenCV.js)**: Runs color-space HSV contour thresholding to crop and isolate blue/red signatures and stamps, running localized forensic maps on them.
- **Re-compression Depth Estimates**: Raw binary JPEG parsing to examine Define Quantization Tables (DQT), identifying how many times a file has been repeatedly saved (detects "screenshot-of-a-screenshot" pattern).

All parsed forensic signals are packaged and routed to Gemma 4, which outputs a calibrated, non-alarmist risk analysis report.

### 3. 🎯 Gane Algush (Message Scam Check)
- **SMS / Message Paste & Speak**: Paste text or use Web Speech to record potential job, loan, or cash reward offers.
- **Linguistic and URL Feature Extractors**: Pulls out length metrics, TLD categories, uppercase/digit ratios, and shortener statuses.
- **Non-Alarmist Calibrated Analysis**: Normal/government domains come back clean. Gemma 4 flags specific lookalikes, mismatch display texts, or suspicious URL structures with user-friendly warnings.

### 4. ⚖️ Kwatanta Takardu (Document Comparison)
- Upload two agreements or policies (e.g. tenancy leases or loan offers) and receive a side-by-side comparative table, pointing out cancellations, costs, or risky terms in plain Hausa, Pidgin, or English.

### 5. 💬 Tattaunawa da Kariya AI (Streaming Chat)
- Streaming chat interface to ask any document-related or legal question, yielding responses optimized in simple, easily understandable terminology.

---

## Tech Stack

| Layer | Technology Used |
|-------|-----------------|
| **Frontend** | React 18 + Vite |
| **Styling** | Tailwind CSS (Syne + Instrument Sans typography) |
| **Classical Forensics** | Canvas API + `fft.js` + OpenCV.js (WebAssembly) |
| **AI Integration** | Gemma 4 MoE (`google/gemma-4-26b-a4b-it`) via OpenRouter & direct fallback Gemini API |
| **Offline First / PWA** | `vite-plugin-pwa` + Workbox service workers |
| **Storage** | IndexedDB (caching scanned files) + localStorage (user progress) |
| **Voice & Speech** | Web Speech API (STT recognition) + browser SpeechSynthesis (TTS audio output) |

---

## Setup & Running Locally

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/yourusername/kariya
cd kariya
npm install
```

### 2. Configure Environment Variables
Create a `.env` or `.env.local` file in the root directory:
```env
VITE_OPENROUTER_KEY=your_openrouter_api_key
VITE_GEMINI_KEY=your_gemini_api_key
```

### 3. Run Development Server
```bash
npm run dev
```
Open `http://localhost:5173/` in your browser.

### 4. Build Production Bundle
To compile optimized static assets and generate service worker caching tables:
```bash
npm run build
```

---

## Accessibility & Localization Design
- **Hausa by Default**: The application defaults to Hausa (`ha`), allowing effortless onboarding for Northern Nigerian users.
- **Accessible Inputs**: Large, responsive, mobile-first touch controls, minimal decorative noise, and prominent risk labels.
- **Offline First**: Offline service workers cache all assets, including fonts, icons, and local forensic engines.

---

## License
MIT
