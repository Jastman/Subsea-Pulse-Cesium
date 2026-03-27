/**
 * LatencySimulator.js
 *
 * Generates synthetic real-time latency readings for four global regions.
 * If a WebSocket server is available at ws://localhost:8765 (e.g. the
 * Raspberry Pi latency script), it will prefer live data.  Otherwise it
 * falls back to a realistic stochastic simulation.
 *
 * Usage:
 *   const sim = new LatencySimulator();
 *   sim.onUpdate(data => console.log(data));
 *   sim.start();
 *   // later:
 *   sim.stop();
 */

// Base latencies (ms) per region under normal conditions
const BASE_LATENCY = {
  NA:    18,
  EU:    22,
  APAC:  95,
  LATAM: 140,
};

// Variance amplitude per region
const VARIANCE = {
  NA:    12,
  EU:    15,
  APAC:  40,
  LATAM: 55,
};

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Smooth random walk step.
 * @param {number} current - current value
 * @param {number} base    - target mean
 * @param {number} variance
 * @param {number} stress  - 0–1 stress multiplier
 */
function walk(current, base, variance, stress) {
  const stressBoost = 1 + stress * 4;
  const noise = (Math.random() - 0.5) * variance * stressBoost;
  // Mean-revert toward base
  const revert = (base * stressBoost - current) * 0.15;
  return clamp(current + noise + revert, 1, 2000);
}

export class LatencySimulator {
  constructor() {
    this._callbacks = [];
    this._intervalId = null;
    this._ws = null;
    this._stress = 0;     // 0–1, set externally via setStress()

    // Running state
    this._state = {
      NA:    BASE_LATENCY.NA,
      EU:    BASE_LATENCY.EU,
      APAC:  BASE_LATENCY.APAC,
      LATAM: BASE_LATENCY.LATAM,
    };
  }

  /**
   * Register a callback invoked with latency data on each tick.
   * @param {function} cb - receives { avg, regions: { NA, EU, APAC, LATAM } }
   */
  onUpdate(cb) {
    this._callbacks.push(cb);
    return this; // chainable
  }

  /**
   * Set the current network stress level (0 = normal, 1 = maximum congestion).
   */
  setStress(value) {
    this._stress = clamp(value, 0, 1);
  }

  /**
   * Start emitting latency ticks every 1 second.
   * Attempts WebSocket first, falls back to simulation.
   */
  start() {
    this._tryWebSocket();
    // Simulation ticker always runs; WS data overrides it when available
    this._intervalId = setInterval(() => this._tick(), 1000);
    return this;
  }

  stop() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
  }

  _tick() {
    const s = this._stress;
    this._state.NA    = walk(this._state.NA,    BASE_LATENCY.NA,    VARIANCE.NA,    s);
    this._state.EU    = walk(this._state.EU,    BASE_LATENCY.EU,    VARIANCE.EU,    s);
    this._state.APAC  = walk(this._state.APAC,  BASE_LATENCY.APAC,  VARIANCE.APAC,  s);
    this._state.LATAM = walk(this._state.LATAM, BASE_LATENCY.LATAM, VARIANCE.LATAM, s);

    const values = Object.values(this._state);
    const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);

    const payload = {
      avg,
      regions: {
        NA:    Math.round(this._state.NA),
        EU:    Math.round(this._state.EU),
        APAC:  Math.round(this._state.APAC),
        LATAM: Math.round(this._state.LATAM),
      },
    };
    this._emit(payload);
  }

  _emit(data) {
    for (const cb of this._callbacks) {
      try { cb(data); } catch (_) {}
    }
  }

  _tryWebSocket() {
    try {
      const ws = new WebSocket('ws://localhost:8765');
      ws.onopen = () => { this._ws = ws; };
      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          // Expected shape: { NA, EU, APAC, LATAM } or { avg, regions }
          if (data.regions) {
            Object.assign(this._state, data.regions);
          } else {
            Object.assign(this._state, data);
          }
        } catch (_) {}
      };
      ws.onerror = () => { this._ws = null; };
      ws.onclose = () => { this._ws = null; };
    } catch (_) {
      // WebSocket not available — simulation-only mode
    }
  }
}
