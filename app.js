const COLORS = { ok: '#1a9850', no: '#d73027' };
const FALLBACK = { center: [47.8745, 8.0038], zoom: 12 }; // Feldberg, falls keine Position verfügbar

const map = L.map('map', { zoomControl: false }).setView(FALLBACK.center, FALLBACK.zoom);
L.control.zoom({ position: 'bottomright' }).addTo(map);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toast(text, ms = 4000) {
  const m = $('msg'); m.textContent = text; m.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (m.hidden = true), ms);
}

// --- Loipen ---------------------------------------------------------------
let trailLayer;
function renderTrails(data) {
  if (trailLayer) trailLayer.remove();
  let ok = 0, no = 0;
  trailLayer = L.geoJSON(data, {
    style: (f) => ({ color: COLORS[f.properties.befahrbar ? 'ok' : 'no'], weight: 6, opacity: .9,
      dashArray: f.properties.befahrbar ? null : '2 10', lineCap: 'round' }),
    onEachFeature: (f, layer) => {
      const p = f.properties;
      p.befahrbar ? ok++ : no++;
      layer.bindPopup(`<div class="popup"><h3>${esc(p.name)}</h3>
        <span class="badge ${p.befahrbar ? 'ok' : 'no'}">${p.befahrbar ? 'befahrbar' : 'nicht befahrbar'}</span>
        ${p.laenge_km ? `<p>Länge: ${esc(p.laenge_km)} km</p>` : ''}
        ${p.hinweis ? `<p>${esc(p.hinweis)}</p>` : ''}
        ${p.aktualisiert ? `<small>Stand: ${new Date(p.aktualisiert).toLocaleString('de-DE')}</small>` : ''}</div>`);
    },
  }).addTo(map);
  $('n-ok').textContent = ok; $('n-no').textContent = no;
  return trailLayer;
}

async function loadTrails() {
  try {
    const res = await fetch('data/loipen.geojson', { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    renderTrails(await res.json());
    $('updated').textContent = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    toast('Loipendaten konnten nicht geladen werden.');
  }
}

// --- Position -------------------------------------------------------------
let meMarker;
function locate() {
  if (!('geolocation' in navigator)) return toast('Standortabfrage wird nicht unterstützt.');
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      const ll = [coords.latitude, coords.longitude];
      if (!meMarker) meMarker = L.marker(ll, { icon: L.divIcon({ className: '', html: '<div class="me"></div>', iconSize: [16, 16] }) }).addTo(map);
      else meMarker.setLatLng(ll);
      map.setView(ll, 13);
    },
    (err) => toast(err.code === 1 ? 'Standortzugriff abgelehnt – zeige Standardansicht.' : 'Position nicht ermittelbar.'),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
}

$('locate').onclick = locate;
$('reload').onclick = loadTrails;
loadTrails().then(locate); // Karte beim Start auf aktuelle Position ausrichten

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
