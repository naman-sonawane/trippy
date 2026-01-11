'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type LatLng = { lat: number; lng: number };
const DEFAULT_COORDS: LatLng = { lat: 40.758, lng: -73.9855 }; // Times Square

// ---------- Backend (FastAPI) ----------
const API_BASE = "http://localhost:8000";
const ENDPOINT_FINGER = `${API_BASE}/api/finger-track`;
const ENDPOINT_VIEW_ADJUST = `${API_BASE}/api/view-adjust`;
const ENDPOINT_STATUS = `${API_BASE}/api/status`;

// ---------- Google Maps types ----------
type GoogleMapsLoaded = {
  maps: {
    StreetViewService: new () => GoogleStreetViewService;
    StreetViewPanorama: new (
      container: HTMLElement,
      opts: StreetViewPanoramaOptions
    ) => GoogleStreetViewPanorama;
    Geocoder: new () => GoogleGeocoder;
    StreetViewSource: { OUTDOOR: string };
    StreetViewPreference: { BEST: string };
    StreetViewStatus: { OK: string };
    GeocoderStatus: { OK: string };
  };
};

type GoogleGeocoder = {
  geocode: (
    request: { address: string },
    callback: (results: GeocoderResult[] | null, status: string) => void
  ) => void;
};

type GeocoderResult = {
  geometry: {
    location: {
      lat: () => number;
      lng: () => number;
    };
  };
  formatted_address: string;
};

type GoogleStreetViewService = {
  getPanorama: (
    request: {
      location: LatLng;
      radius: number;
      source: string;
      preference: string;
    },
    callback: (data: PanoramaData | null, status: string) => void
  ) => void;
};

type PanoramaData = {
  location?: { latLng?: LatLng };
};

type StreetViewPanoramaOptions = {
  position: LatLng;
  pov: { heading: number; pitch: number };
  zoom: number;
  addressControl: boolean;
  linksControl: boolean;
  panControl: boolean;
  enableCloseButton: boolean;
  fullscreenControl: boolean;
  motionTracking: boolean;
  motionTrackingControl: boolean;
  showRoadLabels: boolean;
};

type StreetViewPov = { heading: number; pitch: number };

type GoogleStreetViewPanorama = {
  addListener: (event: string, callback: () => void) => void;
  getPosition: () => { lat: () => number; lng: () => number } | null;
  getPov: () => StreetViewPov;
  setPov: (pov: StreetViewPov) => void;
  setPosition: (pos: LatLng) => void;
};

declare global {
  interface Window {
    google?: GoogleMapsLoaded;
  }
}

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

function wrapHeading(deg: number) {
  const d = deg % 360;
  return d < 0 ? d + 360 : d;
}

