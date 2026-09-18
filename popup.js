'use strict';

const LIMIT_MS = 15 * 60 * 1000; // 15 minutes

function todayKey(type) {
  return `${type}:${new Date().toLocaleDateString('en-CA')}`;
}

function fmtMs(ms) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function colorClass(ms) {
  const pct = ms / LIMIT_MS;
  if (pct >= 1)    return 'danger';
  if (pct >= 0.66) return 'warn';
  return 'ok';
}

async function refresh() {
  const data = await chrome.storage.local.get([todayKey('shorts'), todayKey('instagram')]);
  const sMs = data[todayKey('shorts')]   || 0;
  const iMs = data[todayKey('instagram')] || 0;

  const sPct = Math.min(100, (sMs / LIMIT_MS) * 100).toFixed(1);
  const iPct = Math.min(100, (iMs / LIMIT_MS) * 100).toFixed(1);

  document.getElementById('shorts-time').textContent = fmtMs(sMs);
  document.getElementById('shorts-time').className   = `time ${colorClass(sMs)}`;
  document.getElementById('shorts-bar').style.width  = `${sPct}%`;

  document.getElementById('insta-time').textContent  = fmtMs(iMs);
  document.getElementById('insta-time').className    = `time ${colorClass(iMs)}`;
  document.getElementById('insta-bar').style.width   = `${iPct}%`;

  const now      = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const minLeft  = Math.ceil((midnight - now) / 60_000);
  const h = Math.floor(minLeft / 60), m = minLeft % 60;
  document.getElementById('reset-info').textContent =
    `Reset dans ${h > 0 ? h + 'h' : ''}${m > 0 ? m + ' min' : ''}`;
}

refresh();
setInterval(refresh, 1000);
