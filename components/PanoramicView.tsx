'use client'
import { useCallback, useEffect, useRef, useState } from "react";

type LatLng = { lat: number; lng: number };

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

type GoogleStreetViewPanorama = {
  addListener: (event: string, callback: () => void) => void;
  getPosition: () => { lat: () => number; lng: () => number } | null;
  getPov: () => { heading: number; pitch: number };
  setPov: (pov: { heading: number; pitch: number }) => void;
  setPosition: (pos: LatLng) => void;
};

declare global {
  interface Window {
    google?: GoogleMapsLoaded;
  }
}

interface PanoramicViewProps {
  locationName: string;
  isOpen: boolean;
  onClose: () => void;
}

export const PanoramicView = ({ locationName, isOpen, onClose }: PanoramicViewProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panoramaRef = useRef<GoogleStreetViewPanorama | null>(null);
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [status, setStatus] = useState<string>("Loading…");
  const [isApiLoaded, setIsApiLoaded] = useState<boolean>(false);

  const searchPlace = useCallback(async (placeName: string) => {
    if (!placeName.trim() || !window.google?.maps) {
      return;
    }

    setStatus("Searching for location…");

    const geocoder = new window.google.maps.Geocoder();

    geocoder.geocode({ address: placeName }, (results, status) => {
      if (status === window.google!.maps.GeocoderStatus.OK && results && results.length > 0) {
        const location = results[0].geometry.location;
        const coords = {
          lat: location.lat(),
          lng: location.lng(),
        };
        
        setCoords(coords);
        setStatus("Finding Street View…");
      } else {
        setStatus("Location not found");
      }
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    if (typeof window === "undefined") return;

    if (window.google?.maps) {
      setIsApiLoaded(true);
      searchPlace(locationName);
      return;
    }

    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      const handleLoad = () => {
        setIsApiLoaded(true);
        searchPlace(locationName);
      };
      existingScript.addEventListener("load", handleLoad);
      return () => existingScript.removeEventListener("load", handleLoad);
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyDY1pbD7iMKsqfQ73Nl5KvsTK1ttEo9-L4`;
    script.async = true;
    script.defer = true;

    const handleLoad = () => {
      setIsApiLoaded(true);
      searchPlace(locationName);
    };
    const handleError = () => setStatus("Failed to load Google Maps API");

    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);
    document.head.appendChild(script);

    return () => {
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
    };
  }, [isOpen, locationName, searchPlace]);

  useEffect(() => {
    if (!isOpen || !isApiLoaded || !containerRef.current || !window.google?.maps || !coords) return;

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
            motionTracking: false,
            motionTrackingControl: false,
            showRoadLabels: true,
          });

          panoramaRef.current = panorama;
          setStatus("Street View loaded");
        } else {
          setStatus("No Street View available here");
        }
      }
    );

    return () => {
      panoramaRef.current = null;
    };
  }, [coords, isApiLoaded, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={onClose}
          className="w-12 h-12 rounded-full bg-black/80 hover:bg-black/90 text-white text-2xl flex items-center justify-center shadow-lg transition-all hover:scale-110"
          aria-label="Close panoramic view"
        >
          ✕
        </button>
      </div>
      
      {status !== "Street View loaded" && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="bg-black/80 text-white px-6 py-4 rounded-lg">
            {status}
          </div>
        </div>
      )}

      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};
