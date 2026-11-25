import { jsPDF } from 'jspdf';
import './styles.css';
import { DICTS, LANGS, DEFAULT_LANG, isLang } from './i18n.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const KEY = 'stickywall:v1';
const PAPERS = { a4:{w:210,h:297}, letter:{w:215.9,h:279.4} };
const ADJ = { brightness:0, contrast:0, threshold:128, invert:false, grain:0.4, algo:'atkinson', htCell:1.6, htAngle:45, htShape:'dot' };
const DEF = {
  lang:DEFAULT_LANG,
  noteW:76, noteH:76, cols:5, rows:5, margin:2.5, mode:'hidden', paper:'a4', edge:6, gap:6, label:true,
  filter:'dither', ...ADJ, zoom:1, panX:0, panY:0, rot:0, view:'wall', tab:1, done:[], tplDone:false, sig:''
};
const LIMITS = { noteW:[20,300], noteH:[20,300], cols:[1,40], rows:[1,40], edge:[0,40], gap:[0,40],
  grain:[0.1,3], threshold:[0,255], htCell:[0.4,8], htAngle:[0,90], brightness:[-100,100], contrast:[-100,100] };

let S = Object.assign({}, DEF, (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch(e) { return {}; } })());
if (!isLang(S.lang)) S.lang = DEFAULT_LANG;
const tx = () => DICTS[S.lang];
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch(e) {} };

let img = null;
const work = document.createElement('canvas');
let workKx = 1, workKy = 1, workCapped = false;

