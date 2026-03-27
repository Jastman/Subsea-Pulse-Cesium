/**
 * UI.js
 * Manages all DOM overlay components:
 *   - Global Health Monitor HUD (top bar)
 *   - Cable Inspector sidebar (glassmorphism slide-out)
 *   - Network Stress slider
 *   - Time Machine year slider
 *   - Loading overlay
 */

// ─── Loading Overlay ─────────────────────────────────────────────────────────

export function setLoadStatus(message) {
  const el = document.getElementById('load-status');
  if (el) el.textContent = message;
}

export function hideLoadingOverlay() {
  const overlay = document.getElementById('loading-overlay');
  if (!overlay) return;
  overlay.style.opacity = '0';
  overlay.style.transition = 'opacity 0.8s ease';
  setTimeout(() => { overlay.style.display = 'none'; }, 850);
}

// ─── Global Health Monitor HUD ───────────────────────────────────────────────

/**
 * Update the top-bar HUD with fresh latency data.
 * @param {{ avg: number, regions: { NA, EU, APAC, LATAM } }} data
 */
export function updateHUD(data) {
  const avgEl = document.getElementById('avg-latency');
  if (avgEl) {
    avgEl.textContent = `${data.avg} ms`;
    // Color the avg value based on severity
    avgEl.className = 'hud-value ' + latencyClass(data.avg, 60, 150);
  }

  const regionMap = {
    NA:    document.getElementById('lat-NA'),
    EU:    document.getElementById('lat-EU'),
    APAC:  document.getElementById('lat-APAC'),
    LATAM: document.getElementById('lat-LATAM'),
  };

  for (const [region, el] of Object.entries(regionMap)) {
    if (!el) continue;
    const ms = data.regions[region];
    el.textContent = `${region} ${ms}ms`;
    el.className   = 'region-badge ' + latencyClass(ms, 80, 200);
  }
}

function latencyClass(ms, warnThreshold, critThreshold) {
  if (ms >= critThreshold) return 'status-critical';
  if (ms >= warnThreshold) return 'status-warn';
  return 'status-ok';
}

// ─── Cable Count ──────────────────────────────────────────────────────────────

export function setCableCount(n) {
  const el = document.getElementById('cable-count');
  if (el) el.textContent = n.toLocaleString();
}

// ─── Cable Inspector Sidebar ──────────────────────────────────────────────────

let _sidebarOpen = false;

/**
 * Show the cable inspector sidebar with the given cable properties.
 * @param {{ name, owners, length, rfs, landingPoints, stress }} info
 */
export function showCableSidebar(info) {
  setText('cable-name',    info.name    || 'Unknown Cable');
  setText('cable-owners',  formatList(info.owners));
  setText('cable-length',  info.length  ? `${Number(info.length).toLocaleString()} km` : '—');
  setText('cable-rfs',     info.rfs     || '—');
  setText('cable-landing', info.landingPoints != null ? String(info.landingPoints) : '—');

  // Pulse bar fill represents inverse stress (healthy = full cyan bar)
  const fill = document.getElementById('pulse-bar-fill');
  if (fill) {
    const healthPct = Math.round((1 - (info.stress ?? 0)) * 100);
    fill.style.width = `${healthPct}%`;
    fill.style.background = info.stress > 0.6
      ? 'linear-gradient(90deg, #FF3131, #ff6b6b)'
      : 'linear-gradient(90deg, #00F5FF, #0096a8)';
  }

  const sidebar = document.getElementById('cable-sidebar');
  if (sidebar) {
    sidebar.classList.remove('sidebar-hidden');
    sidebar.classList.add('sidebar-visible');
    _sidebarOpen = true;
  }
}

export function hideCableSidebar() {
  const sidebar = document.getElementById('cable-sidebar');
  if (sidebar) {
    sidebar.classList.remove('sidebar-visible');
    sidebar.classList.add('sidebar-hidden');
    _sidebarOpen = false;
  }
}

export function isSidebarOpen() {
  return _sidebarOpen;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function formatList(owners) {
  if (!owners) return '—';
  if (Array.isArray(owners)) return owners.join(', ') || '—';
  if (typeof owners === 'string') return owners || '—';
  return '—';
}

// ─── Network Stress Slider ────────────────────────────────────────────────────

/**
 * Initialize the Network Stress slider.
 * @param {function} onChange - called with normalized stress value (0.0–1.0)
 */
export function initStressSlider(onChange) {
  const slider = document.getElementById('stress-slider');
  const label  = document.getElementById('stress-value');
  if (!slider) return;

  slider.addEventListener('input', () => {
    const pct = parseInt(slider.value, 10);
    if (label) label.textContent = `${pct}%`;
    onChange(pct / 100);
  });
}

// ─── Time Machine Slider ───────────────────────────────────────────────────────

/**
 * Initialize the Time Machine year slider.
 * @param {function} onYearChange - called with the selected year (integer)
 */
export function initYearSlider(onYearChange) {
  const slider = document.getElementById('year-slider');
  const label  = document.getElementById('year-value');
  if (!slider) return;

  slider.addEventListener('input', () => {
    const year = parseInt(slider.value, 10);
    if (label) label.textContent = String(year);
    onYearChange(year);
  });
}

// ─── Sidebar Close Button ────────────────────────────────────────────────────

export function initSidebarClose() {
  const btn = document.getElementById('sidebar-close');
  if (btn) btn.addEventListener('click', hideCableSidebar);
}
