import { store, eventsOf, addEvent } from '../store.js';
import { icon } from '../icons.js';
import { esc, fmtNum, dateShort, ageMonthsExact, openSheet, toast, seg, emptyState, toLocalInput, fromLocalInput, $ } from '../ui.js';

/*
 * Repères OMS simplifiés (médiane par âge en mois). Les bornes P3–P97 sont
 * approchées : à titre indicatif uniquement, le carnet de santé fait foi.
 */
const MONTHS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 18, 21, 24];
const REF = {
  weight: {
    M: [3.3, 4.5, 5.6, 6.4, 7.0, 7.5, 7.9, 8.3, 8.6, 8.9, 9.2, 9.4, 9.6, 10.3, 10.9, 11.5, 12.2],
    F: [3.2, 4.2, 5.1, 5.8, 6.4, 6.9, 7.3, 7.6, 7.9, 8.2, 8.5, 8.7, 8.9, 9.6, 10.2, 10.9, 11.5],
    lo: (m) => m * 0.8, hi: (m) => m * 1.22, unit: 'kg', label: 'Poids',
  },
  height: {
    M: [49.9, 54.7, 58.4, 61.4, 63.9, 65.9, 67.6, 69.2, 70.6, 72.0, 73.3, 74.5, 75.7, 79.1, 82.3, 85.1, 87.8],
    F: [49.1, 53.7, 57.1, 59.8, 62.1, 64.0, 65.7, 67.3, 68.7, 70.1, 71.5, 72.8, 74.0, 77.5, 80.7, 83.7, 86.4],
    lo: (m) => m * 0.93, hi: (m) => m * 1.07, unit: 'cm', label: 'Taille',
  },
};

function refAt(arr, month) {
  if (month <= 0) return arr[0];
  for (let i = 1; i < MONTHS.length; i++) {
    if (month <= MONTHS[i]) {
      const k = (month - MONTHS[i - 1]) / (MONTHS[i] - MONTHS[i - 1]);
      return arr[i - 1] + (arr[i] - arr[i - 1]) * k;
    }
  }
  return arr[arr.length - 1];
}