/* ---------- storage for the image ---------- */
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('stickywall', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function idbSet(k, v) {
  try { const db = await idb(); await new Promise((res, rej) => { const t = db.transaction('kv','readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); } catch(e) {}
}
async function idbGet(k) {
  try { const db = await idb(); return await new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); } catch(e) { return null; }
}

/* ---------- geometry ---------- */
function clampMargin() {
  const max = Math.max(0, Math.min(S.noteW, S.noteH) / 2 - 5);
  if (S.margin > max) S.margin = Math.round(max * 2) / 2;
  if (S.margin < 0) S.margin = 0;
}
function geo() {
  const pw = S.noteW - 2 * S.margin, ph = S.noteH - 2 * S.margin;
  const hidden = S.mode === 'hidden';
  const spaceW = hidden ? S.cols * S.noteW : S.cols * pw;
  const spaceH = hidden ? S.rows * S.noteH : S.rows * ph;
  const tileRect = (c, r) => hidden
    ? { x:c * S.noteW + S.margin, y:r * S.noteH + S.margin, w:pw, h:ph }
    : { x:c * pw, y:r * ph, w:pw, h:ph };
  return { pw, ph, spaceW, spaceH, tileRect };
}
function layout() {
  const P = PAPERS[S.paper] || PAPERS.a4;
  const nw = S.noteW, nh = S.noteH;
  const nc = Math.floor((P.w - 2 * S.edge + S.gap) / (nw + S.gap));
  const nr = Math.floor((P.h - 2 * S.edge + S.gap) / (nh + S.gap));
  if (nc < 1 || nr < 1) return { P, err:tx().errFit };
  const gw = nc * nw + (nc - 1) * S.gap, gh = nr * nh + (nr - 1) * S.gap;
  const x0 = (P.w - gw) / 2, y0 = (P.h - gh) / 2;
  const slots = [];
  for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) slots.push({ x:x0 + c * (nw + S.gap), y:y0 + r * (nh + S.gap) });
  const tiles = [];
  for (let r = 0; r < S.rows; r++) for (let c = 0; c < S.cols; c++) tiles.push({ r, c });
  const passes = [];
  for (let i = 0; i < tiles.length; i += slots.length) passes.push(tiles.slice(i, i + slots.length));
  return { P, slots, passes, x0, y0, gw, gh };
}
const code = t => `${t.r + 1}-${t.c + 1}`;
const sigOf = () => [S.noteW, S.noteH, S.cols, S.rows, S.paper, S.edge, S.gap].join('|');

/* ---------- image transform ---------- */
function baseDims() {
  const rot = S.rot % 180 !== 0;
  return rot ? [img.naturalHeight, img.naturalWidth] : [img.naturalWidth, img.naturalHeight];
}
function imgTransform(g) {
  const [bw, bh] = baseDims();
  const base = Math.max(g.spaceW / bw, g.spaceH / bh);
  return { s:base * S.zoom, cx:g.spaceW / 2 + S.panX, cy:g.spaceH / 2 + S.panY };
}
function drawSource(ctx, k, ox, oy, g) {
  ctx.setTransform(1,0,0,1,0,0);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  if (!img) return;
  const t = imgTransform(g);
  ctx.setTransform(k, 0, 0, k, -ox * k, -oy * k);
  ctx.translate(t.cx, t.cy); ctx.rotate(S.rot * Math.PI / 180); ctx.scale(t.s, t.s);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  ctx.setTransform(1,0,0,1,0,0);
}

/* ---------- filters ---------- */
function adjustPixels(d, toGray) {
  const br = S.brightness * 2.55, cc = S.contrast * 2.55;
  const f = (259 * (cc + 255)) / (255 * (259 - cc));
  const inv = S.invert;
  for (let i = 0; i < d.length; i += 4) {
    let r = f * (d[i] - 128) + 128 + br, g = f * (d[i+1] - 128) + 128 + br, b = f * (d[i+2] - 128) + 128 + br;
    if (toGray) { const l = 0.299 * r + 0.587 * g + 0.114 * b; r = g = b = l; }
    if (inv) { r = 255 - r; g = 255 - g; b = 255 - b; }
    d[i] = r; d[i+1] = g; d[i+2] = b;
  }
}
const BAYER = (() => {
  let m = [[0]];
  while (m.length < 8) {
    const s = m.length, nm = [];
    for (let y = 0; y < 2 * s; y++) { nm[y] = []; for (let x = 0; x < 2 * s; x++) nm[y][x] = m[y % s][x % s] * 4 + [[0,2],[3,1]][Math.floor(y / s)][Math.floor(x / s)]; }
    m = nm;
  }
  return m.flat();
})();
function dither(id) {
  const w = id.width, h = id.height, d = id.data, L = new Float32Array(w * h);
  for (let i = 0, j = 0; j < L.length; i += 4, j++) L[j] = d[i];
  const T = S.threshold, algo = S.algo;
  if (algo === 'bayer') {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const j = y * w + x, t = (BAYER[(y & 7) * 8 + (x & 7)] + 0.5) / 64 * 255 + (T - 128);
      L[j] = L[j] > t ? 255 : 0;
    }
  } else if (algo === 'threshold') {
    for (let j = 0; j < L.length; j++) L[j] = L[j] >= T ? 255 : 0;
  } else {
    const add = (x, y, v) => { if (x >= 0 && x < w && y < h) L[y * w + x] += v; };
    const fs = algo === 'floyd';
    for (let y = 0; y < h; y++) {
      const ltr = (y & 1) === 0, dx = ltr ? 1 : -1;
      for (let k = 0; k < w; k++) {
        const x = ltr ? k : w - 1 - k, j = y * w + x, o = L[j], n = o < T ? 0 : 255, e = o - n;
        L[j] = n;
        if (fs) { add(x + dx, y, e * 7 / 16); add(x - dx, y + 1, e * 3 / 16); add(x, y + 1, e * 5 / 16); add(x + dx, y + 1, e / 16); }
        else { const e8 = e / 8; add(x + dx, y, e8); add(x + 2 * dx, y, e8); add(x - dx, y + 1, e8); add(x, y + 1, e8); add(x + dx, y + 1, e8); add(x, y + 2, e8); }
      }
    }
  }
  for (let i = 0, j = 0; j < L.length; i += 4, j++) { const v = L[j] > 127 ? 255 : 0; d[i] = d[i+1] = d[i+2] = v; d[i+3] = 255; }
}
function processId(id) {
  if (S.filter === 'original') adjustPixels(id.data, false);
  else { adjustPixels(id.data, true); if (S.filter === 'dither') dither(id); }
}

/* ---------- working canvas ---------- */
function buildWork() {
  const g = geo(), maxDim = Math.max(g.spaceW, g.spaceH);
  let k;
  workCapped = false;
  if (S.filter === 'dither') {
    k = 1 / S.grain;
    const cap = 4000 / maxDim;
    if (k > cap) { k = cap; workCapped = true; }
  } else if (S.filter === 'halftone') {
    buildGray(g);
    k = Math.min(7 / S.htCell, 3200 / maxDim);
  } else k = Math.min(8, 2200 / maxDim);
  const w = Math.max(1, Math.round(g.spaceW * k)), h = Math.max(1, Math.round(g.spaceH * k));
  work.width = w; work.height = h;
  const ctx = work.getContext('2d', { willReadFrequently:true });
  workKx = w / g.spaceW; workKy = h / g.spaceH;
  if (S.filter === 'halftone' && img) {
    const id = ctx.createImageData(w, h); halftoneInto(id, 0, 0, workKx, workKy); ctx.putImageData(id, 0, 0);
  } else {
    drawSource(ctx, k, 0, 0, g);
    if (img) { const id = ctx.getImageData(0, 0, w, h); processId(id); ctx.putImageData(id, 0, 0); }
  }
}

/* ---------- halftone (newspaper screen) ---------- */
let gray = null;
function buildGray(g) {
  const k = Math.min(8, 2400 / Math.max(g.spaceW, g.spaceH));
  const w = Math.max(1, Math.round(g.spaceW * k)), h = Math.max(1, Math.round(g.spaceH * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently:true });
  drawSource(ctx, k, 0, 0, g);
  const id = ctx.getImageData(0, 0, w, h); adjustPixels(id.data, true);
  const L = new Float32Array(w * h);
  for (let i = 0, j = 0; j < L.length; i += 4, j++) L[j] = id.data[i];
  gray = { L, w, h, kx:w / g.spaceW, ky:h / g.spaceH };
}
function halftoneInto(id, ox, oy, kx, ky) {
  const w = id.width, h = id.height, d = id.data, G = gray;
  const s = S.htCell, half = s / 2, a = S.htAngle * Math.PI / 180, co = Math.cos(a), si = Math.sin(a);
  const line = S.htShape === 'line';
  for (let py = 0; py < h; py++) {
    const Y = oy + (py + 0.5) / ky;
    for (let px = 0; px < w; px++) {
      const X = ox + (px + 0.5) / kx;
      const u = X * co + Y * si, v = -X * si + Y * co;
      const cu = (Math.floor(u / s) + 0.5) * s, cv = (Math.floor(v / s) + 0.5) * s;
      const Xc = cu * co - cv * si, Yc = cu * si + cv * co;
      let gx = Math.floor(Xc * G.kx), gy = Math.floor(Yc * G.ky);
      gx = gx < 0 ? 0 : gx >= G.w ? G.w - 1 : gx; gy = gy < 0 ? 0 : gy >= G.h ? G.h - 1 : gy;
      const dk = 1 - G.L[gy * G.w + gx] / 255;
      const x = (u - cu) / half, y = (v - cv) / half;
      let black;
      if (line) black = Math.abs(y) < dk;
      else {
        const ax = Math.abs(x), ay = Math.abs(y);
        const spot = ax + ay <= 1 ? 1 - (x * x + y * y) : (ax - 1) * (ax - 1) + (ay - 1) * (ay - 1) - 1;
        black = spot > 1 - 2 * dk;
      }
      const i = (py * w + px) * 4, v8 = black ? 0 : 255;
      d[i] = d[i + 1] = d[i + 2] = v8; d[i + 3] = 255;
    }
  }
}

/* ---------- preview ---------- */
const cv = $('#view');
let view = { p:1, ratio:1 };
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

function draw() {
  const rect = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  const W = Math.max(1, rect.width), H = Math.max(1, rect.height);
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const g = geo();
  const wallW = S.cols * S.noteW, wallH = S.rows * S.noteH;
  const pad = Math.min(36, W * 0.06);
  const accent = cssVar('--accent') || '#0A78B5';

  if (S.view === 'overlay') {
    const p = Math.min((W - 2 * pad) / g.spaceW, (H - 2 * pad) / g.spaceH);
    const ox = (W - g.spaceW * p) / 2, oy = (H - g.spaceH * p) / 2;
    view = { p, ratio:1 };
    if (img) {
      const t = imgTransform(g);
      ctx.save(); ctx.globalAlpha = 0.3;
      ctx.translate(ox, oy); ctx.scale(p, p); ctx.translate(t.cx, t.cy); ctx.rotate(S.rot * Math.PI / 180); ctx.scale(t.s, t.s);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      ctx.restore();
    }
    ctx.imageSmoothingEnabled = !(S.filter === 'dither' && p / workKx >= 1.5);
    ctx.drawImage(work, ox, oy, g.spaceW * p, g.spaceH * p);
    if (S.mode === 'hidden' && S.margin > 0) {
      ctx.beginPath();
      for (let r = 0; r < S.rows; r++) for (let c = 0; c < S.cols; c++) {
        const tr = g.tileRect(c, r);
        ctx.rect(ox + c * S.noteW * p, oy + r * S.noteH * p, S.noteW * p, S.noteH * p);
        ctx.rect(ox + tr.x * p, oy + tr.y * p, tr.w * p, tr.h * p);
      }
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fill('evenodd');
    }
    ctx.strokeStyle = accent; ctx.lineWidth = 1;
    const cw = S.mode === 'hidden' ? S.noteW : g.pw, ch = S.mode === 'hidden' ? S.noteH : g.ph;
    ctx.beginPath();
    for (let c = 0; c <= S.cols; c++) { const x = Math.round(ox + c * cw * p) + .5; ctx.moveTo(x, oy); ctx.lineTo(x, oy + g.spaceH * p); }
    for (let r = 0; r <= S.rows; r++) { const y = Math.round(oy + r * ch * p) + .5; ctx.moveTo(ox, y); ctx.lineTo(ox + g.spaceW * p, y); }
    ctx.stroke();
    return;
  }

  const p = Math.min((W - 2 * pad) / wallW, (H - 2 * pad) / wallH);
  const ox = (W - wallW * p) / 2, oy = (H - wallH * p) / 2;
  view = { p, ratio:g.spaceW / wallW };
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.fillRect(ox + 2, oy + 3, wallW * p, wallH * p);

  if (S.view === 'map') {
    const L = layout(), passOf = {};
    if (!L.err) L.passes.forEach((ps, i) => ps.forEach((t, si) => passOf[code(t)] = [i, si]));
    const fs = Math.max(9, Math.min(S.noteW, S.noteH) * p * 0.22);
    for (let r = 0; r < S.rows; r++) for (let c = 0; c < S.cols; c++) {
      const x = ox + c * S.noteW * p, y = oy + r * S.noteH * p, info = passOf[`${r+1}-${c+1}`];
      ctx.fillStyle = info ? `hsl(${(info[0] * 67) % 360} 55% 92%)` : '#fff';
      ctx.fillRect(x, y, S.noteW * p, S.noteH * p);
      ctx.fillStyle = '#1b1f23'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `600 ${fs}px Onest, system-ui, sans-serif`;
      ctx.fillText(`${r+1}-${c+1}`, x + S.noteW * p / 2, y + S.noteH * p / 2 - fs * 0.25);
      if (info && fs * 0.5 >= 7) {
        ctx.font = `500 ${fs * 0.45}px Onest, system-ui, sans-serif`; ctx.fillStyle = '#5e666f';
        ctx.fillText(tx().mapPass(info[0] + 1), x + S.noteW * p / 2, y + S.noteH * p / 2 + fs * 0.6);
      }
    }
  } else {
    for (let r = 0; r < S.rows; r++) for (let c = 0; c < S.cols; c++) {
      const x = ox + c * S.noteW * p, y = oy + r * S.noteH * p;
      ctx.fillStyle = '#fff'; ctx.fillRect(x, y, S.noteW * p, S.noteH * p);
      const tr = g.tileRect(c, r);
      ctx.imageSmoothingEnabled = !(S.filter === 'dither' && p / workKx >= 1.5);
      ctx.drawImage(work, tr.x * workKx, tr.y * workKy, tr.w * workKx, tr.h * workKy,
        x + S.margin * p, y + S.margin * p, g.pw * p, g.ph * p);
    }
  }
  ctx.strokeStyle = 'rgba(0,0,0,.16)'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 0; c <= S.cols; c++) { const x = Math.round(ox + c * S.noteW * p) + .5; ctx.moveTo(x, oy); ctx.lineTo(x, oy + wallH * p); }
  for (let r = 0; r <= S.rows; r++) { const y = Math.round(oy + r * S.noteH * p) + .5; ctx.moveTo(ox, y); ctx.lineTo(ox + wallW * p, y); }
  ctx.stroke();
}

let raf = 0, dirty = true, passesDirty = true;
function schedule(rebuild = true) {
  if (rebuild) { dirty = true; passesDirty = true; }
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    if (dirty) { buildWork(); dirty = false; }
    draw();
    if (S.tab === 3 && passesDirty) { renderPasses(); passesDirty = false; }
    updateGrainHint();
  });
}
new ResizeObserver(() => schedule(false)).observe(cv);

