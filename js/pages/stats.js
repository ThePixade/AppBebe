import { store, activeChild, eventsOf } from '../store.js';
import { icon } from '../icons.js';
import { esc, fmtNum, ago, startOfDay, emptyState, DAY, $, $$ } from '../ui.js';
import { appHeader } from '../profiles.js';

/*
 * Statistiques : moyennes par jour et graphiques (repas, couches, sommeil, rythme sur 24 h).
 * Les moyennes portent sur les journées complètes (hier et avant) ; la journée en cours
 * est affichée dans les graphiques, avec un repère « auj. ».
 */

const RANGES = [[7, '7 jours'], [14, '14 jours'], [30, '30 jours']];
let range = 7;
const charts = new Map(); // id -> données des info-bulles

const H = 3600e3;
const overlap = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
const WD = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const fmtH = (ms) => { const m = Math.round(ms / 60000); const h = Math.floor(m / 60); return h ? `${h} h${m % 60 ? ` ${String(m % 60).padStart(2, '0')}` : ''}` : `${m} min`; };
const avg = (arr, f) => (arr.length ? arr.reduce((a, d) => a + f(d), 0) / arr.length : 0);

/* ---------- Calculs ---------- */
function dayStarts(n, end = startOfDay()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(startOfDay(end - i * DAY + 3 * H)); // +3 h : robuste aux changements d'heure
  return out.map((d, i) => (i === n - 1 ? end : startOfDay(d)));
}

function sleepsOf(s, c) {
  const list = eventsOf(s, c.id).filter((e) => e.type === 'sleep').map((e) => ({ at: e.at, end: e.end }));
  const running = s.timers.sleep?.[c.id];
  if (running) list.push({ at: running, end: Date.now(), running: true });
  return list;
}

function computeDay(d0, evs, sleeps) {
  const d1 = d0 + DAY;
  const inDay = evs.filter((e) => e.at >= d0 && e.at < d1);
  const feeds = inDay.filter((e) => e.type === 'feed');
  const breast = feeds.filter((e) => e.kind === 'breast');
  const bottle = feeds.filter((e) => e.kind === 'bottle');
  const diapers = inDay.filter((e) => e.type === 'diaper');
  let night = 0, naps = 0, napCount = 0, longest = 0;
  for (const sl of sleeps) {
    const tot = overlap(sl.at, sl.end, d0, d1);
    if (!tot) continue;
    // Nuit : 19 h → 7 h ; journée : 7 h → 19 h
    const n = overlap(sl.at, sl.end, d0, d0 + 7 * H) + overlap(sl.at, sl.end, d0 + 19 * H, d1);
    night += n; naps += tot - n;
    if (sl.at >= d0 + 7 * H && sl.at < d0 + 19 * H) napCount++;
    if (sl.at >= d0 && sl.at < d1) longest = Math.max(longest, sl.end - sl.at);
  }
  const times = feeds.map((e) => e.at).sort((a, b) => a - b);
  return {
    d0,
    feeds: feeds.length, breast: breast.length, bottle: bottle.length,
    ml: bottle.reduce((a, e) => a + (e.ml || 0), 0),
    breastMs: breast.reduce((a, e) => a + (e.L || 0) + (e.R || 0), 0),
    L: breast.reduce((a, e) => a + (e.L || 0), 0), R: breast.reduce((a, e) => a + (e.R || 0), 0),
    gaps: times.slice(1).map((t, i) => t - times[i]),
    wet: diapers.filter((e) => e.kind === 'wet').length,
    dirty: diapers.filter((e) => e.kind === 'dirty').length,
    mixed: diapers.filter((e) => e.kind === 'mixed').length,
    diapers: diapers.length,
    night, naps, sleep: night + naps, napCount, longest,
    feedTimes: times,
    sleeps: sleeps.filter((sl) => overlap(sl.at, sl.end, d0, d1)).map((sl) => [Math.max(sl.at, d0) - d0, Math.min(sl.end, d1) - d0, sl.running]),
    hasData: feeds.length > 0 || diapers.length > 0 || night + naps > 0, // jour réellement suivi
  };
}

