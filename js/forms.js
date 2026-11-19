import { openSheet, esc, toast } from './ui.js';
import { icon } from './icons.js';

/** Nombre saisi à la française (« 12,5 ») → nombre, ou null. */
export const num = (v) => { const n = parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) ? n : null; };

function fieldHtml(f) {
  const id = esc(f.name), v = f.value ?? '';
  const hint = f.hint ? ` <small class="faint">${esc(f.hint)}</small>` : '';
  if (f.type === 'check') {
    return `<div class="row-between field"><span class="grow"><b style="display:block;font-size:.95rem">${esc(f.label)}</b>${f.hint ? `<span class="small muted">${esc(f.hint)}</span>` : ''}</span>
      <label class="switch"><input type="checkbox" name="${id}" ${v ? 'checked' : ''}><span class="track"></span></label></div>`;
  }
  let input;
  if (f.type === 'select') input = `<select class="input" name="${id}">${f.options.map(([o, l]) => `<option value="${esc(o)}" ${String(o) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  else if (f.type === 'textarea') input = `<textarea class="input" name="${id}" rows="3" maxlength="${f.maxlength || 600}" placeholder="${esc(f.placeholder || '')}">${esc(v)}</textarea>`;
  else {
    const t = f.type === 'number' ? 'text' : f.type || 'text';
    input = `<input class="input" type="${t}" name="${id}" value="${esc(v)}" ${f.type === 'number' ? 'inputmode="decimal"' : ''} ${f.list ? `list="dl-${id}"` : ''} maxlength="${f.maxlength || 80}" placeholder="${esc(f.placeholder || '')}" autocomplete="off">${f.list ? `<datalist id="dl-${id}">${f.list.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>` : ''}`;
  }
  return `<label class="field"><span>${esc(f.label)}${hint}</span>${input}</label>`;
}

/**
 * Formulaire dans une feuille. fields : { name, label, type, value, options, placeholder, hint, required }.
 * onSubmit(values, api) reçoit les valeurs (nombre → number|null, case → boolean, le reste → texte).
 */
export function openForm({ title, subtitle = '', fields, submit = 'Enregistrer', onSubmit, onDelete, deleteLabel = 'Supprimer', header = '', extra = [], afterMount }) {
  openSheet({
    title, subtitle,
    content: `${header}<form class="js-form" novalidate>${fields.map(fieldHtml).join('')}
      ${extra.length ? `<div class="grid-2" style="gap:8px">${extra.map((x, i) => `<button type="button" class="btn btn-ghost btn-sm" data-extra="${i}">${x.icon ? icon(x.icon, 16) + ' ' : ''}${esc(x.label)}</button>`).join('')}</div>` : ''}
      <div class="actions tone-salmon">${onDelete ? `<button type="button" class="btn btn-danger" data-del>${icon('trash', 18)} ${esc(deleteLabel)}</button>` : '<span></span>'}<button class="btn btn-primary" type="submit">${esc(submit)}</button></div></form>`,
    onMount(body, api) {
      body.querySelector('input:not([type=checkbox]),textarea')?.focus({ preventScroll: true });
      body.querySelectorAll('[data-extra]').forEach((b) => b.addEventListener('click', () => {
        const form = body.querySelector('form'), vals = {};
        for (const f of fields) { const el = form.elements[f.name]; vals[f.name] = f.type === 'check' ? el.checked : f.type === 'number' ? num(el.value) : String(el.value).trim(); }
        extra[+b.dataset.extra].onClick(api, vals);
      }));
      afterMount?.(body, api);
      body.querySelector('[data-del]')?.addEventListener('click', () => onDelete(api));
      body.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        const out = {};
        for (const f of fields) {
          const el = e.target.elements[f.name];
          if (f.type === 'check') out[f.name] = el.checked;
          else if (f.type === 'number') out[f.name] = num(el.value);
          else out[f.name] = String(el.value).trim();
          if (f.required && (out[f.name] === null || out[f.name] === '')) { el.focus(); toast(`Renseignez : ${f.label}`); return; }
        }
        onSubmit(out, api);
      });
    },
  });
}
