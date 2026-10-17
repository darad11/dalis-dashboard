/*
 * Weather for Home: current conditions and today's sunrise and sunset from Open-Meteo
 * (https://open-meteo.com - free for non-commercial use, no API key, weather data CC BY 4.0;
 * the API documents the request and the WMO codes used in js/home-core.js).
 *
 * Runs only once a location is set in the Home settings (js/home-ui.js); a request carries
 * nothing but the coordinates. The last answer is kept on this device (localStorage), so the
 * card still shows the weather while offline, marked with its time. Fetched again after half
 * an hour, when the app returns to the foreground and when the connection comes back.
 */
(function () {
  'use strict';

  const Core = window.HomeCore;
  if (!Core) return;

  const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
  const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
  const CACHE_KEY = 'home.weather';
  const TIMEOUT_MS = 10000;

  // status: none (no location) | loading | ok | offline | error; data stays while a fetch fails
  const state = { status: 'none', location: null, data: null, fetchedAt: 0, error: null, loading: null };

  function readCache() {
    try {
      const cache = JSON.parse(localStorage.getItem(CACHE_KEY));
      return cache && typeof cache === 'object' ? cache : null;
    } catch (e) {
      return null;
    }
  }

  function writeCache(cache) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch (e) { /* storage full or blocked */ }
  }

  function sameLocation(a, b) {
    return !!a && !!b && a.latitude === b.latitude && a.longitude === b.longitude;
  }

  function notify() {
    window.dispatchEvent(new CustomEvent('dashboard:datachange', { detail: { key: 'weather' } }));
  }

  function forecastUrl(location) {
    const params = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      current: 'temperature_2m,weather_code,is_day',
      daily: 'sunrise,sunset',
      timezone: 'auto',
      forecast_days: '1'
    });
    return `${FORECAST_URL}?${params}`;
  }

  async function fetchJson(url) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), TIMEOUT_MS) : 0;
    try {
      const res = await fetch(url, controller ? { signal: controller.signal } : undefined);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  /** The location from the Home settings (null = none): shows the cached weather and fetches. */
  function setLocation(location) {
    if (sameLocation(state.location, location) && (state.location || !location)) return;
    state.location = location || null;
    state.data = null;
    state.fetchedAt = 0;
    state.error = null;
    if (!state.location) {
      state.status = 'none';
      notify();
      return;
    }
    const cache = readCache();
    const cached = cache && sameLocation(cache.location, state.location) ? Core.parseForecast(cache.json) : null;
    if (cached && Number.isFinite(cache.fetchedAt)) {
      state.data = cached;
      state.fetchedAt = cache.fetchedAt;
      state.status = 'ok';
    }
    refresh();
  }

  /** Fetches unless the weather is fresh (force: always). One request at a time. */
  function refresh(force) {
    const location = state.location;
    if (!location) return Promise.resolve();
    if (state.loading) return state.loading;
    if (!force && state.data && Core.weatherAge(state.fetchedAt, Date.now()) === 'fresh') return Promise.resolve();
    if (navigator.onLine === false) {
      state.status = 'offline';
      notify();
      return Promise.resolve();
    }
    state.status = 'loading';
    notify();
    state.loading = (async () => {
      try {
        const json = await fetchJson(forecastUrl(location));
        const data = Core.parseForecast(json);
        if (!data) throw new Error('Unexpected answer');
        if (state.location !== location) return; // the location changed meanwhile
        state.data = data;
        state.fetchedAt = Date.now();
        state.status = 'ok';
        state.error = null;
        writeCache({ location, fetchedAt: state.fetchedAt, json });
      } catch (e) {
        if (state.location !== location) return;
        state.status = navigator.onLine === false ? 'offline' : 'error';
        state.error = String((e && e.message) || e);
      } finally {
        state.loading = null;
        notify();
      }
    })();
    return state.loading;
  }

  /** Places for a typed name: [{ name, label, latitude, longitude, timezone }]. */
  async function search(query) {
    const name = typeof query === 'string' ? query.trim() : '';
    if (name.length < 2) return [];
    const params = new URLSearchParams({ name, count: '6', language: 'de', format: 'json' });
    const json = await fetchJson(`${GEOCODING_URL}?${params}`);
    const results = json && Array.isArray(json.results) ? json.results : [];
    return results
      .filter(r => r && typeof r.name === 'string' && Number.isFinite(r.latitude) && Number.isFinite(r.longitude))
      .map(r => ({ name: r.name, label: Core.placeLabel(r), latitude: r.latitude, longitude: r.longitude, timezone: typeof r.timezone === 'string' ? r.timezone : null }));
  }

  function current() {
    return {
      status: state.status,
      location: state.location,
      data: state.data,
      fetchedAt: state.fetchedAt,
      age: state.data ? Core.weatherAge(state.fetchedAt, Date.now()) : null,
      error: state.error
    };
  }

  window.addEventListener('online', () => { refresh(true); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });

  window.Weather = { setLocation, refresh, search, current, forecastUrl, FORECAST_URL, GEOCODING_URL };
})();