function summarize(days) {
  const gaps = days.flatMap((d) => d.gaps);
  const breastN = days.reduce((a, d) => a + d.breast, 0), bottleN = days.reduce((a, d) => a + d.bottle, 0);
  const L = days.reduce((a, d) => a + d.L, 0), R = days.reduce((a, d) => a + d.R, 0);
  const longest = days.filter((d) => d.longest);
  return {
    n: days.length,
    feeds: avg(days, (d) => d.feeds), ml: avg(days, (d) => d.ml), diapers: avg(days, (d) => d.diapers),
    sleep: avg(days, (d) => d.sleep), night: avg(days, (d) => d.night), naps: avg(days, (d) => d.naps),
    napCount: avg(days, (d) => d.napCount),
    dirty: avg(days, (d) => d.dirty + d.mixed), wet: avg(days, (d) => d.wet + d.mixed),
    gap: gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0,
    breastAvg: breastN ? days.reduce((a, d) => a + d.breastMs, 0) / breastN : 0,
    bottleAvg: bottleN ? days.reduce((a, d) => a + d.ml, 0) / bottleN : 0,
    breastN, bottleN,
    leftPct: L + R ? Math.round((L / (L + R)) * 100) : null,
    longest: avg(longest, (d) => d.longest),
  };
}

/* ---------- Graphique en barres empilées (SVG) ---------- */
/** Graduations « rondes » : 3 à 4 lignes, en unités entières (repas, ml, heures). */
function axis(v, scale = 1) {
  const u = Math.max(v / scale, 1);
  const cands = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100, 120, 150, 200, 250, 300, 400, 500, 1000];
  const st = cands.find((c) => u / c <= 4) || 1000;
  const max = Math.ceil(u / st) * st;
  const ticks = [];
  for (let t = 0; t <= max + 1e-9; t += st) ticks.push(t * scale);
  return { max: max * scale, ticks };
}

