import './styles.css';
import { DICTS, LANGS, detectLang } from './i18n.js';
import { PALETTES, dither, hexToRgb } from './dither.js';

const CONFIG = { OUTPUT: 512 };

// ===== State =====
const $ = id => document.getElementById(id);
const video = $('video'), screen = $('screen'), ctx = screen.getContext('2d');
const small = document.createElement('canvas');
const sctx = small.getContext('2d', { willReadFrequently: true });

const isMobile = navigator.userAgentData?.mobile ??
  (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
   (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

const saved = (() => { try { return JSON.parse(localStorage.getItem('dither') || '{}'); } catch { return {}; } })();
const state = {
  stream: null,
  facing: 'user',          // mobile: 'user' | 'environment'
  deviceId: null,          // desktop: specific camera
  devices: [],
  mirror: true,
  palette: saved.palette ?? 0,
  res: saved.res ?? 128,
  bright: saved.bright ?? 0,
  contrast: saved.contrast ?? 1.2,
  lang: LANGS.includes(saved.lang) ? saved.lang : detectLang(navigator.language),
};
const t = key => DICTS[state.lang][key];

function setLang(l) {
  state.lang = l;
  document.documentElement.lang = l;
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  $('shutter').setAttribute('aria-label', t('snapAria'));
  $('flipBtn').setAttribute('aria-label', t('flipAria'));
  $('langBtn').textContent = l === 'uk' ? 'EN' : 'UK';
  persist();
}
let palRGB = [];

function persist() {
  try { localStorage.setItem('dither', JSON.stringify({ palette: state.palette, res: state.res, bright: state.bright, contrast: state.contrast, lang: state.lang })); } catch {}
}
function setPalette(i) {
  state.palette = i % PALETTES.length;
  palRGB = PALETTES[state.palette].colors.map(hexToRgb);
  $('paletteBtn').textContent = PALETTES[state.palette].name;
  persist();
}
function setRes(r) {
  state.res = r;
  for (const b of $('resSeg').children) b.setAttribute('aria-pressed', +b.dataset.res === r);
  persist();
}
const status = t => { $('status').textContent = t; };

// ===== Camera =====
function stopStream() {
  state.stream?.getTracks().forEach(t => t.stop());
  state.stream = null;
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    return showError(t('noSupport'));
  }
  stopStream();
  const base = { width: { ideal: 1280 }, height: { ideal: 1280 } };
  const attempts = isMobile
    ? [{ ...base, facingMode: { exact: state.facing } }, { ...base, facingMode: state.facing }]
    : [state.deviceId ? { ...base, deviceId: { exact: state.deviceId } } : base, base];

  let err;
  for (const v of attempts) {
    try { state.stream = await navigator.mediaDevices.getUserMedia({ video: v, audio: false }); break; }
    catch (e) { err = e; if (e.name === 'NotAllowedError') break; }
  }
  if (!state.stream) {
    return showError(t(err?.name === 'NotAllowedError' ? 'denied' : 'failed'));
  }

  video.srcObject = state.stream;
  await video.play().catch(() => {});

  const s = state.stream.getVideoTracks()[0].getSettings();
  state.deviceId = s.deviceId || state.deviceId;
  if (s.facingMode) state.facing = s.facingMode;
  // mirror the front camera (and laptop webcams), like a mirror
  state.mirror = s.facingMode ? s.facingMode === 'user' : (isMobile ? state.facing === 'user' : true);

  state.devices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
  $('flipBtn').hidden = state.devices.length < 2;

  $('overlay').hidden = true;
  $('shutter').disabled = false;
  $('led').classList.add('on');
}

function showError(text) {
  $('msg').textContent = text;
  $('msg').removeAttribute('data-i18n');
  $('startBtn').dataset.i18n = 'retry';
  $('startBtn').textContent = t('retry');
  $('overlay').hidden = false;
  $('shutter').disabled = true;
  $('led').classList.remove('on');
}

function flip() {
  if (isMobile) {
    state.facing = state.facing === 'user' ? 'environment' : 'user';
  } else {
    const ids = state.devices.map(d => d.deviceId);
    state.deviceId = ids[(ids.indexOf(state.deviceId) + 1) % ids.length];
  }
  startCamera();
}

function render() {
  if (state.stream && video.readyState >= 2) {
    const vw = video.videoWidth, vh = video.videoHeight, s = Math.min(vw, vh), N = state.res;
    if (small.width !== N) small.width = small.height = N;
    sctx.save();
    if (state.mirror) { sctx.translate(N, 0); sctx.scale(-1, 1); }
    sctx.imageSmoothingEnabled = true;
    sctx.drawImage(video, (vw - s) / 2, (vh - s) / 2, s, s, 0, 0, N, N);
    sctx.restore();
    const img = sctx.getImageData(0, 0, N, N);
    dither(img.data, N, palRGB, state.bright, state.contrast);
    sctx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, 0, 0, CONFIG.OUTPUT, CONFIG.OUTPUT);
  }
  requestAnimationFrame(render);
}

// ===== Capture =====
// Synchronous, so navigator.share() still runs inside the user gesture (matters on iOS)
function canvasToBlobSync(c) {
  const bin = atob(c.toDataURL('image/png').split(',')[1]);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: 'image/png' });
}

async function saveImage(blob, name) {
  const file = new File([blob], name, { type: 'image/png' });
  // Mobile: system share sheet → "Save Image" (straight to Photos/Gallery)
  if (isMobile && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return status(t('saved')); }
    catch (e) { if (e.name === 'AbortError') return status(t('cancelled')); }
  }
  // Desktop and fallback: regular file download
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  status(t('downloaded'));
}

function snap() {
  if ($('shutter').disabled) return;
  const blob = canvasToBlobSync(screen);
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  saveImage(blob, `dither-${ts}.png`);
  const f = $('flash');
  f.classList.add('on');
  requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on')));
  navigator.vibrate?.(30);
}

// ===== UI =====
$('startBtn').onclick = startCamera;
$('langBtn').onclick = () => setLang(state.lang === 'uk' ? 'en' : 'uk');
$('shutter').onclick = snap;
$('flipBtn').onclick = flip;
$('paletteBtn').onclick = () => setPalette(state.palette + 1);
$('resSeg').onclick = e => { if (e.target.dataset.res) setRes(+e.target.dataset.res); };
$('bright').oninput = e => { state.bright = +e.target.value; persist(); };
$('contrast').oninput = e => { state.contrast = +e.target.value; persist(); };
$('bright').value = state.bright;
$('contrast').value = state.contrast;

document.addEventListener('keydown', e => {
  if (e.code === 'Space' && e.target.tagName !== 'INPUT') { e.preventDefault(); snap(); }
});
// On mobile the stream often dies after returning to the tab — restart it
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.stream &&
      state.stream.getVideoTracks().every(t => t.readyState === 'ended')) startCamera();
});

setLang(state.lang);
setPalette(state.palette);
setRes(state.res);
requestAnimationFrame(render);

// If permission was granted before, start the camera right away
navigator.permissions?.query({ name: 'camera' })
  .then(p => { if (p.state === 'granted') startCamera(); })
  .catch(() => {});
