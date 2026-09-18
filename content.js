'use strict';

const LIMIT_MS      = 15 * 60 * 1000; // 15 minutes
const SYNC_EVERY_MS = 1_000;

const IS_YT    = location.hostname.includes('youtube.com');
const IS_INSTA = location.hostname.includes('instagram.com');

let activeType   = null;
let sessionStart = null;
let storedMs     = 0;
let blocked      = false;
let syncTimer    = null;

// ── Storage (localStorage = source de vérité, chrome.storage = popup only) ──

function todayKey(type) {
  return `${type}:${new Date().toLocaleDateString('en-CA')}`;
}

function loadStored(type) {
  return parseFloat(localStorage.getItem(todayKey(type)) || '0');
}

function saveStored(type, ms) {
  localStorage.setItem(todayKey(type), String(ms));
  try { chrome.storage.local.set({ [todayKey(type)]: ms }); } catch (_) {}
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function currentType() {
  if (IS_INSTA) return 'instagram';
  if (IS_YT && location.pathname.startsWith('/shorts/')) return 'shorts';
  return null;
}

function totalMs() {
  return storedMs + (sessionStart ? Date.now() - sessionStart : 0);
}

// ── Session lifecycle ─────────────────────────────────────────────────────────

function startSession(type) {
  if (blocked || sessionStart !== null) return;
  storedMs = loadStored(type);
  if (storedMs >= LIMIT_MS) { showBlock(type); return; }
  activeType   = type;
  sessionStart = Date.now();
  syncTimer    = setInterval(sync, SYNC_EVERY_MS);
}

function stopSession() {
  if (sessionStart === null) return;
  storedMs     = totalMs();
  sessionStart = null;
  clearInterval(syncTimer);
  syncTimer = null;
  if (activeType) saveStored(activeType, storedMs);
}

function sync() {
  const ms = totalMs();
  if (activeType) saveStored(activeType, ms);
  if (ms >= LIMIT_MS) {
    const t = activeType;
    stopSession();
    showBlock(t);
  }
}

// ── Block overlay ─────────────────────────────────────────────────────────────

const STATES = {
  fatigue: {
    emoji: '😴', label: 'Très fatiguée',
    items: [
      { text: 'Regarder un film sur Arte',     url: 'https://www.arte.tv/fr/' },
      { text: 'Regarder un film sur France TV', url: 'https://www.france.tv/' },
      { text: 'Regarder une série sur Netflix', url: 'https://www.netflix.com/' },
      { text: 'Faire une sieste ou aller dormir' },
      { text: 'Fermer les yeux 5 min, poser l\'ordi' },
    ]
  },
  stress: {
    emoji: '😰', label: 'Pensées en boucle',
    items: [
      { text: 'Prendre un anxiolytique si prescrit' },
      { text: 'Cohérence cardiaque — inspire 5s, expire 5s, répète 5×' },
      { text: 'Débunker la situation avec ChatGPT', url: 'https://chatgpt.com' },
      { text: 'Appelle une amie — Typhaine, Marie, Maëlle, Colette, Gabrielle, Julie' },
    ]
  },
  ennui: {
    emoji: '😑', label: 'Ennui',
    items: [
      { text: 'Lire un article du CNRS', url: 'https://lejournal.cnrs.fr/' },
      { text: 'Lire un livre' },
      { text: 'Faire une activité manuelle' },
      { text: 'Promener Vishou 🐕' },
      { text: 'Écrire dans mon calepin' },
      { text: 'Dessiner' },
      { text: 'Faire un Decat Coach' },
      { text: 'Planifier ma journée', url: 'https://tasks.google.com/' },
    ]
  },
};

const BTN = `
  padding:14px 16px; border-radius:14px; border:none; cursor:pointer;
  font-size:15px; font-weight:600; text-align:left; width:100%;
  transition: opacity .15s;
`;

function minsUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.ceil((midnight - now) / 60_000);
}