function barChart(id, days, series, { fmt = (v) => fmtNum(v), axisFmt = fmt, unit = '', scale = 1, avgValue = null, avgLabel = '' }) {
  const W = 340, Hh = 168, padL = 30, padR = 6, padT = 10, padB = 22;
  const total = (d) => series.reduce((a, s) => a + s.get(d), 0);
  const { max, ticks } = axis(Math.max(...days.map(total), avgValue || 0), scale);
  const n = days.length;
  const slot = (W - padL - padR) / n;
  const bw = Math.max(3, Math.min(22, slot * 0.62));
  const y = (v) => padT + (Hh - padT - padB) * (1 - v / max);
  const today = startOfDay();
  const r = Math.min(4, bw / 2);

  const bars = days.map((d, i) => {
    const cx = padL + slot * i + slot / 2, x = cx - bw / 2;
    let acc = 0;
    const segs = [];
    const vis = series.filter((s) => s.get(d) > 0);
    vis.forEach((s, k) => {
      const v = s.get(d);
      const y0 = y(acc), y1 = y(acc + v);
      acc += v;
      const top = k === vis.length - 1;
      const gap = k > 0 ? 2 : 0; // 2 px d'espace entre segments empilés
      const h = Math.max(0, y0 - y1 - gap);
      if (h <= 0) return;
      const yy = y1;
      segs.push(top
        ? `<path d="M${x},${yy + h} V${yy + r} Q${x},${yy} ${x + r},${yy} H${x + bw - r} Q${x + bw},${yy} ${x + bw},${yy + r} V${yy + h} Z" style="fill:var(${s.color})"/>`
        : `<rect x="${x}" y="${yy}" width="${bw}" height="${h}" style="fill:var(${s.color})"/>`);
    });
    const isToday = d.d0 === today;
    const showLabel = n <= 7 || i % Math.ceil(n / 7) === (n - 1) % Math.ceil(n / 7);
    const dt = new Date(d.d0);
    const lbl = n <= 7 ? WD[dt.getDay()] : `${dt.getDate()}`;
    return `<g class="bar ${isToday ? 'is-today' : ''}" data-i="${i}">
      ${segs.join('')}
      ${showLabel ? `<text x="${cx}" y="${Hh - 6}" text-anchor="middle" class="xl ${isToday ? 'b' : ''}">${isToday ? 'auj.' : lbl}</text>` : ''}
      <rect class="hit" x="${padL + slot * i}" y="${padT}" width="${slot}" height="${Hh - padT - padB + 4}"/>
    </g>`;
  }).join('');

  charts.set(id, {
    days, unit,
    rows: days.map((d) => ({
      date: d.d0 === today ? "Aujourd'hui" : new Date(d.d0).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }),
      items: series.map((s) => [s.label, fmt(s.get(d)), s.color]),
      total: series.length > 1 ? fmt(total(d)) : null,
    })),
    slot, padL, W,
  });

  return `
    <div class="bchart" data-chart="${id}">
      <svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="${esc(series.map((s) => s.label).join(', '))} par jour">
        <g class="grid">${ticks.map((t) => `<line x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}"/><text x="${padL - 6}" y="${y(t) + 3.5}" text-anchor="end">${axisFmt(t)}</text>`).join('')}</g>
        ${bars}
        ${avgValue ? `<g class="avg"><line x1="${padL}" x2="${W - padR}" y1="${y(avgValue)}" y2="${y(avgValue)}"/><text x="${W - padR}" y="${y(avgValue) - 5}" text-anchor="end">${esc(avgLabel)}</text></g>` : ''}
      </svg>
      <div class="chart-tip" hidden></div>
    </div>`;
}

const legend = (series) => series.length > 1
  ? `<div class="legend">${series.map((s) => `<span><i style="background:var(${s.color})"></i>${s.label}</span>`).join('')}</div>` : '';

/* ---------- Rythme sur 24 h ---------- */
function rhythm(days) {
  const W = 340, rowH = 22, padL = 34, padT = 4, padB = 18;
  const list = days.slice(-7);
  const Hh = padT + list.length * rowH + padB;
  const x = (ms) => padL + ((W - padL - 4) * ms) / DAY;
  const today = startOfDay();
  const rows = list.map((d, i) => {
    const y0 = padT + i * rowH;
    const dt = new Date(d.d0);
    return `
      <text x="${padL - 8}" y="${y0 + rowH / 2 + 3.5}" text-anchor="end" class="xl ${d.d0 === today ? 'b' : ''}">${d.d0 === today ? 'auj.' : `${WD[dt.getDay()]} ${dt.getDate()}`}</text>
      <rect x="${padL}" y="${y0 + 4}" width="${W - padL - 4}" height="${rowH - 8}" rx="4" class="track"/>
      ${d.sleeps.map(([a, b, run]) => `<rect x="${x(a)}" y="${y0 + 4}" width="${Math.max(2, x(b) - x(a))}" height="${rowH - 8}" rx="3" class="sl ${run ? 'run' : ''}"><title>Sommeil ${fmtH(b - a)}</title></rect>`).join('')}
      ${d.feedTimes.map((t) => `<circle cx="${x(t - d.d0)}" cy="${y0 + rowH / 2}" r="4" class="fd"><title>Repas</title></circle>`).join('')}`;
  }).join('');
  const hours = [0, 6, 12, 18, 24];
  return `
    <div class="rhythm">
      <svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Rythme de sommeil et de repas sur 24 heures">
        ${hours.map((h) => `<line x1="${x(h * H)}" x2="${x(h * H)}" y1="${padT}" y2="${Hh - padB + 2}" class="hl"/><text x="${x(h * H)}" y="${Hh - 4}" text-anchor="middle" class="xl">${h} h</text>`).join('')}
        ${rows}
      </svg>
    </div>
    <div class="legend"><span><i style="background:var(--ch-slate)"></i>Sommeil</span><span><i class="dot" style="background:var(--ch-salmon)"></i>Repas</span></div>`;
}

/* ---------- Rendu ---------- */
function delta(cur, prev, { invert = false, unitFmt } = {}) {
  if (!prev || !cur) return '';
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (Math.abs(pct) < 5) return `<span class="delta">stable</span>`;
  return `<span class="delta">${pct > 0 ? '↑' : '↓'} ${Math.abs(pct)} %</span>`;
}

const fact = (label, value, sub = '') => `<div class="fact"><span class="fact-v num">${value}</span><span class="fact-l">${label}</span>${sub ? `<span class="fact-s">${sub}</span>` : ''}</div>`;

export function render(s) {
  const c = activeChild(s);
  const evs = eventsOf(s, c.id);
  const sleeps = sleepsOf(s, c);
  charts.clear();

  const today = startOfDay();
  const days = dayStarts(range).map((d0) => computeDay(d0, evs, sleeps));
  const prevDays = dayStarts(range, startOfDay(today - range * DAY + 3 * H)).map((d0) => computeDay(d0, evs, sleeps));

  // Moyennes : journées complètes où quelque chose a été noté (les jours vides ne faussent pas la moyenne).
  const full = days.filter((d) => d.d0 < today && d.hasData);
  const basis = full.length ? full : days.filter((d) => d.d0 === today);
  const prevFull = prevDays.filter((d) => d.hasData);
  const A = summarize(basis), P = summarize(prevFull);
  const onlyToday = !full.length;
  const nothing = !days.some((d) => d.hasData) && !evs.some((e) => ['feed', 'diaper', 'sleep'].includes(e.type));

  const FEED = [
    { label: 'Tétées', color: '--ch-salmon', get: (d) => d.breast },
    { label: 'Biberons', color: '--ch-slate', get: (d) => d.bottle },
  ];
  const DIAP = [
    { label: 'Mouillées', color: '--ch-slate', get: (d) => d.wet },
    { label: 'Sales', color: '--ch-gold', get: (d) => d.dirty },
    { label: 'Mixtes', color: '--ch-teal', get: (d) => d.mixed },
  ];
  const SLEEP = [
    { label: 'Nuit (19 h – 7 h)', color: '--ch-slate', get: (d) => d.night },
    { label: 'Journée', color: '--ch-gold', get: (d) => d.naps },
  ];
  const ML = [{ label: 'Lait au biberon', color: '--ch-slate', get: (d) => d.ml }];
  const hasBottle = days.some((d) => d.ml);

  return `
    ${appHeader(s)}
    <section class="hero">
      <a class="back-link" href="#/home">${icon('chevronLeft', 18)} Accueil</a>
      <h1 class="title">Statistiques</h1>
      <p class="subtitle">${esc(c.name)} · ${onlyToday ? "moyennes sur aujourd'hui (pas encore de journée complète)" : `moyennes par jour sur ${basis.length} jour${basis.length > 1 ? 's' : ''} complet${basis.length > 1 ? 's' : ''}`}</p>
    </section>

    ${seg(RANGES)}

    ${nothing ? `<div class="card mt-16">${emptyState('chart', 'Pas encore de données', 'Notez des repas, des couches et des siestes : les graphiques apparaîtront ici.')}</div>` : `
    <section class="kpis mt-16" aria-label="Moyennes par jour">
      <div class="kpi tone-salmon"><span class="kpi-l">${icon('bottle', 16)} Repas / jour</span><span class="kpi-v num">${fmtNum(A.feeds)}</span>${delta(A.feeds, P.feeds)}</div>
      <div class="kpi tone-peach"><span class="kpi-l">${icon('diaper', 16)} Couches / jour</span><span class="kpi-v num">${fmtNum(A.diapers)}</span>${delta(A.diapers, P.diapers)}</div>
      <div class="kpi tone-slate"><span class="kpi-l">${icon('moon', 16)} Sommeil / jour</span><span class="kpi-v num">${fmtH(A.sleep)}</span>${delta(A.sleep, P.sleep)}</div>
      <div class="kpi tone-salmon"><span class="kpi-l">${icon('drop', 16)} Lait / jour</span><span class="kpi-v num">${A.ml ? `${Math.round(A.ml)}<small> ml</small>` : '—'}</span>${delta(A.ml, P.ml)}</div>
    </section>
    <p class="small faint mt-8">${P.n ? `Flèches : comparaison avec les ${range} jours précédents.` : ''}</p>

    <section class="section">
      <div class="section-head"><h2><span class="dot-ic tone-salmon">${icon('bottle', 16)}</span>Repas</h2><span class="small faint">par jour</span></div>
      <div class="card">
        ${barChart('feeds', days, FEED, { avgValue: A.feeds, avgLabel: `moy. ${fmtNum(A.feeds)}` })}
        ${legend(FEED)}
        <div class="facts">
          ${fact('Entre deux repas', A.gap ? fmtH(A.gap) : '—', 'en moyenne')}
          ${fact('Tétée moyenne', A.breastAvg ? fmtH(A.breastAvg) : '—', A.leftPct != null ? `G ${A.leftPct} % · D ${100 - A.leftPct} %` : '')}
          ${fact('Biberon moyen', A.bottleAvg ? `${Math.round(A.bottleAvg)} ml` : '—')}
        </div>
      </div>
      ${hasBottle ? `
      <div class="card mt-12">
        <p class="label">Lait au biberon (ml / jour)</p>
        ${barChart('ml', days, ML, { fmt: (v) => `${Math.round(v)} ml`, axisFmt: (v) => Math.round(v), avgValue: A.ml, avgLabel: `moy. ${Math.round(A.ml)} ml` })}
      </div>` : ''}
    </section>

    <section class="section">
      <div class="section-head"><h2><span class="dot-ic tone-peach">${icon('diaper', 16)}</span>Couches</h2><span class="small faint">par jour</span></div>
      <div class="card">
        ${barChart('diapers', days, DIAP, { avgValue: A.diapers, avgLabel: `moy. ${fmtNum(A.diapers)}` })}
        ${legend(DIAP)}
        <div class="facts">
          ${fact('Pipi / jour', fmtNum(A.wet), 'mouillées + mixtes')}
          ${fact('Selles / jour', fmtNum(A.dirty), 'sales + mixtes')}
          ${fact('Dernières selles', (() => { const e = evs.find((x) => x.type === 'diaper' && x.kind !== 'wet'); return e ? ago(e.at) : '—'; })())}
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h2><span class="dot-ic tone-slate">${icon('moon', 16)}</span>Sommeil</h2><span class="small faint">heures par jour</span></div>
      <div class="card">
        ${barChart('sleep', days, SLEEP, { fmt: fmtH, axisFmt: (v) => `${Math.round(v / H)} h`, scale: H, avgValue: A.sleep, avgLabel: `moy. ${fmtH(A.sleep)}` })}
        ${legend(SLEEP)}
        <div class="facts">
          ${fact('Nuit', fmtH(A.night), 'en moyenne')}
          ${fact('Siestes / jour', fmtNum(A.napCount), A.naps ? `${fmtH(A.naps)} au total` : '')}
          ${fact('Plus long sommeil', A.longest ? fmtH(A.longest) : '—', 'en moyenne')}
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h2><span class="dot-ic tone-slate">${icon('clock', 16)}</span>Rythme sur 24 h</h2><span class="small faint">7 derniers jours</span></div>
      <div class="card">${rhythm(days)}</div>
    </section>

    <p class="small faint mt-16" style="text-align:center">Chaque bébé a son propre rythme : ces chiffres servent de repère, pas de norme. En cas de doute, parlez-en à votre pédiatre.</p>`}`;
}

function seg(options) {
  return `<div class="seg" role="tablist">${options.map(([v, l]) => `<button role="tab" data-range="${v}" class="${range === v ? 'is-on' : ''}" aria-selected="${range === v}">${l}</button>`).join('')}</div>`;
}

export function mount(el) {
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-range]');
    if (b) { range = +b.dataset.range; store.refresh(); }
  });
  // Info-bulles : survol à la souris, toucher au doigt.
  const show = (e) => {
    const g = e.target.closest('.bar');
    const box = e.target.closest('.bchart');
    if (!g || !box) return;
    const data = charts.get(box.dataset.chart);
    const row = data?.rows[+g.dataset.i];
    if (!row) return;
    $$('.bar', box).forEach((x) => x.classList.toggle('is-hot', x === g));
    const tip = $('.chart-tip', box);
    tip.innerHTML = `<b>${esc(row.date)}</b>${row.items.map(([l, v, c]) => `<span><i style="background:var(${c})"></i>${esc(l)} <b class="num">${esc(v)}</b></span>`).join('')}${row.total ? `<span class="muted">Total <b class="num">${esc(row.total)}</b></span>` : ''}`;
    tip.hidden = false;
    const rect = box.getBoundingClientRect();
    const scale = rect.width / data.W;
    const cx = (data.padL + data.slot * (+g.dataset.i + 0.5)) * scale;
    const w = tip.offsetWidth;
    tip.style.left = `${Math.max(0, Math.min(rect.width - w, cx - w / 2))}px`;
  };
  const hide = (box) => { if (!box) return; $('.chart-tip', box).hidden = true; $$('.bar', box).forEach((x) => x.classList.remove('is-hot')); };
  el.addEventListener('pointerover', show);
  el.addEventListener('pointerdown', show);
  el.addEventListener('pointerdown', (e) => { if (!e.target.closest('.bchart')) $$('.bchart', el).forEach(hide); });
  el.addEventListener('pointerout', (e) => { const box = e.target.closest('.bchart'); if (box && !box.contains(e.relatedTarget) && e.pointerType === 'mouse') hide(box); });
}
