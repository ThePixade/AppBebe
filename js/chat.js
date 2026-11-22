import { store } from './store.js';
import { EDITION } from './edition.js';
import { icon } from './icons.js';
import { esc, time, dayLabel, dayKey, toast, DAY, startOfDay } from './ui.js';
import { whoTone } from './premium/alerts.js';

/*
 * Discussion de famille en direct : un seul fil pour tous les profils, stocké sur le NAS (chat.php).
 * Bouton flottant + pastille de messages non lus ; texte, emojis, photos et partage d'un élément de l'app.
 * Sans NAS (GitHub Pages, ordinateur seul), le bouton n'apparaît pas.
 */

const API = 'chat.php';
const SEEN_KEY = EDITION.storageKey + ':chat-seen';
const EMOJIS = ['😀', '😂', '😍', '🥰', '😘', '😉', '👍', '🙏', '👏', '🎉', '❤️', '😴', '🍼', '👶', '😢', '😮', '🤔', '✅', '🛒', '🏠'];

let available = false, msgs = [], last = 0, open = false, fab = null, panel = null, pollTimer = null, busy = false, firstLoad = true;
const seen = () => { try { return +localStorage.getItem(SEEN_KEY) || 0; } catch { return 0; } };
const setSeen = (n) => { try { localStorage.setItem(SEEN_KEY, String(n)); } catch { /* stockage indisponible */ } };
const MUTE_KEY = EDITION.storageKey + ':chat-mute';
const muted = () => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } };
const setMuted = (v) => { try { localStorage.setItem(MUTE_KEY, v ? '1' : '0'); } catch { /* stockage indisponible */ } };
const me = () => store.state.me || 'Maman';
const unread = () => msgs.filter((m) => m.id > seen() && m.by !== me()).length;

async function api(method, body, query = '') {
  const res = await fetch(API + query, { method, cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  let json; try { json = JSON.parse(await res.text()); } catch { throw new Error('no-api'); }
  if (json?.app !== 'appfamille' || json.error) throw new Error(json?.error || 'no-api');
  return json;
}

/* ------------------------------------------------------------ interrogation */
async function poll() {
  if (busy) return; busy = true;
  try {
    const j = await api('GET', null, `?since=${last}`);
    if (!available) { available = true; mountFab(); }
    let changed = false;
    if (Array.isArray(j.ids)) { const keep = new Set(j.ids), n = msgs.length; msgs = msgs.filter((m) => keep.has(m.id)); changed = msgs.length !== n; }
    const fresh = j.msgs.filter((m) => !msgs.some((x) => x.id === m.id));
    if (fresh.length) {
      msgs = msgs.concat(fresh).slice(-300); last = j.last;
      const others = fresh.filter((m) => m.by !== me());
      if (open) { setSeen(last); renderMsgs(true); }
      else if (!firstLoad && others.length && !muted()) {
        const m = others[others.length - 1];
        toast(`${m.by || 'Quelqu’un'} : ${m.text || (m.img ? '📷 Photo' : m.share ? m.share.title : '')}`.slice(0, 70), { action: 'Ouvrir', onAction: openChat });
      }
    } else { last = Math.max(last, j.last); if (changed) { if (open) renderMsgs(false); } }
    firstLoad = false; updateBadge();
  } catch (e) { /* pas de NAS ou hors connexion : on réessaiera */ }
  busy = false;
}
function schedule() {
  clearTimeout(pollTimer);
  if (document.visibilityState === 'visible') poll();
  pollTimer = setTimeout(schedule, open ? 3000 : 12000);
}

/* ------------------------------------------------------------ bouton flottant */
function mountFab() {
  if (fab) return;
  fab = document.createElement('button');
  fab.className = 'chat-fab'; fab.setAttribute('aria-label', 'Discussion de famille');
  fab.innerHTML = `${icon('chat', 24)}<span class="chat-badge" hidden></span>`;
  fab.addEventListener('click', openChat);
  document.body.appendChild(fab);
  document.body.dataset.chat = 'on';
  updateBadge();
}
function updateBadge() {
  if (!fab) return;
  const n = unread(), b = fab.querySelector('.chat-badge');
  b.hidden = !n; b.textContent = n > 9 ? '9+' : n;
  fab.hidden = open || ['onboarding', 'sleep'].includes(document.body.dataset.page);
}

/* ------------------------------------------------------------ liens et presse-papiers */
const URL_RE = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;
const cleanUrl = (u) => u.replace(/[.,;:!?)\]»]+$/, '');
const hrefOf = (u) => (/^www\./i.test(u) ? 'https://' + u : u);
const linksOf = (text) => [...String(text || '').matchAll(URL_RE)].map((m) => cleanUrl(m[0]));
function linkify(text) {
  let out = '', i = 0;
  for (const m of String(text).matchAll(URL_RE)) {
    const u = cleanUrl(m[0]);
    out += esc(text.slice(i, m.index)) + `<a class="chat-link" href="${esc(hrefOf(u))}" target="_blank" rel="noopener noreferrer">${esc(u)}</a>`;
    i = m.index + u.length;
  }
  return (out + esc(text.slice(i))).replace(/\n/g, '<br>');
}
async function copyText(s, ok = 'Copié') {
  try { await navigator.clipboard.writeText(s); } catch {
    const ta = document.createElement('textarea'); ta.value = s; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch { /* copie impossible */ } ta.remove();
  }
  toast(ok);
}
const shareText = (m) => m.share ? [m.share.title, ...(m.share.lines || [])].join('\n') : '';

