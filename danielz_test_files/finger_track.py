"""
Free-tools London mini demo:
- 3 London locations
- Animate a dot moving along the route on an OpenStreetMap (Leaflet) map
- When arriving at a stop, switch to an interactive 360° panorama you can drag around
- Uses only free/open tools:
  - OpenStreetMap tiles via Leaflet
  - OSRM public routing (no API key)
  - Photo Sphere Viewer (open-source) for 360 panoramas
  - Public-domain / free-license panorama images from Wikimedia Commons

Run:
  pip install flask requests
  python app.py
Then open:
  http://127.0.0.1:5000
"""

from flask import Flask, jsonify
import requests

app = Flask(__name__)

# 3 London POIs (lng, lat)
STOPS = [
    {
        "name": "Big Ben (Westminster)",
        "lng": -0.1246254,
        "lat": 51.5007292,
        # Free-use panorama (Wikimedia Commons; equirectangular)
        "pano_url": "https://upload.wikimedia.org/wikipedia/commons/6/63/Wikipedia_360_panorama%2C_London%2C_Trafalgar_Square.jpg",
    },
    {
        "name": "Tower Bridge",
        "lng": -0.0753565,
        "lat": 51.5054564,
        "pano_url": "https://upload.wikimedia.org/wikipedia/commons/7/7c/London_Panorama_-_Tower_Bridge.jpg",
    },
    {
        "name": "British Museum",
        "lng": -0.1268194,
        "lat": 51.5194133,
        "pano_url": "https://upload.wikimedia.org/wikipedia/commons/1/1f/British_Museum_Great_Court_Panorama.jpg",
    },
]

OSRM_BASE = "https://router.project-osrm.org"


def osrm_route(a, b):
    """
    Get a route polyline (GeoJSON coordinates) from OSRM between two points.
    Returns a list of [lng, lat] coords.
    """
    url = (
        f"{OSRM_BASE}/route/v1/walking/"
        f"{a['lng']},{a['lat']};{b['lng']},{b['lat']}"
        f"?overview=full&geometries=geojson"
    )
    r = requests.get(url, timeout=15)
    r.raise_for_status()
    data = r.json()
    coords = data["routes"][0]["geometry"]["coordinates"]  # [[lng,lat],...]
    return coords


@app.get("/")
def index():
    # Single-file HTML (served inline). No paid keys.
    html = f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>London Swipe-to-Trip Demo (Map + 360 Stops)</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />

  <!-- Leaflet (free, OSM tiles) -->
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

  <!-- Photo Sphere Viewer (open-source 360 viewer) -->
  <link rel="stylesheet" href="https://unpkg.com/@photo-sphere-viewer/core@5/index.css" />
  <script src="https://unpkg.com/@photo-sphere-viewer/core@5/index.js"></script>

  <style>
    html, body {{
      height: 100%;
      margin: 0;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
      background: #0b0f14;
      color: #e8eef6;
    }}
    #topbar {{
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 10px 12px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }}
    #topbar button {{
      background: #1c2a3a;
      border: 1px solid rgba(255,255,255,0.12);
      color: #e8eef6;
      padding: 8px 10px;
      border-radius: 10px;
      cursor: pointer;
    }}
    #topbar button:disabled {{
      opacity: 0.5;
      cursor: not-allowed;
    }}
    #topbar .pill {{
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.10);
    }}
    #wrap {{
      height: calc(100% - 52px);
      display: grid;
      grid-template-columns: 1fr;
    }}
    #map {{
      height: 100%;
      width: 100%;
    }}
    #pano {{
      height: 100%;
      width: 100%;
      display: none;
    }}
    #hint {{
      position: absolute;
      left: 12px;
      bottom: 12px;
      padding: 10px 12px;
      border-radius: 12px;
      background: rgba(0,0,0,0.55);
      border: 1px solid rgba(255,255,255,0.12);
      backdrop-filter: blur(8px);
      max-width: 520px;
      line-height: 1.25;
    }}
  </style>
</head>

<body>
  <div id="topbar">
    <button id="btnStart">Start Playback</button>
    <button id="btnBackToMap" style="display:none;">Back to Map</button>
    <span class="pill" id="status">Ready</span>
    <span class="pill" id="speedLabel">Speed: 1.2x</span>
    <input id="speed" type="range" min="0.5" max="3.0" value="1.2" step="0.1" />
  </div>

  <div id="wrap">
    <div id="map"></div>
    <div id="pano"></div>
  </div>

  <div id="hint">
    <b>What this demo does:</b>
    Map shows a dot moving between 3 London stops. When it arrives, it switches to a draggable 360° panorama.
    Use the speed slider anytime. Click “Back to Map” to continue.
  </div>