/* drag + wheel */
let drag = null;
cv.addEventListener('pointerdown', e => {
  if (!img || S.view === 'map') return;
  drag = { x:e.clientX, y:e.clientY, px:S.panX, py:S.panY };
  cv.setPointerCapture(e.pointerId); cv.classList.add('dragging');
});
cv.addEventListener('pointermove', e => {
  if (!drag) return;
  const f = view.ratio / view.p;
  S.panX = drag.px + (e.clientX - drag.x) * f;
  S.panY = drag.py + (e.clientY - drag.y) * f;
  schedule();
});
const endDrag = () => { if (drag) { drag = null; cv.classList.remove('dragging'); persist(); } };
cv.addEventListener('pointerup', endDrag);
cv.addEventListener('pointercancel', endDrag);
cv.addEventListener('wheel', e => {
  if (!img) return;
  e.preventDefault();
  S.zoom = Math.min(4, Math.max(0.2, S.zoom * Math.exp(-e.deltaY * 0.0015)));
  syncZoom(); persist(); schedule();
}, { passive:false });

/* ---------- UI ---------- */
function syncZoom() { $('#zoom').value = Math.round(S.zoom * 100); $('#zoomOut').textContent = Math.round(S.zoom * 100) + '%'; }
const fmt = (n, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toString().replace('.', tx().decimal);

function checkSig() {
  const s = sigOf();
  if (S.sig !== s) { S.sig = s; S.done = []; S.tplDone = false; }
}

function updateUI() {
  clampMargin(); checkSig();
  $$('[data-tab]').forEach(b => b.setAttribute('aria-selected', String(+b.dataset.tab === S.tab)));
  $$('[data-pane]').forEach(p => p.hidden = +p.dataset.pane !== S.tab);
  $$('[data-seg]').forEach(seg => seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', S[seg.dataset.seg] === b.dataset.v)));
  $$('[data-k]').forEach(el => {
    if (el === document.activeElement && el.type === 'number') return;
    if (el.type === 'checkbox') el.checked = !!S[el.dataset.k];
    else el.value = S[el.dataset.k];
  });
  $$('[data-out]').forEach(o => { const k = o.dataset.out; o.textContent = k === 'grain' ? fmt(S[k], 2) : k === 'htCell' ? fmt(S[k], 1) : S[k]; });
  syncZoom();
  const pv = `${S.noteW}x${S.noteH}`;
  $('#preset').value = [...$('#preset').options].some(o => o.value === pv) ? pv : 'custom';
  const g = geo();
  $('#printSize').textContent = tx().printSize(fmt(g.pw), fmt(g.ph), fmt(S.noteW), fmt(S.noteH));
  $('#modeHint').textContent = S.mode === 'hidden'
    ? tx().modeHidden : tx().modeSpread;
  $('#ditherGroup').hidden = S.filter !== 'dither';
  $('#htGroup').hidden = S.filter !== 'halftone';
  $('#empty').hidden = !!img;

  const L = layout(), total = S.cols * S.rows;
  const wall = tx().wall(fmt(S.cols * S.noteW / 10), fmt(S.rows * S.noteH / 10));
  if (L.err) {
    $('#summary').innerHTML = `<span class="warn" style="margin:0">${L.err}</span>`;
    $('#stageInfo').textContent = wall;
  } else {
    const n = L.passes.length;
    $('#summary').innerHTML = `<strong>${wall}</strong><br>${tx().summary(tx().notes(total), L.slots.length, tx().passes(n))}`;
    $('#stageInfo').textContent = `${wall}, ${tx().notes(total)}, ${tx().passes(n)}`;
  }
}
function updateGrainHint() {
  const h = $('#grainHint');
  if (S.filter === 'dither' && workCapped) {
    h.className = 'warn';
    h.textContent = tx().grainCapped(fmt(1 / workKx, 2));
  } else { h.className = 'hint'; h.textContent = tx().grainHint; }
}

function setVal(k, raw, el) {
  let v;
  if (el && el.type === 'checkbox') v = el.checked;
  else if (typeof DEF[k] === 'number') {
    v = parseFloat(String(raw).replace(',', '.'));
    if (!isFinite(v)) return;
    if (LIMITS[k]) v = Math.min(LIMITS[k][1], Math.max(LIMITS[k][0], v));
    if (k === 'cols' || k === 'rows') v = Math.round(v);
  } else v = raw;
  S[k] = v;
  persist(); updateUI(); schedule();
}
$$('[data-k]').forEach(el => {
  const ev = el.type === 'number' ? 'change' : 'input';
  el.addEventListener(ev, () => setVal(el.dataset.k, el.value, el));
  if (el.type === 'number') el.addEventListener('input', () => {
    const v = parseFloat(el.value); if (isFinite(v) && v > 0) { const k = el.dataset.k;
      if (LIMITS[k] && (v < LIMITS[k][0] || v > LIMITS[k][1])) return;
      S[k] = (k === 'cols' || k === 'rows') ? Math.round(v) : v; clampMargin(); checkSig(); persist(); updateUI(); schedule(); }
  });
});
$$('[data-seg]').forEach(seg => seg.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  S[seg.dataset.seg] = b.dataset.v; persist(); updateUI(); schedule(seg.dataset.seg !== 'view');
}));
$$('[data-tab]').forEach(b => b.addEventListener('click', () => { S.tab = +b.dataset.tab; persist(); updateUI(); schedule(false); passesDirty = true; }));
$$('[data-go]').forEach(b => b.addEventListener('click', () => { S.tab = +b.dataset.go; persist(); updateUI(); passesDirty = true; schedule(false); $('.panel').scrollTop = 0; }));
$('#preset').addEventListener('change', e => {
  if (e.target.value === 'custom') return;
  const [w, h] = e.target.value.split('x').map(Number);
  S.noteW = w; S.noteH = h; persist(); updateUI(); schedule();
});
$('#zoom').addEventListener('input', e => { S.zoom = +e.target.value / 100; syncZoom(); persist(); schedule(); });
$('#fitCover').addEventListener('click', () => { S.zoom = 1; S.panX = 0; S.panY = 0; persist(); updateUI(); schedule(); });
$('#fitContain').addEventListener('click', () => {
  if (!img) return;
  const g = geo(), [bw, bh] = baseDims();
  S.zoom = Math.min(g.spaceW / bw, g.spaceH / bh) / Math.max(g.spaceW / bw, g.spaceH / bh);
  S.panX = 0; S.panY = 0; persist(); updateUI(); schedule();
});
$('#rotate').addEventListener('click', () => { S.rot = (S.rot + 90) % 360; S.panX = 0; S.panY = 0; persist(); schedule(); });
$('#resetAdj').addEventListener('click', () => { Object.assign(S, ADJ); persist(); updateUI(); schedule(); });

