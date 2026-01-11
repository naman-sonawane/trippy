"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";
import { ScheduleItem, Location } from "../types";

type GoogleMapsLoaded = {
  maps: {
    Map: new (container: HTMLElement, opts: any) => any;
    Marker: new (opts: any) => any;
    InfoWindow: new (opts: any) => any;
    LatLng: new (lat: number, lng: number) => any;
    LatLngBounds: new () => any;
  };
};

declare global {
  interface Window {
    google?: GoogleMapsLoaded;
  }
}

export default function MapPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tripId = searchParams.get("tripId");
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const infoWindowsRef = useRef<any[]>([]);

  const [itinerary, setItinerary] = useState<ScheduleItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [destination, setDestination] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isApiLoaded, setIsApiLoaded] = useState(false);
  const [lastItineraryHash, setLastItineraryHash] = useState<string>("");

  const loadItinerary = useCallback(async () => {
    if (!tripId) return;

    try {
      const response = await fetch(`/api/schedule?tripId=${tripId}`);
      if (response.ok) {
        const data = await response.json();
        const items = data.itinerary || [];
        setItinerary(items);

        const tripResponse = await fetch(`/api/trips/${tripId}`);
        if (tripResponse.ok) {
          const tripData = await tripResponse.json();
          setDestination(tripData.trip?.destination || "");
        }
      }
    } catch (error) {
      console.error('Error loading itinerary:', error);
      setError('Failed to load itinerary');
    }
  }, [tripId]);

  const fetchLocations = useCallback(async (items: ScheduleItem[], dest: string) => {
    if (items.length === 0 || !dest) {
      setLocations([]);
      if (isApiLoaded) setIsLoading(false);
      return;
    }

    setIsLoadingLocations(true);
    setError(null);

    try {
      const response = await fetch('/api/schedule/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itinerary: items, destination: dest }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch locations');
      }

      const data = await response.json();
      setLocations(data.locations || []);
    } catch (error) {
      console.error('Error fetching locations:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch locations');
      setLocations([]);
    } finally {
      setIsLoadingLocations(false);
      if (isApiLoaded) setIsLoading(false);
    }
  }, [isApiLoaded]);

  useEffect(() => {
    if (tripId) {
      loadItinerary();
    } else {
      setIsLoading(false);
      setError('Trip ID is required');
    }
  }, [tripId, loadItinerary]);

  useEffect(() => {
    const itineraryHash = JSON.stringify(itinerary.map(item => ({ id: item.id, name: item.name })));
    if (itineraryHash !== lastItineraryHash && destination) {
      setLastItineraryHash(itineraryHash);
      fetchLocations(itinerary, destination);
    }
  }, [itinerary, destination, lastItineraryHash, fetchLocations]);

  useEffect(() => {
    if (!tripId) return;

    const pollInterval = setInterval(() => {
      loadItinerary();
    }, 8000);

    return () => clearInterval(pollInterval);
  }, [tripId, loadItinerary]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkLoaded = () => {
      if (window.google?.maps) {
        return true;
      }
      return false;
    };

    if (checkLoaded()) {
      const timer = setTimeout(() => setIsApiLoaded(true), 0);
      return () => clearTimeout(timer);
    }

    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      const handleLoad = () => setIsApiLoaded(true);
      existingScript.addEventListener('load', handleLoad);
      return () => existingScript.removeEventListener('load', handleLoad);
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyDY1pbD7iMKsqfQ73Nl5KvsTK1ttEo9-L4`;
    script.async = true;
    script.defer = true;

    const handleLoad = () => {
      setIsApiLoaded(true);
    };

    const handleError = () => {
      setError('Failed to load Google Maps API');
    };

    script.addEventListener('load', handleLoad);
    script.addEventListener('error', handleError);
    document.head.appendChild(script);

    return () => {
      script.removeEventListener('load', handleLoad);
      script.removeEventListener('error', handleError);
    };
  }, []);

  useEffect(() => {
    if (!isApiLoaded || !mapRef.current) {
      return;
    }

    const google = window.google;
    if (!google?.maps) return;

    const Maps = google.maps;

    if (!mapInstanceRef.current) {
      const defaultCenter = locations.length > 0 
        ? new Maps.LatLng(locations[0].lat, locations[0].lng)
        : new Maps.LatLng(0, 0);
      
      const map = new Maps.Map(mapRef.current, {
        center: defaultCenter,
        zoom: locations.length > 0 ? 12 : 2,
      });
      mapInstanceRef.current = map;
      setIsLoading(false);
    }

    const map = mapInstanceRef.current;

    markersRef.current.forEach(marker => marker.setMap(null));
    infoWindowsRef.current.forEach(infoWindow => infoWindow.close());
    markersRef.current = [];
    infoWindowsRef.current = [];

    if (locations.length === 0) {
      return;
    }

    const bounds = new Maps.LatLngBounds();

    locations.forEach((location) => {
      const position = new Maps.LatLng(location.lat, location.lng);
      bounds.extend(position);

      const marker = new Maps.Marker({
        position,
        map,
        title: location.name,
      });

      const infoWindow = new Maps.InfoWindow({
        content: `<div style="padding: 8px;"><strong>${location.name}</strong></div>`,
      });

      marker.addListener('click', () => {
        infoWindowsRef.current.forEach(iw => iw.close());
        infoWindow.open(map, marker);
      });

      markersRef.current.push(marker);
      infoWindowsRef.current.push(infoWindow);
    });

    if (locations.length > 0) {
      map.fitBounds(bounds);
    }
  }, [isApiLoaded, locations]);

  if (!tripId) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center">
        <div className="text-gray-900 dark:text-zinc-50">Trip ID is required</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black flex flex-col">
      <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/schedule?tripId=${tripId}`)}
              className="p-2 text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-50 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
              title="Back to Itinerary"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-zinc-50">
                Map View
              </h1>
              {destination && (
                <p className="text-sm text-gray-600 dark:text-zinc-400 mt-1">
                  {destination}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isLoadingLocations && (
              <div className="text-sm text-gray-600 dark:text-zinc-400">
                Loading locations...
              </div>
            )}
            {locations.length > 0 && (
              <div className="text-sm text-gray-600 dark:text-zinc-400">
                {locations.length} location{locations.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 relative">
        {error && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg shadow-lg max-w-md">
            {error}
          </div>
        )}
        {isLoading && !isApiLoaded && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-zinc-50 dark:bg-black">
            <div className="text-gray-900 dark:text-zinc-50">Loading map...</div>
          </div>
        )}
        {locations.length === 0 && !isLoadingLocations && itinerary.length > 0 && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-4 py-2 rounded-lg shadow-lg max-w-md">
            No locations found for activities
          </div>
        )}
        <div ref={mapRef} className="w-full h-full" style={{ minHeight: 'calc(100vh - 120px)' }} />
      </div>
    </div>
  );
}