<script>
const statusEl = document.getElementById("status");
const btnStart = document.getElementById("btnStart");
const btnBackToMap = document.getElementById("btnBackToMap");
const speedSlider = document.getElementById("speed");
const speedLabel = document.getElementById("speedLabel");

function setStatus(msg) {{
  statusEl.textContent = msg;
}}

function setSpeedLabel() {{
  speedLabel.textContent = "Speed: " + Number(speedSlider.value).toFixed(1) + "x";
}}
speedSlider.addEventListener("input", setSpeedLabel);
setSpeedLabel();

// --- Map setup (OpenStreetMap tiles via Leaflet) ---
const map = L.map("map", {{
  zoomControl: true
}}).setView([51.5074, -0.1278], 13);

L.tileLayer("https://{{s}}.tile.openstreetmap.org/{{z}}/{{x}}/{{y}}.png", {{
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}}).addTo(map);

let routeLine = null;
let marker = null;
let stopMarkers = [];

// --- Panorama viewer state ---
let viewer = null;
const panoDiv = document.getElementById("pano");
const mapDiv = document.getElementById("map");

function showMap() {{
  panoDiv.style.display = "none";
  mapDiv.style.display = "block";
  btnBackToMap.style.display = "none";
  // Leaflet needs a resize invalidation when hidden/shown
  setTimeout(() => map.invalidateSize(), 80);
}}

function showPano(panoUrl, title) {{
  mapDiv.style.display = "none";
  panoDiv.style.display = "block";
  btnBackToMap.style.display = "inline-block";

  if (viewer) {{
    viewer.destroy();
    viewer = null;
  }}

  viewer = new PhotoSphereViewer.Viewer({{
    container: panoDiv,
    panorama: panoUrl,
    caption: title,
    defaultYaw: 0,
  }});
}}

btnBackToMap.addEventListener("click", () => {{
  showMap();
  // Resume playback if paused at a stop
  if (playbackState && playbackState.waitingAtStop) {{
    playbackState.waitingAtStop = false;
    setStatus("Continuing…");
    requestAnimationFrame(tick);
  }}
}});

// --- Fetch data from backend ---
async function loadTrip() {{
  setStatus("Loading routes (OSRM)…");
  const res = await fetch("/trip");
  const trip = await res.json();

  // Draw stops
  stopMarkers.forEach(m => map.removeLayer(m));
  stopMarkers = [];

  trip.stops.forEach((s, i) => {{
    const m = L.marker([s.lat, s.lng]).addTo(map).bindPopup(`<b>Stop {{"${{i+1}}"}}</b>: ${{s.name}}`);
    stopMarkers.push(m);
  }});

  // Draw full route line (all legs concatenated)
  const fullCoords = trip.full_route.map(p => [p[1], p[0]]); // Leaflet expects [lat,lng]
  if (routeLine) map.removeLayer(routeLine);
  routeLine = L.polyline(fullCoords, {{ weight: 4 }}).addTo(map);
  map.fitBounds(routeLine.getBounds(), {{ padding: [30, 30] }});

  // Create moving dot marker at first point
  const first = trip.full_route[0];
  if (marker) map.removeLayer(marker);
  marker = L.circleMarker([first[1], first[0]], {{
    radius: 7,
    fillOpacity: 1,
    opacity: 1
  }}).addTo(map);

  setStatus("Ready. Click Start Playback.");
  return trip;
}}

let tripData = null;
let playbackState = null;

function haversineMeters(lat1, lon1, lat2, lon2) {{
  const R = 6371000;
  const toRad = (x) => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}}

// Precompute cumulative distances along the polyline so we can move at "meters/sec"
function buildDistanceIndex(coordsLngLat) {{
  const cum = [0];
  for (let i = 1; i < coordsLngLat.length; i++) {{
    const [lng1, lat1] = coordsLngLat[i-1];
    const [lng2, lat2] = coordsLngLat[i];
    const d = haversineMeters(lat1, lng1, lat2, lng2);
    cum.push(cum[cum.length-1] + d);
  }}
  return cum;
}}

