/*
 * Lecture d'un ticket de caisse sur l'appareil (OCR Tesseract embarqué : aucune image n'est envoyée sur internet).
 * Le moteur (~5 Mo) est chargé seulement au premier scan, puis gardé en mémoire par le navigateur.
 */
const BASE = new URL('../vendor/tesseract/', import.meta.url).href;
let loading = null, worker = null, idle = null, onProgress = null;

function loadScript(src) {
  return new Promise((ok, ko) => {
    if (window.Tesseract) return ok();
    const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ko(new Error('script')); document.head.appendChild(s);
  });
}

async function getWorker() {
  if (worker) return worker;
  if (!loading) loading = (async () => {
    await loadScript(BASE + 'tesseract.min.js');
    const w = await window.Tesseract.createWorker('fra', 1, {
      workerPath: BASE + 'worker.min.js', corePath: BASE + 'tesseract-core-simd-lstm.wasm.js', langPath: BASE,
      gzip: false, workerBlobURL: false, logger: (m) => onProgress?.(m),
    });
    await w.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
    worker = w; return w;
  })().catch((e) => { loading = null; throw e; });
  return loading;
}

/** Réduit, passe en niveaux de gris et renforce le contraste pour aider la lecture. */
export async function prepare(file, maxSide = 2000) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.drawImage(bmp, 0, 0, w, h); bmp.close?.();
  const img = ctx.getImageData(0, 0, w, h), d = img.data, hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) { const g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0; d[i] = d[i + 1] = d[i + 2] = g; hist[g]++; }
  // étirement des niveaux entre les percentiles 2 % et 98 %
  const total = w * h; let acc = 0, lo = 0, hi = 255;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= total * 0.02) { lo = v; break; } }
  acc = 0; for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= total * 0.02) { hi = v; break; } }
  const span = Math.max(40, hi - lo);
  for (let i = 0; i < d.length; i += 4) { const v = Math.max(0, Math.min(255, ((d[i] - lo) * 255) / span)) | 0; d[i] = d[i + 1] = d[i + 2] = v; }
  ctx.putImageData(img, 0, 0);
  return cv;
}

/** Texte lu sur l'image. progress({ status, progress 0..1 }) pour la barre d'avancement. */
export async function readReceipt(file, progress) {
  onProgress = progress;
  clearTimeout(idle);
  progress?.({ status: 'preparing', progress: 0 });
  const cv = await prepare(file);
  const w = await getWorker();
  const { data } = await w.recognize(cv);
  idle = setTimeout(() => { worker?.terminate(); worker = null; loading = null; }, 90000); // libère la mémoire du téléphone
  return data.text;
}