/* ------------------------------------------------------------ panneau */
function dayHead(at) {
  const k = dayKey(at), t = dayKey(), y = dayKey(Date.now() - DAY);
  return k === t ? 'Aujourd’hui' : k === y ? 'Hier' : dayLabel(new Date(at));
}
function msgHtml(m, prev) {
  const mine = m.by === me(), head = !prev || dayKey(prev.at) !== dayKey(m.at);
  const grouped = prev && prev.by === m.by && dayKey(prev.at) === dayKey(m.at) && m.at - prev.at < 5 * 60e3;
  let body = '';
  if (m.img) body += `<img class="chat-img" src="${API}?img=${encodeURIComponent(m.img)}" alt="Photo" loading="lazy">`;
  if (m.share) body += `<a class="chat-share" href="${esc(m.share.route || '#/hub')}" data-close><b>${esc(m.share.title)}</b>${(m.share.lines || []).map((l) => `<span>${esc(l)}</span>`).join('')}</a>`;
  if (m.text) body += `<p>${linkify(m.text)}</p>`;
  return `${head ? `<div class="chat-day">${esc(dayHead(m.at))}</div>` : ''}
    <div class="chat-msg ${mine ? 'is-mine' : ''} ${grouped ? 'is-grouped' : ''}" data-mid="${m.id}">${!mine && !grouped ? `<small class="chat-by tone-${whoTone(m.by)}">${esc(m.by || '?')}</small>` : ''}<div class="chat-bubble">${body}<time>${time(m.at)}</time></div></div>`;
}
function renderMsgs(stick) {
  const box = panel?.querySelector('.chat-list'); if (!box) return;
  const nearEnd = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
  box.innerHTML = msgs.length ? msgs.map((m, i) => msgHtml(m, msgs[i - 1])).join('') : `<div class="chat-empty">${icon('chat', 34)}<b>Aucun message</b><span>Écrivez le premier : toute la famille le verra ici en direct.</span></div>`;
  if (stick || nearEnd) box.scrollTop = box.scrollHeight;
}

export function openChat() {
  if (open) return;
  open = true; fab && (fab.hidden = true);
  panel = document.createElement('div');
  panel.className = 'chat-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Discussion de famille');
  panel.innerHTML = `
    <header class="chat-head"><button class="icon-btn" data-x aria-label="Fermer">${icon('chevronLeft', 22)}</button><div class="grow"><b>Discussion de famille</b><small>Connecté en tant que ${esc(me())}</small></div><button class="icon-btn" data-mute aria-label="Notifications">${icon(muted() ? 'bellOff' : 'bell', 20)}</button><button class="icon-btn" data-clear aria-label="Vider la discussion">${icon('trash', 20)}</button></header>
    <div class="chat-list" aria-live="polite"></div>
    <div class="chat-tray" hidden></div>
    <form class="chat-composer">
      <button type="button" class="icon-btn" data-emoji aria-label="Emojis">${icon('smile', 22)}</button>
      <button type="button" class="icon-btn" data-photo aria-label="Envoyer une photo">${icon('camera', 22)}</button>
      <button type="button" class="icon-btn" data-share aria-label="Partager un élément">${icon('plus', 22)}</button>
      <textarea class="input" rows="1" placeholder="Votre message…" maxlength="2000" enterkeyhint="send"></textarea>
      <button class="btn btn-primary chat-send" aria-label="Envoyer">${icon('send', 20)}</button>
      <input type="file" accept="image/*" hidden data-file>
    </form>`;
  document.body.appendChild(panel);
  requestAnimationFrame(() => panel.classList.add('is-in'));
  history.pushState({ chat: 1 }, '');
  wire(); setSeen(last); updateBadge(); renderMsgs(true); schedule();
}
export function closeChat(fromPop) {
  if (!open) return;
  open = false; setSeen(last);
  const p = panel; panel = null; p.classList.remove('is-in'); setTimeout(() => p.remove(), 250);
  if (!fromPop && history.state?.chat) history.back();
  updateBadge(); schedule();
}

