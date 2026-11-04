import fs from 'fs'
import path from 'path'
const roots = ['node_modules/onnxruntime-web/dist', 'node_modules/@huggingface/transformers/node_modules/onnxruntime-web/dist']
const dir = roots.find(r => fs.existsSync(r))
if (!dir) { console.warn('onnxruntime-web dist not found; copy its ort-wasm* files to public/ort manually'); process.exit(0) }
fs.mkdirSync('public/ort', { recursive: true })
for (const f of fs.readdirSync(dir)) if (/^ort-wasm.*\.(wasm|mjs)$/.test(f)) fs.copyFileSync(path.join(dir, f), path.join('public/ort', f))
