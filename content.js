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

  const label    = type === 'shorts' ? 'YouTube Shorts' : 'Instagram';
  const minLeft  = minsUntilMidnight();
  const hours    = Math.floor(minLeft / 60);
  const mins     = minLeft % 60;
  const countdown = hours > 0 ? `${hours}h${mins > 0 ? mins : ''}` : `${mins} min`;

  const overlay = document.createElement('div');
  overlay.id = 'sb-overlay';
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 2147483647;
    background: #0f172a;
    display: flex; align-items: center; justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `;
  overlay.innerHTML = `
    <div style="text-align:center; max-width:360px; padding:32px; color:#f1f5f9;">
      <div style="font-size:64px; margin-bottom:16px;">⏰</div>
      <h1 style="font-size:22px; font-weight:700; margin:0 0 10px;">15 minutes atteintes</h1>
      <p style="font-size:15px; color:#94a3b8; margin:0 0 6px;">
        Tu as passé ton quota sur <strong style="color:#e2e8f0;">${label}</strong> aujourd'hui.
      </p>
      <p style="font-size:14px; color:#64748b; margin:0;">
        Reviens dans <strong style="color:#94a3b8;">${countdown}</strong> ✨
      </p>
    </div>
  `;

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