function showBlock(type) {
  if (blocked) return;
  blocked = true;
  stopSession();

  const label   = type === 'shorts' ? 'YouTube Shorts' : 'Instagram';
  const minLeft = minsUntilMidnight();
  const h = Math.floor(minLeft / 60), m = minLeft % 60;
  const countdown = h > 0 ? `${h}h${m > 0 ? m : ''}` : `${m} min`;

  const overlay = document.createElement('div');
  overlay.id = 'sb-overlay';
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 2147483647; background: #0f172a;
    display: flex; align-items: center; justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    overflow-y: auto;
  `;

  // ── Écran 1 : question ──
  const screenQ = document.createElement('div');
  screenQ.style.cssText = 'text-align:center; max-width:400px; width:100%; padding:32px; color:#f1f5f9;';
  screenQ.innerHTML = `
    <div style="font-size:52px; margin-bottom:10px;">⏰</div>
    <h1 style="font-size:20px; font-weight:700; margin:0 0 4px;">15 minutes atteintes</h1>
    <p style="font-size:13px; color:#475569; margin:0 0 28px;">
      ${label} · reset dans ${countdown}
    </p>
    <p style="font-size:16px; color:#94a3b8; margin:0 0 16px; font-weight:600;">Comment tu te sens là ?</p>
    <div style="display:flex; flex-direction:column; gap:10px;">
      <button data-state="fatigue" style="${BTN} background:#1e3a5f; color:#93c5fd;">😴 Très fatiguée</button>
      <button data-state="stress"  style="${BTN} background:#3b1f2b; color:#fca5a5;">😰 Pensées en boucle</button>
      <button data-state="ennui"   style="${BTN} background:#14291f; color:#86efac;">😑 Je m'ennuie</button>
    </div>
  `;

  // ── Écran 2 : suggestions ──
  const screenS = document.createElement('div');
  screenS.style.cssText = 'display:none; max-width:400px; width:100%; padding:32px; color:#f1f5f9;';

  function showSuggestions(stateKey) {
    const state = STATES[stateKey];
    const items = state.items.map(item => {
      if (item.url) {
        return `<li style="margin-bottom:12px;">
          <a href="${item.url}" target="_blank" rel="noopener"
             style="color:#60a5fa; text-decoration:none; font-size:15px; font-weight:500;">
            → ${item.text}
          </a>
        </li>`;
      }
      return `<li style="margin-bottom:12px; color:#cbd5e1; font-size:15px;">→ ${item.text}</li>`;
    }).join('');

    screenS.innerHTML = `
      <button id="sb-back" style="background:none; border:none; color:#475569; cursor:pointer;
        font-size:13px; padding:0; margin-bottom:20px; display:flex; align-items:center; gap:4px;">
        ← Retour
      </button>
      <p style="font-size:24px; margin:0 0 6px;">${state.emoji}</p>
      <h2 style="font-size:18px; font-weight:700; color:#f1f5f9; margin:0 0 20px;">${state.label}</h2>
      <ul style="list-style:none; padding:0; margin:0;">${items}</ul>
    `;
    screenQ.style.display = 'none';
    screenS.style.display = 'block';
    screenS.querySelector('#sb-back').addEventListener('click', () => {
      screenS.style.display = 'none';
      screenQ.style.display = 'block';
    });
  }

  screenQ.querySelectorAll('[data-state]').forEach(btn => {
    btn.addEventListener('click', () => showSuggestions(btn.dataset.state));
  });

  overlay.appendChild(screenQ);
  overlay.appendChild(screenS);

  const silenceVideos = () => {
    document.querySelectorAll('video').forEach(v => { v.pause(); v.muted = true; });
  };

  const inject = () => {
    silenceVideos();
    if (!document.getElementById('sb-overlay')) {
      document.body.style.overflow = 'hidden';
      document.body.appendChild(overlay);
    }
  };
  inject();

  new MutationObserver(inject).observe(document.documentElement, {
    childList: true, subtree: true,
  });
}

// ── Navigation SPA (YouTube) ──────────────────────────────────────────────────

function onNav() {
  const t = currentType();
  if (t === activeType) return;
  stopSession();
  activeType = null;
  if (t) startSession(t);
}

if (IS_YT) {
  let lastPath = location.pathname;
  setInterval(() => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      onNav();
    }
  }, 500);
  document.addEventListener('yt-navigate-finish',   onNav);
  document.addEventListener('yt-page-data-updated', onNav);
  window.addEventListener('popstate', onNav);
}

// ── Visibility ────────────────────────────────────────────────────────────────

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopSession();
  } else {
    const t = currentType();
    if (t && !blocked) startSession(t);
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────

(() => {
  const t = currentType();
  if (t) startSession(t);
})();