/* ---------- loading images ---------- */
async function setImageBlob(blob, fresh) {
  const url = URL.createObjectURL(blob);
  const im = new Image();
  try {
    await new Promise((res, rej) => { im.onload = res; im.onerror = rej; im.src = url; });
  } catch (e) { toast(tx().errOpen); return; }
  img = im;
  if (fresh) {
    S.zoom = 1; S.panX = 0; S.panY = 0; S.rot = 0;
    if (S.tab === 1) S.tab = 2;
    persist(); idbSet('image', blob);
  }
  updateUI(); schedule();
}
const onFile = e => { const f = e.target.files && e.target.files[0]; if (f) setImageBlob(f, true); e.target.value = ''; };
$('#file').addEventListener('change', onFile);
$('#file2').addEventListener('change', onFile);
let dragDepth = 0;
window.addEventListener('dragenter', e => { e.preventDefault(); dragDepth++; document.body.classList.add('dropping'); });
window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; document.body.classList.remove('dropping'); } });
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', e => {
  e.preventDefault(); dragDepth = 0; document.body.classList.remove('dropping');
  const f = [...(e.dataTransfer.files || [])].find(f => f.type.startsWith('image/'));
  if (f) setImageBlob(f, true); else toast(tx().errDrop);
});

/* ---------- toast ---------- */
let toastT = 0;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3200); }

