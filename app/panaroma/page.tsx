// app/streetview/page.tsx
'use client';

import { useEffect, useRef, useState, useCallback } from "react";

type LatLng = { lat: number; lng: number };

const DEFAULT_COORDS: LatLng = { lat: 40.758, lng: -73.9855 }; // Times Square

// Proper type definitions for Google Maps
type GoogleMapsLoaded = {
  maps: {
    StreetViewService: new () => GoogleStreetViewService;
    StreetViewPanorama: new (
      container: HTMLElement,
      opts: StreetViewPanoramaOptions
    ) => GoogleStreetViewPanorama;
    StreetViewSource: {
      OUTDOOR: string;
    };
    StreetViewPreference: {
      BEST: string;
    };
    StreetViewStatus: {
      OK: string;
    };
  };
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
  location?: {
    latLng?: LatLng;
  };
};

type StreetViewPanoramaOptions = {
  position: LatLng;
  pov: {
    heading: number;
    pitch: number;
  };
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

type GoogleStreetViewPanorama = {
  addListener: (event: string, callback: () => void) => void;
  getPosition: () => { lat: () => number; lng: () => number } | null;
};

declare global {
  interface Window {
    google?: GoogleMapsLoaded;
    navigateToLocation?: (coords: LatLng) => void;
  }
}

interface GoogleStreetViewPageProps {
  coords?: LatLng;
}

export default function GoogleStreetViewPage({ coords: initialCoords }: GoogleStreetViewPageProps = {}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panoramaRef = useRef<GoogleStreetViewPanorama | null>(null);
  
  const [coords, setCoords] = useState<LatLng>(initialCoords || DEFAULT_COORDS);
  const [status, setStatus] = useState<string>("Loading…");
  const [isApiLoaded, setIsApiLoaded] = useState<boolean>(false);

  // Function to navigate to new coordinates
  const navigateToLocation = useCallback((newCoords: LatLng): void => {
    setCoords(newCoords);
  }, []);

  // Load Google Maps script
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Check if already loaded - use callback to avoid synchronous setState
    const checkLoaded = () => {
      if (window.google?.maps) {
        console.log("Google Maps already loaded");
        return true;
      }
      return false;
    };

    if (checkLoaded()) {
      // Use setTimeout to defer setState and avoid synchronous update
      const timer = setTimeout(() => setIsApiLoaded(true), 0);
      return () => clearTimeout(timer);
    }

    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      console.log("Google Maps script already in DOM, waiting for load...");
      const handleLoad = () => setIsApiLoaded(true);
      existingScript.addEventListener('load', handleLoad);
      return () => existingScript.removeEventListener('load', handleLoad);
    }

    console.log("Loading Google Maps API...");
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyDY1pbD7iMKsqfQ73Nl5KvsTK1ttEo9-L4`;
    script.async = true;
    script.defer = true;
    
    const handleLoad = () => {
      console.log("Google Maps API loaded successfully");
      setIsApiLoaded(true);
    };
    
    const handleError = (error: Event) => {
      console.error("Failed to load Google Maps API:", error);
      setStatus("Failed to load Google Maps API - check console for details");
    };
    
    script.addEventListener('load', handleLoad);
    script.addEventListener('error', handleError);
    document.head.appendChild(script);
    
    return () => {
      script.removeEventListener('load', handleLoad);
      script.removeEventListener('error', handleError);
    };
  }, []);

  // Initialize Street View
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isApiLoaded || !containerRef.current) return;
    
    const google = window.google;
    if (!google || !google.maps) return;

    const initStreetView = async () => {
      try {
        setStatus("Finding best Street View imagery…");

        const streetViewService = new google.maps.StreetViewService();
        const SEARCH_RADIUS = 100; // meters

        // Find nearby panoramas
        streetViewService.getPanorama(
          {
            location: coords,
            radius: SEARCH_RADIUS,
            source: google.maps.StreetViewSource.OUTDOOR,
            preference: google.maps.StreetViewPreference.BEST,
          },
          (data, status) => {
            if (status === google.maps.StreetViewStatus.OK && data?.location?.latLng && containerRef.current) {
              setStatus("Loading Street View…");

              // Create Street View panorama
              const panorama = new google.maps.StreetViewPanorama(
                containerRef.current,
                {
                  position: data.location.latLng,
                  pov: {
                    heading: 0,
                    pitch: 0,
                  },
                  zoom: 1,
                  addressControl: true,
                  linksControl: true,
                  panControl: true,
                  enableCloseButton: false,
                  fullscreenControl: true,
                  motionTracking: true,
                  motionTrackingControl: true,
                  showRoadLabels: true,
                }
              );

              panoramaRef.current = panorama;

              // Listen for position changes
              panorama.addListener('position_changed', () => {
                const pos = panorama.getPosition();
                if (pos) {
                  console.log('New position:', pos.lat(), pos.lng());
                }
              });

              setStatus("Drag to look around • Click arrows to move");
            } else {
              setStatus("No Street View imagery available at this location");
              console.error("Street View status:", status);
            }
          }
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        setStatus(`Error: ${msg}`);
        console.error("Error:", e);
      }
    };

    void initStreetView();

    return () => {
      if (panoramaRef.current) {
        panoramaRef.current = null;
      }
    };
  }, [coords.lat, coords.lng, isApiLoaded]);

  // Expose navigateToLocation function globally
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.navigateToLocation = navigateToLocation;
      return () => {
        delete window.navigateToLocation;
      };
    }
  }, [navigateToLocation]);

  return (
    <div className="w-full h-screen bg-black text-white">
      <div className="absolute top-6 left-6 z-10 bg-black/80 p-4 rounded-lg backdrop-blur-sm">
        <div className="text-xl font-medium">Google Street View</div>
        <div className="text-sm text-white/70 mt-1">{status}</div>
        <div className="text-xs text-white/50 mt-2">
          {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
        </div>

        {/* Example navigation buttons */}
        <div className="mt-4 space-y-2">
          <div className="text-xs text-white/40 mb-2">Quick locations:</div>
          <button
            onClick={() => navigateToLocation({ lat: 40.758, lng: -73.9855 })}
            className="block w-full text-left px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded"
          >
            Times Square, NYC
          </button>
          <button
            onClick={() => navigateToLocation({ lat: 48.8584, lng: 2.2945 })}
            className="block w-full text-left px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded"
          >
            Eiffel Tower, Paris
          </button>
          <button
            onClick={() => navigateToLocation({ lat: 51.5074, lng: -0.1278 })}
            className="block w-full text-left px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded"
          >
            London
          </button>
        </div>
      </div>

      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}

// Export the navigation function as a named export for use in other components
export function useStreetViewNavigation(): (coords: LatLng) => void {
  return (coords: LatLng) => {
    if (typeof window !== 'undefined' && window.navigateToLocation) {
      window.navigateToLocation(coords);
    }
  };
}