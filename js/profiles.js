import { store, activeChild, resolvedTheme, FEEDING, feedingOf } from './store.js';
import { icon } from './icons.js';
import { esc, uid, ageLabel, dayKey, ago, openSheet, closeSheet, toast, seg, $ } from './ui.js';
import { sync, syncNow } from './sync.js';

export const ROLES = ['Maman', 'Papa', 'Nounou'];

export function avatar(c, size = 40) {
  if (!c) return '';
  return c.photo
    ? `<span class="avatar" style="--s:${size}px"><img src="${c.photo}" alt=""></span>`
    : `<span class="avatar" style="--s:${size}px;--h:${c.hue ?? 18}" aria-hidden="true">${esc((c.name || '?')[0].toUpperCase())}</span>`;
}

/** En-tête partagé : sélecteur d'enfant, mode sombre, ajout de profil. */
export function appHeader(s) {
  const c = activeChild(s);
  const dark = resolvedTheme(s) === 'dark';
  return `
  <header class="app-header">
    <button class="child-switch" data-global="profiles" aria-label="Changer de profil, profil actuel : ${esc(c.name)}">
      ${avatar(c, 46)}
      <span class="cs-text">
        <span class="cs-name">${esc(c.name)} ${icon('chevronDown', 16)}</span>
        <span class="cs-age">${ageLabel(c.birth)}${s.children.length > 1 ? ` · ${s.children.length} profils` : ''}</span>
      </span>
    </button>
    <div class="header-actions">
      <button class="icon-btn" data-global="theme" aria-label="${dark ? 'Passer en mode clair' : 'Passer en mode sombre'}">${icon(dark ? 'sun' : 'moon', 20)}</button>
      <button class="pill-btn" data-global="add-child">${icon('plus', 16)}Profils</button>
    </div>
  </header>`;
}

/* ---------- Formulaire enfant (création / édition) ---------- */
function childFormHtml(c = {}, { onboarding = false, me = 'Maman' } = {}) {
  return `
  <form class="child-form" novalidate>
    <div class="photo-pick field">
      <span class="js-avatar">${avatar({ name: c.name || '?', photo: c.photo, hue: c.hue ?? 18 }, 64)}</span>
      <label class="btn btn-ghost btn-sm">${icon('upload', 16)} Photo<input type="file" accept="image/*" name="photo"></label>
    </div>
    <label class="field"><span>Prénom</span><input class="input" name="name" value="${esc(c.name || '')}" placeholder="Ex. Léa" autocomplete="off" required maxlength="30"></label>
    <label class="field"><span>Date de naissance</span><input class="input" type="date" name="birth" value="${esc(c.birth || '')}" max="${dayKey()}" required></label>
    <div class="field"><span>Sexe <small class="faint">(pour les courbes de croissance)</small></span>${seg('sex', [['F', 'Fille'], ['M', 'Garçon']], c.sex || 'F')}</div>
    <div class="field"><span>Alimentation <small class="faint">(pour ne proposer que ce qui vous concerne)</small></span>${seg('feeding', Object.entries(FEEDING), feedingOf(store.state, c.id ? c : null) || 'mixed')}</div>
    ${onboarding ? `<div class="field"><span>Vous êtes</span>${seg('me', ROLES.map((r) => [r, r]), me)}</div>` : ''}
    <button class="btn btn-primary btn-block btn-lg mt-8" type="submit">${c.id ? 'Enregistrer' : onboarding ? 'Commencer' : 'Ajouter le profil'}</button>
    ${c.id && store.state.children.length > 1 ? `<button class="btn btn-danger btn-block mt-12" type="button" data-del>${icon('trash', 18)} Supprimer ce profil</button>` : ''}
  </form>`;
}

