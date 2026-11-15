import { icon } from './icons.js';
import { esc } from './ui.js';
import { SOUNDS, player, onPlayer, toggle, pause } from './audio.js';

/*
 * Mini-lecteur flottant : tant qu'un son a été lancé, un bouton Lecture / Pause reste
 * visible sur toutes les pages pour l'arrêter sans retourner dans l'onglet Sommeil.
 * La croix le ferme (et coupe le son).
 */
let session = false;
let el = null;

function build() {
  el = document.createElement('div');
  el.className = 'miniplayer';
  el.hidden = true;
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', 'Son en cours');
  el.innerHTML = `
    <a class="mp-info" href="#/sleep" aria-label="Ouvrir le lecteur de sons"><span class="eq" data-mp="eq"><i></i><i></i><i></i></span><span class="mp-name" data-mp="name"></span></a>
    <button class="mp-btn" data-mp="toggle"></button>
    <button class="mp-close" data-mp="close" aria-label="Arrêter et fermer">${icon('x', 16)}</button>`;
  el.querySelector('[data-mp=toggle]').addEventListener('click', () => toggle());
  el.querySelector('[data-mp=close]').addEventListener('click', () => { pause(); session = false; render(); });
  document.body.appendChild(el);
}

function render() {
  if (!el) build();
  if (player.playing || player.loading) session = true;
  el.hidden = !session;
  if (!session) return;
  const sound = SOUNDS.find((x) => x.id === player.soundId) || SOUNDS[0];
  const on = player.playing || player.loading;
  el.querySelector('[data-mp=name]').textContent = player.loading ? 'Préparation…' : sound.name;
  el.querySelector('[data-mp=eq]').classList.toggle('paused', !player.playing);
  const b = el.querySelector('[data-mp=toggle]');
  b.innerHTML = icon(on ? 'pause' : 'play', 22);
  b.setAttribute('aria-label', on ? 'Mettre le son en pause' : 'Relancer le son');
  el.classList.toggle('is-paused', !on);
}

onPlayer(render);
export const initMiniPlayer = () => render();