/* ---------- PDF ---------- */
function textImg(str, hmm, color = '#6b7178', weight = 500) {
  const k = 11.811, px = Math.round(hmm * k);
  const c = document.createElement('canvas'), ctx = c.getContext('2d');
  const font = `${weight} ${px}px Onest, system-ui, sans-serif`;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(str).width) + 4;
  c.width = w; c.height = Math.ceil(px * 1.4);
  ctx.font = font; ctx.fillStyle = color; ctx.textBaseline = 'middle';
  ctx.fillText(str, 2, c.height / 2);
  return { url:c.toDataURL('image/png'), w:w / k, h:c.height / k };
}
function putText(doc, str, cx, cy, hmm, color, weight) {
  const t = textImg(str, hmm, color, weight);
  doc.addImage(t.url, 'PNG', cx - t.w / 2, cy - t.h / 2, t.w, t.h);
}
function newDoc(P) {
  return new jsPDF({ unit:'mm', format:[P.w, P.h], orientation:'portrait', compress:true });
}
async function makeTemplate() {
  const L = layout(); await document.fonts.ready;
  const doc = newDoc(L.P);
  drawTemplate(doc, L);
  return doc.output('blob');
}
function drawTemplate(doc, L) {
  L.slots.forEach((s, i) => {
    doc.setLineWidth(0.25); doc.setDrawColor(110);
    doc.rect(s.x, s.y, S.noteW, S.noteH);
    doc.setLineWidth(0.3); doc.setDrawColor(60);
    const t = Math.min(2.5, S.gap / 2 - 0.3);
    if (t > 0.4) {
      [[s.x, s.y], [s.x + S.noteW, s.y], [s.x, s.y + S.noteH], [s.x + S.noteW, s.y + S.noteH]].forEach(([x, y], j) => {
        const sx = j % 2 ? 1 : -1, sy = j < 2 ? -1 : 1;
        doc.line(x, y, x + sx * t, y); doc.line(x, y, x, y + sy * t);
      });
    }
    doc.setTextColor(200); doc.setFontSize(Math.min(48, S.noteH * 0.9));
    doc.text(String(i + 1), s.x + S.noteW / 2, s.y + S.noteH / 2, { align:'center', baseline:'middle' });
    putText(doc, tx().pdfSticky, s.x + S.noteW / 2, s.y + 4.2, Math.min(3, S.noteW / 20), '#8a9097');
  });
  const top = L.y0, bottom = L.P.h - L.y0 - L.gh;
  if (top >= 9) putText(doc, tx().pdfFeed, L.P.w / 2, top / 2, 3.2, '#4a5056');
  if (bottom >= 13) {
    const y = L.P.h - bottom / 2 - 1.5, x0 = (L.P.w - 100) / 2;
    doc.setDrawColor(40); doc.setLineWidth(0.25);
    doc.line(x0, y, x0 + 100, y);
    for (let i = 0; i <= 10; i++) doc.line(x0 + i * 10, y, x0 + i * 10, y - (i % 5 === 0 ? 3 : 1.6));
    putText(doc, tx().pdfRuler, L.P.w / 2, y + 3.4, 2.8, '#4a5056');
  }
}
function tileImage(t, g) {
  const tr = g.tileRect(t.c, t.r), k = 300 / 25.4;
  const w = Math.max(1, Math.round(tr.w * k)), h = Math.max(1, Math.round(tr.h * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently:true });
  if (S.filter === 'dither') {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(work, tr.x * workKx, tr.y * workKy, tr.w * workKx, tr.h * workKy, 0, 0, w, h);
    return { data:c.toDataURL('image/png'), fmt:'PNG' };
  }
  if (S.filter === 'halftone' && img) {
    if (!gray) buildGray(g);
    const id = ctx.createImageData(w, h); halftoneInto(id, tr.x, tr.y, w / tr.w, h / tr.h); ctx.putImageData(id, 0, 0);
    return { data:c.toDataURL('image/png'), fmt:'PNG' };
  }
  drawSource(ctx, k, tr.x, tr.y, g);
  if (img) { const id = ctx.getImageData(0, 0, w, h); processId(id); ctx.putImageData(id, 0, 0); }
  return { data:c.toDataURL('image/jpeg', 0.92), fmt:'JPEG' };
}
function addPassPage(doc, L, pi, g) {
  L.passes[pi].forEach((t, i) => {
    const s = L.slots[i], im = tileImage(t, g);
    doc.addImage(im.data, im.fmt, s.x + S.margin, s.y + S.margin, g.pw, g.ph, undefined, 'FAST');
    if (S.label && S.margin >= 1.2) {
      const fs = Math.min(7, (S.margin * 0.6) / (0.7 * 0.3528));
      doc.setFontSize(fs); doc.setTextColor(165);
      doc.text(code(t), s.x + S.noteW - S.margin, s.y + S.noteH - S.margin * 0.3, { align:'right' });
    }
  });
}
async function makePasses(indices, withTemplate) {
  if (dirty) { buildWork(); dirty = false; }
  await document.fonts.ready;
  const L = layout(), g = geo(), doc = newDoc(L.P);
  if (withTemplate) drawTemplate(doc, L);
  indices.forEach((pi, n) => { if (n > 0 || withTemplate) doc.addPage([L.P.w, L.P.h], 'portrait'); addPassPage(doc, L, pi, g); });
  return doc.output('blob');
}
function saveFile(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
async function busy(btn, fn) {
  const L = layout(); if (L.err) { toast(L.err); return; }
  const label = btn.textContent; btn.disabled = true; btn.textContent = tx().making;
  await new Promise(r => setTimeout(r, 30));
  try { await fn(); } catch (e) { console.error(e); toast(tx().errPdf); }
  btn.disabled = false; btn.textContent = label;
}
$('#dlAll').addEventListener('click', e => {
  if (!img) { toast(tx().needImage); return; }
  busy(e.currentTarget, async () => { const L = layout(); saveFile('sticky-grid-and-passes.pdf', await makePasses(L.passes.map((_, i) => i), true)); });
});
$('#resetDone').addEventListener('click', () => { S.done = []; S.tplDone = false; persist(); passesDirty = true; schedule(false); });

/* ---------- pass list ---------- */
function renderPasses() {
  const list = $('#passes'), L = layout();
  list.innerHTML = '';
  if (L.err) { $('#passTitle').textContent = ''; list.innerHTML = `<li class="warn">${L.err}</li>`; return; }
  const n = L.passes.length, doneN = L.passes.filter((_, i) => S.done[i]).length;
  $('#passTitle').textContent = tx().passTitle(S.tplDone, doneN, n);
  const cur = S.tplDone ? L.passes.findIndex((_, i) => !S.done[i]) : -1;
  const g = geo(), dpr = window.devicePixelRatio || 1;
  const tli = document.createElement('li');
  tli.className = 'pass' + (S.tplDone ? ' done' : ' current');
  const tb = document.createElement('div');
  tb.innerHTML = `<h3>${tx().tplTitle}</h3><p>${tx().tplText}</p>
    <div class="btnrow"><button class="btn${S.tplDone ? '' : ' primary'}" data-tpl>${tx().download}</button>
    <label class="check"><input type="checkbox" data-tpldone${S.tplDone ? ' checked' : ''}> ${tx().printed}</label></div>`;
  tli.append(miniPage(L, dpr), tb); list.append(tli);
  L.passes.forEach((tiles, i) => {
    const li = document.createElement('li');
    li.className = 'pass' + (S.done[i] ? ' done' : '') + (i === cur ? ' current' : '');
    const mc = miniPage(L, dpr, tiles, g);
    const body = document.createElement('div');
    const map = tiles.map((t, si) => `${si + 1}→${code(t)}`).join(', ');
    body.innerHTML = `<h3>${tx().passHead(i + 1, n)}</h3><p>${tx().passMap(map)}</p>
      <div class="btnrow"><button class="btn${i === cur ? ' primary' : ''}" data-dl="${i}">${tx().download}</button>
      <label class="check"><input type="checkbox" data-done="${i}"${S.done[i] ? ' checked' : ''}> ${tx().printed}</label></div>`;
    li.append(mc, body); list.append(li);
  });
}
function miniPage(L, dpr, tiles, g) {
  const mc = document.createElement('canvas');
  const cw = 84, chh = Math.round(cw * L.P.h / L.P.w), k = cw / L.P.w;
  mc.width = cw * dpr; mc.height = chh * dpr; mc.style.height = chh + 'px';
  const x = mc.getContext('2d'); x.scale(dpr, dpr);
  x.fillStyle = '#fff'; x.fillRect(0, 0, cw, chh);
  x.strokeStyle = 'rgba(0,0,0,.25)'; x.strokeRect(.5, .5, cw - 1, chh - 1);
  L.slots.forEach((s, si) => {
    if (!tiles) {
      x.strokeStyle = 'rgba(0,0,0,.5)'; x.strokeRect(s.x * k + .5, s.y * k + .5, S.noteW * k - 1, S.noteH * k - 1);
      x.fillStyle = 'rgba(0,0,0,.35)'; x.font = '600 9px Onest, system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(String(si + 1), (s.x + S.noteW / 2) * k, (s.y + S.noteH / 2) * k);
      return;
    }
    x.fillStyle = '#eef0f2'; x.fillRect(s.x * k, s.y * k, S.noteW * k, S.noteH * k);
    const t = tiles[si]; if (!t) return;
    const tr = g.tileRect(t.c, t.r);
    x.imageSmoothingEnabled = true;
    x.drawImage(work, tr.x * workKx, tr.y * workKy, tr.w * workKx, tr.h * workKy, (s.x + S.margin) * k, (s.y + S.margin) * k, g.pw * k, g.ph * k);
  });
  return mc;
}
$('#passes').addEventListener('click', e => {
  const tb = e.target.closest('[data-tpl]');
  if (tb) { busy(tb, async () => saveFile('sticky-grid.pdf', await makeTemplate())); return; }
  const b = e.target.closest('[data-dl]'); if (!b) return;
  if (!img) { toast(tx().needImage); return; }
  const i = +b.dataset.dl, n = layout().passes.length;
  busy(b, async () => saveFile(`sticky-pass-${i + 1}-of-${n}.pdf`, await makePasses([i])));
});
$('#passes').addEventListener('change', e => {
  if (e.target.matches('[data-tpldone]')) { S.tplDone = e.target.checked; persist(); passesDirty = true; schedule(false); return; }
  const c = e.target.closest('[data-done]'); if (!c) return;
  S.done[+c.dataset.done] = c.checked; persist(); passesDirty = true; schedule(false);
});

/* ---------- language ---------- */
function applyLang() {
  const d = tx();
  document.documentElement.lang = S.lang;
  document.title = d.title;
  $$('[data-i18n]').forEach(el => { const v = d[el.dataset.i18n]; if (typeof v === 'string') el.textContent = v; });
  $$('[data-i18n-aria]').forEach(el => { const v = d[el.dataset.i18nAria]; if (typeof v === 'string') el.setAttribute('aria-label', v); });
  $('#lang').querySelectorAll('button').forEach(b => {
    const on = b.dataset.lang === S.lang;
    b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
  });
}
$('#lang').innerHTML = LANGS.map(l => `<button type="button" data-lang="${l.code}" lang="${l.code}" title="${l.name}">${l.label}</button>`).join('');
$('#lang').addEventListener('click', e => {
  const b = e.target.closest('[data-lang]'); if (!b || b.dataset.lang === S.lang) return;
  S.lang = b.dataset.lang; persist(); applyLang(); updateUI(); passesDirty = true; schedule(false);
});

/* ---------- start ---------- */
applyLang();
if (!S.sig) S.sig = sigOf();
updateUI(); schedule();
idbGet('image').then(b => { if (b) setImageBlob(b, false); });
document.fonts && document.fonts.ready.then(() => schedule(false));