/* Appui long (ou clic droit) sur un message : menu Copier / Supprimer, adapté au contenu. */
function openMenu(m) {
  panel.querySelector('.chat-menu')?.remove();
  const mine = m.by === me(), links = linksOf(m.text), acts = [];
  if (links.length) acts.push({ k: 'link', ic: 'link', label: links.length > 1 ? 'Copier le 1er lien' : 'Copier le lien', sub: links[0] });
  if (m.text) acts.push({ k: 'text', ic: 'copy', label: links.length ? 'Copier tout le message' : 'Copier le message' });
  if (links.length) acts.push({ k: 'open', ic: 'link', label: 'Ouvrir le lien' });
  if (m.share) acts.push({ k: 'share', ic: 'copy', label: 'Copier le contenu partagé' });
  if (m.img) acts.push({ k: 'img', ic: 'download', label: 'Enregistrer la photo' });
  if (mine) acts.push({ k: 'del', ic: 'trash', label: 'Supprimer pour tous', danger: true });
  const menu = document.createElement('div'); menu.className = 'chat-menu';
  menu.innerHTML = `<div class="chat-menu-card" role="menu">${acts.map((a, i) => `<button type="button" role="menuitem" data-a="${i}" class="${a.danger ? 'is-danger' : ''}">${icon(a.ic, 18)}<span><b>${esc(a.label)}</b>${a.sub ? `<small>${esc(a.sub.slice(0, 48))}</small>` : ''}</span></button>`).join('')}<button type="button" class="chat-menu-x" data-a="x">Annuler</button></div>`;
  panel.appendChild(menu);
  navigator.vibrate?.(12);
  const close = () => menu.remove();
  menu.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b && e.target !== menu) return; if (e.target === menu || b.dataset.a === 'x') return close();
    const a = acts[+b.dataset.a]; close();
    if (a.k === 'link') copyText(links[0], 'Lien copié');
    else if (a.k === 'text') copyText(m.text, 'Message copié');
    else if (a.k === 'share') copyText(shareText(m), 'Copié');
    else if (a.k === 'open') window.open(hrefOf(links[0]), '_blank', 'noopener');
    else if (a.k === 'img') { const l = document.createElement('a'); l.href = `${API}?img=${encodeURIComponent(m.img)}`; l.download = m.img; document.body.appendChild(l); l.click(); l.remove(); }
    else if (a.k === 'del') {
      if (!confirm('Supprimer ce message pour toute la famille ?')) return;
      msgs = msgs.filter((x) => x.id !== m.id); renderMsgs(false);
      try { await api('POST', { action: 'delete', id: m.id, by: me() }); } catch { toast('Suppression impossible'); poll(); }
    }
  });
}
function wirePress() {
  const list = panel.querySelector('.chat-list'); let timer = null, sx = 0, sy = 0, fired = false;
  const msgOf = (el) => { const n = el.closest('[data-mid]'); return n ? msgs.find((m) => m.id === +n.dataset.mid) : null; };
  const stop = () => clearTimeout(timer);
  list.addEventListener('pointerdown', (e) => {
    const m = msgOf(e.target); fired = false; if (!m || e.button > 0) return;
    sx = e.clientX; sy = e.clientY; timer = setTimeout(() => { fired = true; openMenu(m); }, 450);
  });
  list.addEventListener('pointermove', (e) => { if (Math.abs(e.clientX - sx) > 8 || Math.abs(e.clientY - sy) > 8) stop(); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => list.addEventListener(ev, stop));
  list.addEventListener('scroll', stop, { passive: true });
  list.addEventListener('contextmenu', (e) => { const m = msgOf(e.target); if (m) { e.preventDefault(); stop(); if (!fired) openMenu(m); fired = true; } });
  list.addEventListener('click', (e) => { if (fired) { e.preventDefault(); e.stopPropagation(); fired = false; } }, true);
}

function wire() {
  wirePress();
  const ta = panel.querySelector('textarea'), tray = panel.querySelector('.chat-tray');
  const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; };
  ta.addEventListener('input', grow);
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && matchMedia('(hover:hover)').matches) { e.preventDefault(); panel.querySelector('form').requestSubmit(); } });
  const showTray = (html) => { if (!html || (!tray.hidden && tray.dataset.k === html.k)) { tray.hidden = true; tray.dataset.k = ''; return; } tray.innerHTML = html.h; tray.dataset.k = html.k; tray.hidden = false; };
  panel.addEventListener('click', async (e) => {
    const t = e.target;
    if (t.closest('[data-x]')) return closeChat();
    if (t.closest('[data-clear]')) { if (!confirm('Vider toute la discussion pour toute la famille ? Cette action est définitive.')) return; try { await api('POST', { action: 'clear', by: me() }); msgs = []; renderMsgs(false); toast('Discussion vidée'); } catch { toast('Suppression impossible'); } return; }
    const mu = t.closest('[data-mute]');
    if (mu) { setMuted(!muted()); mu.innerHTML = icon(muted() ? 'bellOff' : 'bell', 20); toast(muted() ? 'Notifications du chat désactivées' : 'Notifications du chat activées'); return; }
    const lk = t.closest('[data-close]'); if (lk) { e.preventDefault(); closeChat(true); location.hash = lk.getAttribute('href'); return; }
    if (t.closest('[data-emoji]')) return showTray({ k: 'e', h: `<div class="chat-emojis">${EMOJIS.map((x) => `<button type="button" data-em="${x}">${x}</button>`).join('')}</div>` });
    const em = t.closest('[data-em]'); if (em) { ta.setRangeText(em.dataset.em, ta.selectionStart, ta.selectionEnd, 'end'); ta.focus(); return; }
    if (t.closest('[data-photo]')) return panel.querySelector('[data-file]').click();
    if (t.closest('[data-share]')) {
      const items = shareItems();
      return showTray({ k: 's', h: `<div class="chat-shares">${items.length ? items.map((it, i) => `<button type="button" data-sh="${i}">${icon(it.icon, 18)}<span><b>${esc(it.title)}</b><small>${esc(it.lines[0] || '')}</small></span></button>`).join('') : '<p class="small faint">Rien à partager pour l’instant.</p>'}</div>` });
    }
    const sh = t.closest('[data-sh]');
    if (sh) { const it = shareItems()[+sh.dataset.sh]; tray.hidden = true; await send({ share: { title: it.title, lines: it.lines, route: it.route } }); }
  });
  panel.querySelector('[data-file]').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try { await send({ img: await shrink(f) }); } catch { toast('Photo impossible à envoyer'); }
  });
  panel.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault(); const text = ta.value.trim(); if (!text) return;
    ta.value = ''; grow(); tray.hidden = true;
    await send({ text });
  });
}