function pointAtDistance(coords, cumDist, targetMeters) {{
  // Find segment where cumDist[i] <= target < cumDist[i+1]
  let lo = 0, hi = cumDist.length - 1;
  while (lo < hi) {{
    const mid = Math.floor((lo + hi) / 2);
    if (cumDist[mid] < targetMeters) lo = mid + 1;
    else hi = mid;
  }}
  const i = Math.max(1, lo);
  const d0 = cumDist[i-1];
  const d1 = cumDist[i];
  const t = (d1 - d0) > 0 ? (targetMeters - d0) / (d1 - d0) : 0;
  const [lngA, latA] = coords[i-1];
  const [lngB, latB] = coords[i];
  const lng = lngA + (lngB - lngA) * t;
  const lat = latA + (latB - latA) * t;
  return [lng, lat];
}}

function nearestStopIndexByDistance(playbackMeters, stopMetersArray) {{
  // Returns the next stop index that hasn't been visited yet (based on meters along path)
  for (let i = 0; i < stopMetersArray.length; i++) {{
    if (!playbackState.visitedStops[i] && playbackMeters >= stopMetersArray[i]) {{
      return i;
    }}
  }}
  return -1;
}}

function initPlayback(trip) {{
  const coords = trip.full_route; // [[lng,lat],...]
  const cum = buildDistanceIndex(coords);
  const total = cum[cum.length - 1];

  // Map each stop to an approximate "meters along route" by snapping to nearest route point
  const stopMeters = trip.stops.map(s => {{
    let bestI = 0;
    let best = Infinity;
    for (let i = 0; i < coords.length; i++) {{
      const [lng, lat] = coords[i];
      const d = haversineMeters(lat, lng, s.lat, s.lng);
      if (d < best) {{
        best = d;
        bestI = i;
      }}
    }}
    return cum[bestI];
  }});

  playbackState = {{
    coords,
    cum,
    total,
    meters: 0,
    lastTs: null,
    waitingAtStop: false,
    visitedStops: trip.stops.map(() => false),
    stopMeters
  }};
}}

function arriveAtStop(stopIndex) {{
  playbackState.visitedStops[stopIndex] = true;
  playbackState.waitingAtStop = true;

  const stop = tripData.stops[stopIndex];
  setStatus(`Arrived: ${{stop.name}} — drag the panorama. Click Back to Map to continue.`);
  showPano(stop.pano_url, stop.name);
}}

function tick(ts) {{
  if (!playbackState || playbackState.waitingAtStop) return;

  if (playbackState.lastTs === null) playbackState.lastTs = ts;
  const dt = (ts - playbackState.lastTs) / 1000.0; // seconds
  playbackState.lastTs = ts;

  // Base walking speed ~ 1.4 m/s; multiply by speed slider
  const speedMult = Number(speedSlider.value);
  const metersPerSec = 1.4 * speedMult;

  playbackState.meters = Math.min(playbackState.total, playbackState.meters + metersPerSec * dt);

  // Update marker position
  const [lng, lat] = pointAtDistance(playbackState.coords, playbackState.cum, playbackState.meters);
  marker.setLatLng([lat, lng]);

  // Trigger arrival when we pass each stop's snapped distance
  const idx = nearestStopIndexByDistance(playbackState.meters, playbackState.stopMeters);
  if (idx !== -1) {{
    arriveAtStop(idx);
    return;
  }}

  if (playbackState.meters >= playbackState.total) {{
    setStatus("Finished route. (Reload to run again.)");
    btnStart.disabled = true;
    return;
  }}

  requestAnimationFrame(tick);
}}

btnStart.addEventListener("click", () => {{
  if (!tripData) return;
  btnStart.disabled = true;
  showMap();
  setStatus("Playing…");
  initPlayback(tripData);
  requestAnimationFrame(tick);
}});

(async () => {{
  tripData = await loadTrip();
}})();

</script>
</body>
</html>
"""
    return html


@app.get("/trip")
def trip():
    # Build OSRM routes between consecutive stops and concatenate
    legs = []
    full = []

    for i in range(len(STOPS) - 1):
        a = STOPS[i]
        b = STOPS[i + 1]
        coords = osrm_route(a, b)  # [[lng,lat],...]
        legs.append(coords)
        if i == 0:
            full.extend(coords)
        else:
            # avoid duplicate point at segment join
            full.extend(coords[1:])

    return jsonify(
        {
            "stops": STOPS,
            "legs": legs,
            "full_route": full,
        }
    )


if __name__ == "__main__":
    # Flask dev server
    app.run(host="127.0.0.1", port=5000, debug=True)