function readPhoto(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const size = 192, cv = document.createElement('canvas');
      cv.width = cv.height = size;
      const m = Math.min(img.width, img.height);
      cv.getContext('2d').drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(cv.toDataURL('image/jpeg', 0.84));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function bindChildForm(root, c, onDone) {
  const form = $('.child-form', root);
  const values = { feeding: feedingOf(store.state, c.id ? c : null) || 'mixed', sex: c.sex || 'F', me: store.state.me, photo: c.photo || null };
  form.addEventListener('click', (e) => {
    const b = e.target.closest('[data-seg]');
    if (b) {
      e.preventDefault();
      values[b.dataset.seg] = b.dataset.v;
      b.parentElement.querySelectorAll('button').forEach((x) => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-selected', x === b); });
    }
    if (e.target.closest('[data-del]')) {
      if (!confirm(`Supprimer le profil de ${c.name} et toutes ses données ?`)) return;
      store.update((s) => {
        s.children = s.children.filter((x) => x.id !== c.id);
        s.events = s.events.filter((x) => x.childId !== c.id);
        delete s.foods[c.id];
        if (s.activeChild === c.id) s.activeChild = s.children[0]?.id || null;
      });
      closeSheet();
      toast('Profil supprimé');
    }
  });
  form.photo.addEventListener('change', async () => {
    const f = form.photo.files[0];
    if (!f) return;
    try {
      values.photo = await readPhoto(f);
      $('.js-avatar', form).innerHTML = avatar({ name: form.name.value || '?', photo: values.photo }, 64);
    } catch { toast('Image illisible'); }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = form.name.value.trim();
    const birth = form.birth.value;
    if (!name) { form.name.focus(); toast('Indiquez un prénom'); return; }
    if (!birth) { form.birth.focus(); toast('Indiquez la date de naissance'); return; }
    store.update((s) => {
      if (c.id) Object.assign(s.children.find((x) => x.id === c.id), { name, birth, sex: values.sex, photo: values.photo, feeding: values.feeding });
      else {
        const id = uid();
        s.children.push({ id, name, birth, sex: values.sex, photo: values.photo, feeding: values.feeding, hue: [18, 200, 140, 260, 330][s.children.length % 5] });
        s.activeChild = id;
      }
      if (root.dataset.onboarding) s.me = values.me;
    });
    onDone?.();
  });
}

export function openChildForm(c = {}) {
  openSheet({
    title: c.id ? `Modifier ${c.name}` : 'Nouveau profil',
    subtitle: c.id ? '' : 'Jumeaux, fratrie… chaque enfant a son suivi.',
    content: childFormHtml(c),
    onMount: (body) => bindChildForm(body, c, () => { closeSheet(); toast(c.id ? 'Profil mis à jour' : 'Profil ajouté'); }),
  });
}

/* ---------- Onboarding ---------- */
export function renderOnboarding(s) {
  return `
  <section class="onboarding page" data-onboarding="1">
    <div class="ob-logo">${icon('moon', 34)}</div>
    <p class="eyebrow">Bienvenue</p>
    <h1 class="title">Le carnet de bord<br>des jeunes parents</h1>
    <p class="subtitle">Repas, couches, sommeil, diversification et un espace rien que pour vous. Tout reste sur votre téléphone.</p>
    <div class="card mt-24">${childFormHtml({}, { onboarding: true, me: s.me })}</div>
  </section>`;
}
export function mountOnboarding(main) {
  const root = $('.onboarding', main);
  bindChildForm(root, {}, () => toast('Tout est prêt ✨'));
}

/* ---------- Profils & réglages ---------- */
export function openProfiles() {
  openSheet({
    title: 'Profils & réglages',
    content: '',
    onMount(body) {
      const draw = () => {
        const s = store.state;
        const cur = activeChild(s);
        body.innerHTML = `
          <div class="stack" style="gap:4px">
            ${s.children.map((c) => `
              <div class="profile-row ${c.id === cur.id ? 'is-active' : ''}">
                <button class="row grow" data-pick="${c.id}" style="text-align:left">${avatar(c, 44)}
                  <span class="grow"><b>${esc(c.name)}</b><br><span class="small muted">${ageLabel(c.birth)}</span></span>
                </button>
                ${c.id === cur.id ? `<span class="badge tone-sage">${icon('check', 14)} Actif</span>` : ''}
                <button class="icon-btn icon-btn-sm" data-edit="${c.id}" aria-label="Modifier ${esc(c.name)}">${icon('edit', 16)}</button>
              </div>`).join('')}
          </div>
          <button class="btn btn-ghost btn-block mt-12" data-add>${icon('plus', 18)} Ajouter un enfant</button>

          <div class="field mt-24"><span>J'utilise l'app en tant que</span>${seg('me', ROLES.map((r) => [r, r]), s.me)}</div>
          <div class="field"><span>Apparence</span>${seg('theme', [['auto', 'Auto'], ['dark', 'Sombre'], ['light', 'Clair']], s.theme)}</div>
          <p class="small faint" style="margin-top:-8px">« Auto » passe en mode sombre de 19 h à 8 h.</p>

          <div class="field mt-24"><span>Mes données</span>
            <div class="grid-2">
              <button class="btn btn-sm" data-export>${icon('download', 16)} Exporter</button>
              <label class="btn btn-sm">${icon('upload', 16)} Importer<input type="file" accept="application/json" data-import hidden></label>
            </div>
          </div>
          ${syncBlock()}`;
      };
      body.addEventListener('click', (e) => {
        const t = e.target.closest('button');
        if (!t) return;
        if (t.dataset.pick) { store.update((s) => { s.activeChild = t.dataset.pick; }); closeSheet(); }
        else if (t.dataset.edit) openChildForm(store.state.children.find((c) => c.id === t.dataset.edit));
        else if (t.hasAttribute('data-add')) openChildForm();
        else if (t.dataset.seg === 'me') { store.update((s) => { s.me = t.dataset.v; }); draw(); }
        else if (t.dataset.seg === 'theme') { store.update((s) => { s.theme = t.dataset.v; }); draw(); }
        else if (t.hasAttribute('data-export')) exportData();
        else if (t.hasAttribute('data-sync')) syncNow().then(draw);
      });
      body.addEventListener('change', (e) => { if (e.target.matches('[data-import]')) importData(e.target.files[0]); });
      draw();
    },
  });
}

function syncBlock() {
  if (!sync.available) {
    return `<p class="small faint">Vos données sont stockées uniquement sur cet appareil. Installez l’app sur votre NAS pour les partager automatiquement, ou utilisez Exporter / Importer.</p>`;
  }
  const ok = sync.status !== 'error';
  return `
    <div class="notice tone-${ok ? 'sage' : 'brick'} mt-8">${icon(ok ? 'check' : 'alert', 18)}
      <span class="grow" style="flex:1">${ok ? `<b>Partagé via le NAS.</b> Dernière synchro ${sync.lastSync ? ago(sync.lastSync) : 'en cours'}.` : `<b>Synchro en pause.</b> ${esc(sync.error)}`}</span>
      <button class="btn btn-sm" data-sync>Synchroniser</button>
    </div>`;
}

function exportData() {
  const blob = new Blob([JSON.stringify(store.state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `appbebe-${dayKey()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Sauvegarde exportée');
}

async function importData(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.children)) throw new Error('format');
    if (!confirm('Remplacer les données de cet appareil par celles du fichier ?')) return;
    store.replace(data);
    closeSheet();
    toast('Données importées');
  } catch { toast('Fichier invalide'); }
}