async function send(part) {
  try {
    const j = await api('POST', { by: me(), ...part });
    if (!msgs.some((m) => m.id === j.msg.id)) { msgs.push(j.msg); last = Math.max(last, j.msg.id); }
    setSeen(last); renderMsgs(true);
  } catch (e) { toast(e.message === 'no-api' ? 'Le NAS ne répond pas : message non envoyé' : 'Envoi impossible'); }
}

/** Réduit la photo (1280 px max, JPEG) avant l'envoi. */
function shrink(file) {
  return new Promise((ok, ko) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const k = Math.min(1, 1280 / Math.max(im.width, im.height)), c = document.createElement('canvas');
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      ok(c.toDataURL('image/jpeg', 0.8));
    };
    im.onerror = () => { URL.revokeObjectURL(url); ko(new Error('image')); };
    im.src = url;
  });
}

/* Éléments de l'app que l'on peut envoyer d'un geste. */
function shareItems() {
  const s = store.state, out = [];
  const shop = (s.lists || []).find((l) => l.kind === 'shop'), todo = (shop?.items || []).filter((i) => !i.done);
  if (todo.length) out.push({ icon: 'cart', title: `Courses : ${todo.length} article${todo.length > 1 ? 's' : ''}`, lines: todo.slice(0, 8).map((i) => `• ${i.text}${i.qty ? ' ×' + i.qty : ''}`), route: '#/maison' });
  const evs = (s.agenda || []).filter((e) => (e.end || e.start) >= startOfDay()).sort((a, b) => a.start - b.start).slice(0, 3);
  if (evs.length) out.push({ icon: 'calendar', title: 'Prochains rendez-vous', lines: evs.map((e) => `${new Date(e.start).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}${e.allDay ? '' : ' · ' + time(e.start)} · ${e.title}`), route: '#/agenda' });
  const ch = (s.chores || []).slice(0, 4);
  if (ch.length) out.push({ icon: 'home', title: 'Tâches de la maison', lines: ch.map((c) => `• ${c.name || c.title || ''}`), route: '#/maison' });
  if (s.memo) out.push({ icon: 'note', title: 'Mémo de la famille', lines: String(s.memo).split('\n').slice(0, 6), route: '#/hub' });
  return out;
}

/* ------------------------------------------------------------ démarrage */
export function initChat() {
  window.addEventListener('popstate', () => { if (open) closeChat(true); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') schedule(); });
  window.addEventListener('hashchange', updateBadge);
  store.subscribe(updateBadge);
  schedule();
}