function shortestAngleDeltaDeg(fromDeg: number, toDeg: number) {
  const a = wrapHeading(fromDeg);
  const b = wrapHeading(toDeg);
  let d = b - a;
  if (d >= 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

export default function GoogleStreetViewPage() {
  const searchParams = useSearchParams();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panoramaRef = useRef<GoogleStreetViewPanorama | null>(null);

  const locationParam = searchParams.get("location");
  const [coords, setCoords] = useState<LatLng>(DEFAULT_COORDS);
  const [status, setStatus] = useState<string>("Loading…");
  const [isApiLoaded, setIsApiLoaded] = useState<boolean>(false);

  const [backendStatus, setBackendStatus] = useState<string>("Checking backend…");
  const [handStatus, setHandStatus] = useState<string>("Waiting for backend…");
  const [lastSwipe, setLastSwipe] = useState<0 | 1 | 2>(0);
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);
  const [isBackendRunning, setIsBackendRunning] = useState(false);

  // Location search state
  const [searchInput, setSearchInput] = useState(locationParam || "");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [currentLocation, setCurrentLocation] = useState(locationParam || "Times Square, NYC");

  // Smoothing state
  const smoothRef = useRef<{
    initialized: boolean;
    heading: number;
    pitch: number;
    lastT: number;
  }>({ initialized: false, heading: 0, pitch: 0, lastT: 0 });

  const navigateToLocation = useCallback((newCoords: LatLng, locationName?: string) => {
    setCoords(newCoords);
    if (locationName) {
      setCurrentLocation(locationName);
    }
    // Reset smoothing when jumping to new location
    smoothRef.current.initialized = false;
  }, []);

  // Search for a place by name
  const searchPlace = useCallback(async (placeName: string) => {
    if (!placeName.trim() || !window.google?.maps) {
      return;
    }

    setIsSearching(true);
    setSearchError("");
    setStatus("Searching for location…");

    const geocoder = new window.google.maps.Geocoder();

    geocoder.geocode({ address: placeName }, (results, status) => {
      setIsSearching(false);

      if (status === window.google!.maps.GeocoderStatus.OK && results && results.length > 0) {
        const location = results[0].geometry.location;
        const coords = {
          lat: location.lat(),
          lng: location.lng(),
        };
        
        navigateToLocation(coords, results[0].formatted_address);
        setSearchInput("");
        setStatus("Finding Street View…");
      } else {
        setSearchError(`Could not find "${placeName}". Try a different search.`);
        setStatus("Location not found");
      }
    });
  }, [navigateToLocation]);

  const handleSearchClick = useCallback(() => {
    if (searchInput.trim()) {
      searchPlace(searchInput.trim());
    }
  }, [searchInput, searchPlace]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchInput.trim()) {
      searchPlace(searchInput.trim());
    }
  }, [searchInput, searchPlace]);

  useEffect(() => {
    if (locationParam && locationParam !== searchInput) {
      setSearchInput(locationParam);
      setCurrentLocation(locationParam);
      if (isApiLoaded) {
        searchPlace(locationParam);
      }
    }
  }, [locationParam, isApiLoaded, searchInput, searchPlace]);

  // Load Google Maps
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (window.google?.maps) {
      setIsApiLoaded(true);
      if (locationParam) {
        searchPlace(locationParam);
      }
      return;
    }

    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      const handleLoad = () => setIsApiLoaded(true);
      existingScript.addEventListener("load", handleLoad);
      return () => existingScript.removeEventListener("load", handleLoad);
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyDY1pbD7iMKsqfQ73Nl5KvsTK1ttEo9-L4`;
    script.async = true;
    script.defer = true;

    const handleLoad = () => {
      setIsApiLoaded(true);
      if (locationParam) {
        searchPlace(locationParam);
      }
    };
    const handleError = () => setStatus("Failed to load Google Maps API");

    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);
    document.head.appendChild(script);

    return () => {
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
    };
  }, [locationParam]);

  // Init Street View
  useEffect(() => {
    if (!isApiLoaded || !containerRef.current || !window.google?.maps) return;

    const google = window.google;
    const streetViewService = new google.maps.StreetViewService();

    setStatus("Finding Street View…");

    streetViewService.getPanorama(
      {
        location: coords,
        radius: 100,
        source: google.maps.StreetViewSource.OUTDOOR,
        preference: google.maps.StreetViewPreference.BEST,
      },
      (data, svStatus) => {
        if (svStatus === google.maps.StreetViewStatus.OK && data?.location?.latLng && containerRef.current) {
          const panorama = new google.maps.StreetViewPanorama(containerRef.current, {
            position: data.location.latLng,
            pov: { heading: 0, pitch: 0 },
            zoom: 1,
            addressControl: true,
            linksControl: true,
            panControl: true,
            enableCloseButton: false,
            fullscreenControl: true,
            motionTracking: true,
            motionTrackingControl: true,
            showRoadLabels: true,
          });

          panoramaRef.current = panorama;
          setStatus("Move your hand to look around");
        } else {
          setStatus("No Street View available here");
        }
      }
    );

    return () => {
      panoramaRef.current = null;
    };
  }, [coords, isApiLoaded]);

  // Check backend status on mount
  useEffect(() => {
    async function checkBackend() {
      try {
        const res = await fetch(ENDPOINT_STATUS);
        const data = await res.json();
        
        if (data.running) {
          setBackendStatus("Backend camera running ✓");
          setIsBackendRunning(true);
          setHandStatus("Ready to track");
        } else {
          setBackendStatus("Backend not running ✗");
          setHandStatus("Backend camera not started");
        }
      } catch (e) {
        setBackendStatus("Backend unreachable ✗");
        setHandStatus("Cannot connect to backend");
        console.error("Backend check failed:", e);
      }
    }

    checkBackend();
    const interval = setInterval(checkBackend, 5000);

    return () => clearInterval(interval);
  }, []);

  // Hand tracking loop
  useEffect(() => {
    if (!isBackendRunning) return;

    let alive = true;
    let inFlight = false;

    const POLL_INTERVAL_MS = 100;

    const SMOOTHING = {
      headingTauMs: 120,
      pitchTauMs: 100,
      headingDeadbandDeg: 0.3,
      pitchDeadbandDeg: 0.2,
      maxHeadingStepDeg: 8,
      maxPitchStepDeg: 5,
    };

    function alphaFromTau(dtMs: number, tauMs: number) {
      if (tauMs <= 0) return 1;
      return clamp(1 - Math.exp(-dtMs / tauMs), 0, 1);
    }

    async function tick() {
      if (!alive || inFlight) return;

      const pano = panoramaRef.current;
      if (!pano) {
        setHandStatus("Waiting for Street View…");
        return;
      }

      inFlight = true;
      try {
        const [posRes, swipeRes] = await Promise.all([
          fetch(ENDPOINT_VIEW_ADJUST).then(r => r.json()) as Promise<{ x_frac: number; y_frac: number }>,
          fetch(ENDPOINT_FINGER).then(r => r.json()) as Promise<{ swipe: 0 | 1 | 2; direction: string }>,
        ]);

        if (!alive) return;

        setLastSwipe(swipeRes.swipe);
        setLastPos({ x: posRes.x_frac, y: posRes.y_frac });
        setHandStatus(`Tracking (${swipeRes.direction})`);

        const xRaw = clamp(posRes.x_frac, 0, 1);
        const x = 1 - xRaw;
        const y = clamp(posRes.y_frac, 0, 1);

        const targetHeading = wrapHeading(x * 360);
        const targetPitch = clamp((0.5 - y) * 80, -40, 40);

        let newHeading = targetHeading;
        let newPitch = targetPitch;

        if (swipeRes.swipe === 1) newHeading = wrapHeading(newHeading + 30);
        if (swipeRes.swipe === 2) newHeading = wrapHeading(newHeading - 30);

        const now = performance.now();
        const s = smoothRef.current;

        if (!s.initialized) {
          const pov = pano.getPov();
          s.initialized = true;
          s.heading = pov ? wrapHeading(pov.heading) : newHeading;
          s.pitch = pov ? pov.pitch : newPitch;
          s.lastT = now;
        }

        const dtMs = Math.max(1, now - s.lastT);
        s.lastT = now;

        const dHead = shortestAngleDeltaDeg(s.heading, newHeading);
        const dPitch = newPitch - s.pitch;

        const dHeadEff = Math.abs(dHead) < SMOOTHING.headingDeadbandDeg ? 0 : dHead;
        const dPitchEff = Math.abs(dPitch) < SMOOTHING.pitchDeadbandDeg ? 0 : dPitch;

        const aHead = alphaFromTau(dtMs, SMOOTHING.headingTauMs);
        const aPitch = alphaFromTau(dtMs, SMOOTHING.pitchTauMs);

        let stepHead = dHeadEff * aHead;
        let stepPitch = dPitchEff * aPitch;

        stepHead = clamp(stepHead, -SMOOTHING.maxHeadingStepDeg, SMOOTHING.maxHeadingStepDeg);
        stepPitch = clamp(stepPitch, -SMOOTHING.maxPitchStepDeg, SMOOTHING.maxPitchStepDeg);

        s.heading = wrapHeading(s.heading + stepHead);
        s.pitch = clamp(s.pitch + stepPitch, -40, 40);

        pano.setPov({ heading: s.heading, pitch: s.pitch });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes("aborted")) {
          console.error(e);
          setHandStatus(`Error: ${msg.substring(0, 30)}`);
        }
      } finally {
        inFlight = false;
      }
    }

    const interval = setInterval(() => void tick(), POLL_INTERVAL_MS);

    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [isBackendRunning]);

  return (
    <div className="w-full h-screen relative"
         style={{
           backgroundImage: "url(/anotherbg.jpg)",
           backgroundSize: "cover",
           backgroundPosition: "center",
           backgroundRepeat: "no-repeat",
           backgroundAttachment: "fixed"
         }}>
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/70" />
      <div className="relative z-10 text-white">
      <div className="absolute top-6 left-6 z-20 bg-white/10 backdrop-blur-md p-4 rounded-xl w-[380px] shadow-2xl border border-white/20">
        <div className="text-xl font-semibold">Hand-Controlled Street View</div>
        <div className="text-sm text-white/70 mt-1">{status}</div>
        <div className="text-xs text-white/50 mt-1">{currentLocation}</div>
        <div className="text-xs text-white/40 mt-1">
          {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
        </div>

        <div className="mt-4 p-3 rounded-lg bg-white/5 border border-white/10">
          <div className="text-xs font-medium text-white/80 mb-2">Search Location</div>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="e.g., Big Ben, Statue of Liberty..."
              className="flex-1 px-3 py-2 text-xs bg-black/60 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500/50"
              disabled={isSearching || !isApiLoaded}
            />
            <button
              onClick={handleSearchClick}
              disabled={isSearching || !searchInput.trim() || !isApiLoaded}
              className="px-4 py-2 text-xs rounded-lg bg-blue-500/20 hover:bg-blue-500/30 disabled:opacity-40 disabled:cursor-not-allowed border border-blue-500/30 transition-colors font-medium"
            >
              {isSearching ? "..." : "Go"}
            </button>
          </div>
          {searchError && (
            <div className="mt-2 text-xs text-red-300">{searchError}</div>
          )}
        </div>

        <div className="mt-3 p-3 rounded-lg bg-white/5 border border-white/10">
          <div className="text-xs font-medium text-white/80 mb-2">Backend Status</div>
          
          <div className="text-xs text-white/70 mb-2">
            Camera: <span className={`font-medium ${
              isBackendRunning ? "text-green-400" : "text-red-400"
            }`}>
              {isBackendRunning ? "● Running" : "○ Not Running"}
            </span>
          </div>

          <div className="text-xs text-white/60">{backendStatus}</div>

          {!isBackendRunning && (
            <div className="mt-2 p-2 text-xs text-yellow-300 bg-yellow-500/10 rounded border border-yellow-500/20">
              Start the Python backend with: <code className="bg-black/40 px-1 rounded">python main.py</code>
            </div>
          )}
        </div>

        <div className="mt-3 p-3 rounded-lg bg-white/5 border border-white/10">
          <div className="text-xs font-medium text-white/80 mb-2">Hand Tracking</div>
          <div className="text-xs text-white/60">{handStatus}</div>
          <div className="mt-2 text-xs text-white/50">
            Swipe: {lastSwipe === 1 ? "→ Right" : lastSwipe === 2 ? "← Left" : "None"} 
            {lastPos && ` • Position: ${(lastPos.x * 100).toFixed(0)}%, ${(lastPos.y * 100).toFixed(0)}%`}
          </div>
        </div>

        <div className="mt-4">
          <div className="text-xs text-white/50 mb-2">Quick Locations</div>
          <div className="space-y-1">
            <button
              onClick={() => navigateToLocation({ lat: 40.758, lng: -73.9855 }, "Times Square, NYC")}
              className="block w-full text-left px-3 py-2 text-xs bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              Times Square, NYC
            </button>
            <button
              onClick={() => navigateToLocation({ lat: 48.8584, lng: 2.2945 }, "Eiffel Tower, Paris")}
              className="block w-full text-left px-3 py-2 text-xs bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              Eiffel Tower, Paris
            </button>
            <button
              onClick={() => navigateToLocation({ lat: 51.5074, lng: -0.1278 }, "London, UK")}
              className="block w-full text-left px-3 py-2 text-xs bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              London, UK
            </button>
            <button
              onClick={() => navigateToLocation({ lat: 51.500729, lng: -0.124625 }, "Big Ben, London")}
              className="block w-full text-left px-3 py-2 text-xs bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              Big Ben, London
            </button>
          </div>
        </div>

        <div className="mt-4 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <div className="text-xs text-blue-300">
            <strong>Tip:</strong> Move your hand left/right to look around. Swipe quickly to snap turn.
          </div>
        </div>
      </div>
      </div>
      <div ref={containerRef} className="w-full h-full absolute inset-0 z-0" />
    </div>
  );
}