function chart(child, points, metric) {
  const ref = REF[metric];
  const med = ref[child.sex === 'M' ? 'M' : 'F'];
  const lastAge = points.length ? points[points.length - 1].m : ageMonthsExact(child.birth);
  const maxM = lastAge > 12 ? 24 : lastAge > 6 ? 12 : 6;
  const W = 340, H = 220, L = 34, R = 10, T = 12, B = 26;
  const samples = [];
  for (let m = 0; m <= maxM; m += maxM / 48) samples.push(m);
  const lo = samples.map((m) => ref.lo(refAt(med, m)));
  const hi = samples.map((m) => ref.hi(refAt(med, m)));
  const vals = points.map((p) => p.v);
  const yMin = Math.floor(Math.min(...lo, ...vals) * 0.98);
  const yMax = Math.ceil(Math.max(...hi, ...vals) * 1.02);
  const x = (m) => L + (m / maxM) * (W - L - R);
  const y = (v) => T + (1 - (v - yMin) / (yMax - yMin)) * (H - T - B);
  const path = (arr) => arr.map((v, i) => `${i ? 'L' : 'M'}${x(samples[i]).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const band = `${path(hi)}${lo.map((v, i) => `L${x(samples[lo.length - 1 - i]).toFixed(1)},${y(lo[lo.length - 1 - i]).toFixed(1)}`).join('')}Z`;
  const step = (yMax - yMin) / 4;
  const yTicks = [0, 1, 2, 3, 4].map((i) => yMin + step * i);
  const xStep = maxM === 24 ? 6 : maxM === 12 ? 3 : 1;
  const xTicks = []; for (let m = 0; m <= maxM; m += xStep) xTicks.push(m);
  const series = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.m).toFixed(1)},${y(p.v).toFixed(1)}`).join('');

  return `
    <div class="chart">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Courbe de ${ref.label.toLowerCase()} de ${esc(child.name)}">
        <g class="grid">${yTicks.map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/>`).join('')}</g>
        <g class="axis">
          ${yTicks.map((v) => `<text x="${L - 6}" y="${y(v) + 3}" text-anchor="end">${fmtNum(v, metric === 'weight' ? 1 : 0)}</text>`).join('')}
          ${xTicks.map((m) => `<text x="${x(m)}" y="${H - 8}" text-anchor="middle">${m}${m === maxM ? ' m' : ''}</text>`).join('')}
        </g>
        <path class="band" d="${band}"/>
        <path class="median" d="${path(samples.map((m) => refAt(med, m)))}"/>
        ${points.length > 1 ? `<path class="series" d="${series}"/>` : ''}
        ${points.map((p) => `<circle class="pt" cx="${x(p.m)}" cy="${y(p.v)}" r="4.5"><title>${fmtNum(p.v, 2)} ${ref.unit}</title></circle>`).join('')}
      </svg>
      <div class="legend">
        <span><i style="background:var(--sage)"></i>${esc(child.name)}</span>
        <span><i style="background:color-mix(in srgb,var(--sage) 50%,transparent);height:2px"></i>Médiane OMS</span>
        <span><i style="background:color-mix(in srgb,var(--sage) 18%,transparent)"></i>Zone habituelle (≈ P3–P97)</span>
      </div>
    </div>`;
}

export function openGrowth(child, initialTab = 'chart') {
  let tab = initialTab;
  let metric = 'weight';
  openSheet({
    title: 'Croissance', subtitle: child.name,
    onMount(body, api) {
      const draw = () => {
        const list = eventsOf(store.state, child.id).filter((e) => e.type === 'growth');
        const points = list.filter((e) => e[metric]).map((e) => ({ m: ageMonthsExact(child.birth, e.at), v: e[metric] })).sort((a, b) => a.m - b.m);
        body.innerHTML = `
          ${seg('tab', [['chart', 'Courbes'], ['add', 'Nouvelle mesure']], tab, 'seg-lg')}
          <div class="mt-16">
          ${tab === 'chart' ? `
            <div class="chips tone-sage">${['weight', 'height'].map((k) => `<button class="chip ${metric === k ? 'is-on' : ''}" data-metric="${k}">${REF[k].label} (${REF[k].unit})</button>`).join('')}</div>
            <div class="mt-16">${chart(child, points, metric)}</div>
            ${points.length ? '' : `<p class="small faint mt-8">Ajoutez une première mesure pour tracer la courbe.</p>`}
            <div class="section-head mt-24"><h2>Historique</h2></div>
            <div class="card" style="padding:4px 16px">
              ${list.length ? list.map((e) => `<div class="list-row"><span class="muted">${dateShort(e.at)}</span><b class="num">${[e.weight && `${fmtNum(e.weight, 2)} kg`, e.height && `${fmtNum(e.height)} cm`, e.head && `PC ${fmtNum(e.head)} cm`].filter(Boolean).join(' · ')}</b></div>`).join('') : emptyState('growth', 'Aucune mesure')}
            </div>
            <p class="small faint mt-12">Repères indicatifs inspirés des standards OMS. Votre médecin et le carnet de santé font référence.</p>` : `
            <form class="js-growth" novalidate>
              <div class="grid-2">
                <label class="field"><span>Poids (kg)</span><input class="input num" name="weight" type="number" inputmode="decimal" step="0.01" min="1" max="30" placeholder="6,20"></label>
                <label class="field"><span>Taille (cm)</span><input class="input num" name="height" type="number" inputmode="decimal" step="0.1" min="30" max="120" placeholder="62"></label>
              </div>
              <label class="field"><span>Périmètre crânien (cm) — facultatif</span><input class="input num" name="head" type="number" inputmode="decimal" step="0.1" min="25" max="60" placeholder="40"></label>
              <label class="field"><span>Date</span><input class="input" type="datetime-local" name="at" value="${toLocalInput()}" max="${toLocalInput()}"></label>
              <div class="tone-sage"><button class="btn btn-primary btn-block btn-lg" type="submit">Enregistrer la mesure</button></div>
            </form>`}
          </div>`;
        $('.js-growth', body)?.addEventListener('submit', (e) => {
          e.preventDefault();
          const f = e.target;
          const num = (n) => { const v = parseFloat(String(f[n].value).replace(',', '.')); return Number.isFinite(v) ? v : null; };
          const weight = num('weight'), height = num('height'), head = num('head');
          if (!weight && !height) return toast('Indiquez au moins le poids ou la taille');
          addEvent({ childId: child.id, type: 'growth', at: fromLocalInput(f.at.value), weight, height, head });
          toast('Mesure enregistrée');
          tab = 'chart'; metric = weight ? 'weight' : 'height';
          draw();
        });
      };
      body.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.seg === 'tab') { tab = b.dataset.v; draw(); }
        if (b.dataset.metric) { metric = b.dataset.metric; draw(); }
      });
      draw();
    },
  });
}
