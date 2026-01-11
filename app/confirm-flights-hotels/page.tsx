'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, Plane, Hotel, Calendar, MapPin, Loader2, AlertCircle, Users, Star, ArrowLeft } from 'lucide-react';

interface TripData {
    departId: string;
    arrivalId: string;
    departDate: string;
    returnDate: string;
    geoId: string;
    cabinClass: string;
    rooms: number;
    adults: number;
    currency: string;
    sort: string;
}

interface FlightPrice {
    departureDate: string;
    isCheapest: boolean;
    price: {
        currencyCode: string;
        units: number;
        nanos: number;
    };
    priceRounded: {
        currencyCode: string;
        units: number;
        nanos: number;
    };
}

interface FlightData {
    data: FlightPrice[];
    status: boolean;
    message: string;
}

interface Results {
    outboundFlights: FlightData;
    returnFlights: FlightData;
    hotels: any;
    numberOfNights: number;
}

const airportToGeoId: Record<string, string> = {
    LAX: '32655',
    JFK: '60763',
    ORD: '35805',
    MIA: '34438',
    LAS: '45963',
    SFO: '60713',
    SEA: '60878',
    DEN: '33556',
    ATL: '60898',
    BOS: '60745',
};

const currencyRates: Record<string, number> = {
    USD: 1,
    CAD: 1.4,
    EUR: 0.92,
    GBP: 0.79,
    AUD: 1.52
};

const currencySymbols: Record<string, string> = {
    USD: '$',
    CAD: 'C$',
    EUR: '€',
    GBP: '£',
    AUD: 'A$'
};

export default function ConfirmFlightsHotelsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const tripId = searchParams.get('tripId');

    const [tripData, setTripData] = useState<TripData>({
        departId: 'JFK',
        arrivalId: 'LAX',
        departDate: '',
        returnDate: '',
        geoId: '32655',
        cabinClass: 'ECONOMY',
        rooms: 1,
        adults: 1,
        currency: 'USD',
        sort: 'BEST_VALUE'
    });
    const [results, setResults] = useState<Results | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [tripDestination, setTripDestination] = useState<string>('');
    const [isLoadingTrip, setIsLoadingTrip] = useState<boolean>(true);
    const [isDetectingAirports, setIsDetectingAirports] = useState<boolean>(false);
    const [userCity, setUserCity] = useState<string>('');

    const findAirport = async (city: string): Promise<{ airportCode: string; airportName: string } | null> => {
        try {
            const response = await fetch('/api/find-airport', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ city })
            });

            if (!response.ok) {
                throw new Error('Failed to find airport');
            }

            const data = await response.json();
            return data.airportCode ? { airportCode: data.airportCode, airportName: data.airportName } : null;
        } catch (err) {
            console.error('Error finding airport:', err);
            return null;
        }
    };

    const detectUserLocation = async (): Promise<string | null> => {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve(null);
                return;
            }

            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    try {
                        const response = await fetch(
                            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${position.coords.latitude}&longitude=${position.coords.longitude}&localityLanguage=en`
                        );
                        const data = await response.json();
                        const city = data.city || data.locality || null;
                        resolve(city);
                    } catch (err) {
                        console.error('Error reverse geocoding:', err);
                        resolve(null);
                    }
                },
                () => resolve(null),
                { timeout: 5000 }
            );
        });
    };

    const autoDetectAirports = useCallback(async () => {
        setIsDetectingAirports(true);
        setError(null);

        try {
            let fromCity = userCity;

            if (!fromCity || fromCity === '') {
                const detectedCity = await detectUserLocation();
                if (detectedCity) {
                    fromCity = detectedCity;
                    setUserCity(detectedCity);
                } else {
                    const cityInput = prompt('Please enter your departure city:');
                    if (!cityInput) {
                        setIsDetectingAirports(false);
                        return;
                    }
                    fromCity = cityInput;
                    setUserCity(cityInput);
                }
            }

            const [fromAirport, toAirport] = await Promise.all([
                findAirport(fromCity),
                tripDestination ? findAirport(tripDestination) : null
            ]);

            if (fromAirport) {
                setTripData(prev => ({
                    ...prev,
                    departId: fromAirport.airportCode,
                }));
            }

            if (toAirport) {
                setTripData(prev => ({
                    ...prev,
                    arrivalId: toAirport.airportCode,
                    geoId: airportToGeoId[toAirport.airportCode] || prev.geoId,
                }));
            }

            if (!fromAirport && !toAirport) {
                setError('Could not automatically detect airports. Please enter them manually.');
            }
        } catch (err) {
            console.error('Error detecting airports:', err);
            setError('Failed to detect airports. Please enter them manually.');
        } finally {
            setIsDetectingAirports(false);
        }
    }, [tripDestination, userCity]);

    useEffect(() => {
        if (tripId) {
            fetch(`/api/trips/${tripId}`)
                .then(res => res.json())
                .then(data => {
                    if (data.trip) {
                        setTripDestination(data.trip.destination);
                        const startDate = new Date(data.trip.startDate).toISOString().split('T')[0];
                        const endDate = new Date(data.trip.endDate).toISOString().split('T')[0];
                        setTripData(prev => ({
                            ...prev,
                            departDate: startDate,
                            returnDate: endDate,
                        }));
                        
                        autoDetectAirports();
                    }
                })
                .catch(err => {
                    console.error('Error fetching trip:', err);
                    setError('Failed to load trip data');
                })
                .finally(() => {
                    setIsLoadingTrip(false);
                });
        } else {
            setIsLoadingTrip(false);
        }
    }, [tripId, autoDetectAirports]);

    const searchTrip = async (): Promise<void> => {
        if (!tripData.departDate || !tripData.returnDate) {
            setError('Please enter both departure and return dates');
            return;
        }

        setLoading(true);
        setError(null);
        setResults(null);

        try {
            const checkIn = new Date(tripData.departDate);
            const checkOut = new Date(tripData.returnDate);
            const numberOfNights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

            const response = await fetch('/api/search-trip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(tripData)
            });

            if (!response.ok) throw new Error('API request failed');

            const data = await response.json();

            setResults({
                outboundFlights: data.outboundFlights,
                returnFlights: data.returnFlights,
                hotels: data.hotels,
                numberOfNights
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch trip data');
        } finally {
            setLoading(false);
        }
    };

    const handleArrivalChange = (code: string): void => {
        const upperCode = code.toUpperCase();
        setTripData({
            ...tripData,
            arrivalId: upperCode,
            geoId: airportToGeoId[upperCode] || tripData.geoId
        });
    };

    const extractHotels = (hotelsRaw: any): any[] => {
        if (!hotelsRaw) return [];
        if (Array.isArray(hotelsRaw)) return hotelsRaw;
        if (hotelsRaw.hotels && Array.isArray(hotelsRaw.hotels)) return hotelsRaw.hotels;
        if (hotelsRaw.data && Array.isArray(hotelsRaw.data)) return hotelsRaw.data;
        if (hotelsRaw.results && Array.isArray(hotelsRaw.results)) return hotelsRaw.results;
        if (hotelsRaw.data && hotelsRaw.data.hotels && Array.isArray(hotelsRaw.data.hotels)) {
            return hotelsRaw.data.hotels;
        }
        return [];
    };

    const stripHtml = (html?: string) => {
        if (!html) return '';
        return html.replace(/<[^>]+>/g, '').trim();
    };

    const renderHotelCard = (h: any, index: number, numberOfNights: number, currency: string) => {
        const title = h.cardTitle?.string || h.name || h.title || 'Untitled Hotel';
        const rating = h.bubbleRating?.rating ?? h.rating ?? null;
        const reviews = h.bubbleRating?.numberReviews?.string ?? h.reviews ?? '';
        const pricePerNight = h.commerceInfo?.priceForDisplay?.string ?? stripHtml(h.commerceInfo?.priceWithPrefix?.htmlString) ?? '';

        const priceMatch = pricePerNight.match(/\$?(\d+(?:,\d{3})*)/);
        const priceValueUSD = priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : 0;
        const exchangeRate = currencyRates[currency] || 1;
        const priceValue = Math.round(priceValueUSD * exchangeRate);
        const totalPrice = priceValue * numberOfNights;

        const imgTemplate = h.cardPhotos?.[0]?.sizes?.urlTemplate || h.photo?.url || '';
        const image = imgTemplate ? imgTemplate.replace('{width}', '400').replace('{height}', '300') : '';

        return (
            <div key={index} className="p-4 rounded-lg border border-white/20 hover:shadow-lg transition-shadow bg-white/10 backdrop-blur-sm flex gap-4">
                <div className="w-32 h-24 shrink-0 rounded overflow-hidden bg-black/20 flex items-center justify-center">
                    {image ? (
                        <img src={image} alt={title} className="object-cover w-full h-full" />
                    ) : (
                        <div className="text-xs text-white/50">No image</div>
                    )}
                </div>
                <div className="flex-1">
                    <div className="flex justify-between items-start gap-4">
                        <div>
                            <h3 className="font-semibold text-white">{title}</h3>
                            <p className="text-sm text-white/70 mt-1">{h.descriptiveText ?? h.secondaryInfo ?? ''}</p>
                        </div>
                        <div className="text-right">
                            {pricePerNight ? (
                                <div>
                                    <div className="font-bold text-lg text-white">{currencySymbols[currency]}{priceValue.toLocaleString()}</div>
                                    <div className="text-xs text-white/60">per night</div>
                                    {currency !== 'USD' && priceValueUSD > 0 && (
                                        <div className="text-xs text-white/50">${priceValueUSD} USD</div>
                                    )}
                                    {numberOfNights > 0 && totalPrice > 0 && (
                                        <div className="text-sm font-semibold text-blue-400 mt-1">
                                            {currencySymbols[currency]}{totalPrice.toLocaleString()} total ({numberOfNights} {numberOfNights === 1 ? 'night' : 'nights'})
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-sm text-white/60">No price</div>
                            )}
                        </div>
                    </div>

                    <div className="mt-3 flex items-center gap-4 text-sm text-white/80">
                        {rating ? (
                            <div className="flex items-center gap-2">
                                <Star size={14} className="fill-yellow-400 text-yellow-400" />
                                <span className="font-medium">{rating}</span>
                                <span className="text-xs text-white/60">{reviews}</span>
                            </div>
                        ) : (
                            <div className="text-xs text-white/60">No rating</div>
                        )}

                        {h.rewardsBadge?.text?.string && (
                            <div className="text-xs text-green-300 bg-green-500/20 px-2 py-1 rounded border border-green-500/30">{h.rewardsBadge.text.string}</div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    if (isLoadingTrip) {
    return (
        <div className="min-h-screen relative flex items-center justify-center"
             style={{
               backgroundImage: "url(/anotherbg.jpg)",
               backgroundSize: "cover",
               backgroundPosition: "center",
               backgroundRepeat: "no-repeat",
               backgroundAttachment: "fixed"
             }}>
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/70" />
            <div className="relative z-10">
                <Loader2 className="animate-spin text-white" size={48} />
            </div>
        </div>
    );
    }

    return (
        <div className="min-h-screen relative p-6"
             style={{
               backgroundImage: "url(/anotherbg.jpg)",
               backgroundSize: "cover",
               backgroundPosition: "center",
               backgroundRepeat: "no-repeat",
               backgroundAttachment: "fixed"
             }}>
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/70" />
            <div className="relative z-10 max-w-5xl mx-auto">
                <div className="mb-6">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-white/80 hover:text-white transition-colors mb-4"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span>Back to Schedule</span>
                    </button>
                    <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
                        <Search className="text-blue-400" />
                        Confirm Flights & Hotels
                    </h1>
                    {tripDestination && (
                        <p className="text-white/80">
                            For your trip to <span className="font-semibold">{tripDestination}</span>
                        </p>
                    )}
                </div>

                <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl p-8 mb-6 border border-white/20">
                    <div className="space-y-6">
                        <div className="bg-white/10 backdrop-blur-sm p-6 rounded-xl border border-white/20">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-semibold text-white flex items-center gap-2">
                                    <Plane size={20} className="text-blue-400" />
                                    Flight Details
                                </h3>
                                <button
                                    onClick={autoDetectAirports}
                                    disabled={isDetectingAirports}
                                    className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                                >
                                    {isDetectingAirports ? (
                                        <>
                                            <Loader2 className="animate-spin" size={14} />
                                            Detecting...
                                        </>
                                    ) : (
                                        <>
                                            <MapPin size={14} />
                                            Auto-detect Airports
                                        </>
                                    )}
                                </button>
                            </div>
                            {userCity && (
                                <p className="text-xs text-white/70 mb-3">
                                    Detected departure city: <span className="font-medium">{userCity}</span>
                                </p>
                            )}
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium text-white mb-2">
                                        <MapPin className="inline mr-1" size={16} />
                                        From (Airport Code)
                                    </label>
                                    <input
                                        type="text"
                                        value={tripData.departId}
                                        onChange={(e) => setTripData({ ...tripData, departId: e.target.value.toUpperCase() })}
                                        placeholder="e.g., JFK"
                                        maxLength={3}
                                        className="w-full px-4 py-3 bg-black/40 border border-white/20 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 text-white placeholder-white/40 uppercase"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-white mb-2">
                                        <MapPin className="inline mr-1" size={16} />
                                        To (Airport Code)
                                    </label>
                                    <input
                                        type="text"
                                        value={tripData.arrivalId}
                                        onChange={(e) => handleArrivalChange(e.target.value)}
                                        placeholder="e.g., LAX"
                                        maxLength={3}
                                        className="w-full px-4 py-3 bg-black/40 border border-white/20 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 text-white placeholder-white/40 uppercase"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-white mb-2">
                                    Cabin Class
                                </label>
                                <select
                                    value={tripData.cabinClass}
                                    onChange={(e) => setTripData({ ...tripData, cabinClass: e.target.value })}
                                    className="w-full px-4 py-3 bg-black/40 border border-white/20 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 text-white"
                                >
                                    <option value="ECONOMY">Economy</option>
                                    <option value="PREMIUM_ECONOMY">Premium Economy</option>
                                    <option value="BUSINESS">Business</option>
                                    <option value="FIRST">First</option>
                                </select>
                            </div>
                        </div>

                        <div className="bg-white/10 backdrop-blur-sm p-6 rounded-xl border border-white/20">
                            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                                <Calendar size={20} className="text-purple-400" />
                                Travel Dates
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-white mb-2">
                                        Departure Date
                                    </label>
                                    <input
                                        type="date"
                                        value={tripData.departDate}
                                        onChange={(e) => setTripData({ ...tripData, departDate: e.target.value })}
                                        min={new Date().toISOString().split('T')[0]}
                                        className="w-full px-4 py-3 bg-black/40 border border-white/20 rounded-lg focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-white mb-2">
                                        Return Date
                                    </label>
                                    <input
                                        type="date"
                                        value={tripData.returnDate}
                                        onChange={(e) => setTripData({ ...tripData, returnDate: e.target.value })}
                                        min={tripData.departDate || new Date().toISOString().split('T')[0]}
                                        className="w-full px-4 py-3 bg-black/40 border border-white/20 rounded-lg focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 text-white"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/10 backdrop-blur-sm p-6 rounded-xl border border-white/20">
                            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                                <Hotel size={20} className="text-green-400" />
                                Hotel Preferences
                            </h3>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium text-white mb-2">
                                        Destination Geo ID
                                    </label>
                                    <input
                                        type="text"
                                        value={tripData.geoId}
                                        onChange={(e) => setTripData({ ...tripData, geoId: e.target.value })}
                                        placeholder="e.g., 32655 for Los Angeles"
                                        className="w-full px-4 py-3 bg-black/40 border border-white/20 rounded-lg focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 text-white placeholder-white/40"
                                    />
                                    <p className="text-xs text-white/60 mt-1">
                                        Auto-updates for common airports
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-white mb-2">
                                        Sort By
                                    </label>
                                    <select
                                        value={tripData.sort}
                                        onChange={(e) => setTripData({ ...tripData, sort: e.target.value })}
                                        className="w-full px-4 py-3 bg-black/40 border border-white/20 rounded-lg focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 text-white"
                                    >
                                        <option value="BEST_VALUE">Best Value</option>
                                        <option value="POPULARITY">Traveler Ranking</option>
                                        <option value="PRICE_LOW_TO_HIGH">Price (Low to High)</option>
                                        <option value="DISTANCE_FROM_CITY_CENTER">Distance to City Center</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-white mb-2">
                                        <Users className="inline mr-1" size={16} />
                                        Rooms
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="10"
                                        value={tripData.rooms}
                                        onChange={(e) => setTripData({ ...tripData, rooms: parseInt(e.target.value) || 1 })}
                                        className="w-full px-4 py-3 bg-black/40 border border-white/20 rounded-lg focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-white mb-2">
                                        <Users className="inline mr-1" size={16} />
                                        Adults
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="20"
                                        value={tripData.adults}
                                        onChange={(e) => setTripData({ ...tripData, adults: parseInt(e.target.value) || 1 })}
                                        className="w-full px-4 py-3 bg-black/40 border border-white/20 rounded-lg focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-white mb-2">
                                        Currency
                                    </label>
                                    <select
                                        value={tripData.currency}
                                        onChange={(e) => setTripData({ ...tripData, currency: e.target.value })}
                                        className="w-full px-4 py-3 bg-black/40 border border-white/20 rounded-lg focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 text-white"
                                    >
                                        <option value="USD">USD</option>
                                        <option value="EUR">EUR</option>
                                        <option value="GBP">GBP</option>
                                        <option value="CAD">CAD</option>
                                        <option value="AUD">AUD</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={searchTrip}
                        disabled={loading}
                        className="w-full mt-8 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="animate-spin" size={24} />
                                Searching your complete trip...
                            </>
                        ) : (
                            <>
                                <Search size={24} />
                                Search Flights & Hotels
                            </>
                        )}
                    </button>
                </div>

                {error && (
                    <div className="bg-red-500/20 backdrop-blur-sm border-l-4 border-red-500 text-red-200 px-6 py-4 rounded-lg mb-6 flex items-start gap-3 border border-red-500/30">
                        <AlertCircle className="shrink-0 mt-0.5" size={20} />
                        <div>
                            <strong className="font-semibold">Error:</strong> {error}
                        </div>
                    </div>
                )}

                {results && (
                    <div className="space-y-6">
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-xl p-8 border border-white/20">
                            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                                <Plane className="text-blue-400" />
                                Outbound Flight Prices ({tripData.departId} → {tripData.arrivalId})
                            </h2>
                            <div className="space-y-3">
                                {results.outboundFlights?.data?.map((flight, index) => {
                                    const isSelectedDate = flight.departureDate === tripData.departDate;
                                    const exchangeRate = currencyRates[tripData.currency] || 1;
                                    const convertedPrice = Math.round(flight.priceRounded.units * exchangeRate);
                                    return (
                                        <div
                                            key={index}
                                            className={`p-4 rounded-lg border-2 ${
                                                isSelectedDate
                                                    ? 'bg-indigo-500/30 border-indigo-400 ring-2 ring-indigo-400/50'
                                                    : flight.isCheapest
                                                        ? 'bg-green-500/20 border-green-400'
                                                        : 'bg-blue-500/20 border-blue-400/50'
                                            } backdrop-blur-sm`}
                                        >
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <p className="font-semibold text-white">
                                                        {new Date(flight.departureDate).toLocaleDateString('en-US', {
                                                            weekday: 'short',
                                                            month: 'short',
                                                            day: 'numeric',
                                                            year: 'numeric'
                                                        })}
                                                    </p>
                                                    <div className="flex gap-2 mt-1">
                                                        {isSelectedDate && (
                                                            <span className="text-xs font-medium text-indigo-200 bg-indigo-500/30 px-2 py-1 rounded border border-indigo-400/50">
                                                                Your Selected Date
                                                            </span>
                                                        )}
                                                        {flight.isCheapest && (
                                                            <span className="text-xs font-medium text-green-200 bg-green-500/30 px-2 py-1 rounded border border-green-400/50">
                                                                Best Price
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-2xl font-bold text-white">
                                                        {currencySymbols[tripData.currency]}{convertedPrice.toLocaleString()}
                                                    </p>
                                                    {tripData.currency !== 'USD' && (
                                                        <p className="text-xs text-white/60">
                                                            ${flight.priceRounded.units} USD
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-xl p-8 border border-white/20">
                            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                                <Plane className="text-purple-400 transform rotate-180" />
                                Return Flight Prices ({tripData.arrivalId} → {tripData.departId})
                            </h2>
                            <div className="space-y-3">
                                {results.returnFlights?.data?.map((flight, index) => {
                                    const isSelectedDate = flight.departureDate === tripData.returnDate;
                                    const exchangeRate = currencyRates[tripData.currency] || 1;
                                    const convertedPrice = Math.round(flight.priceRounded.units * exchangeRate);
                                    return (
                                        <div
                                            key={index}
                                            className={`p-4 rounded-lg border-2 ${
                                                isSelectedDate
                                                    ? 'bg-indigo-500/30 border-indigo-400 ring-2 ring-indigo-400/50'
                                                    : flight.isCheapest
                                                        ? 'bg-green-500/20 border-green-400'
                                                        : 'bg-purple-500/20 border-purple-400/50'
                                            } backdrop-blur-sm`}
                                        >
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <p className="font-semibold text-white">
                                                        {new Date(flight.departureDate).toLocaleDateString('en-US', {
                                                            weekday: 'short',
                                                            month: 'short',
                                                            day: 'numeric',
                                                            year: 'numeric'
                                                        })}
                                                    </p>
                                                    <div className="flex gap-2 mt-1">
                                                        {isSelectedDate && (
                                                            <span className="text-xs font-medium text-indigo-200 bg-indigo-500/30 px-2 py-1 rounded border border-indigo-400/50">
                                                                Your Selected Date
                                                            </span>
                                                        )}
                                                        {flight.isCheapest && (
                                                            <span className="text-xs font-medium text-green-200 bg-green-500/30 px-2 py-1 rounded border border-green-400/50">
                                                                Best Price
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-2xl font-bold text-white">
                                                        {currencySymbols[tripData.currency]}{convertedPrice.toLocaleString()}
                                                    </p>
                                                    {tripData.currency !== 'USD' && (
                                                        <p className="text-xs text-white/60">
                                                            ${flight.priceRounded.units} USD
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {results.outboundFlights?.data && results.returnFlights?.data && (
                            <div className="bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl shadow-xl p-8 text-white">
                                <h2 className="text-2xl font-bold mb-4">Best Round Trip Option</h2>
                                {(() => {
                                    const bestOutbound = results.outboundFlights.data.find(f => f.isCheapest) || results.outboundFlights.data[0];
                                    const bestReturn = results.returnFlights.data.find(f => f.isCheapest) || results.returnFlights.data[0];
                                    const exchangeRate = currencyRates[tripData.currency] || 1;
                                    const totalFlightCostUSD = (bestOutbound?.priceRounded.units || 0) + (bestReturn?.priceRounded.units || 0);
                                    const totalFlightCost = Math.round(totalFlightCostUSD * exchangeRate);

                                    return (
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span>Outbound ({tripData.departId} → {tripData.arrivalId}):</span>
                                                <span className="font-bold">{currencySymbols[tripData.currency]}{Math.round((bestOutbound?.priceRounded.units || 0) * exchangeRate).toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span>Return ({tripData.arrivalId} → {tripData.departId}):</span>
                                                <span className="font-bold">{currencySymbols[tripData.currency]}{Math.round((bestReturn?.priceRounded.units || 0) * exchangeRate).toLocaleString()}</span>
                                            </div>
                                            <div className="border-t border-white/30 pt-2 mt-2">
                                                <div className="flex justify-between items-center text-xl font-bold">
                                                    <span>Total Flight Cost:</span>
                                                    <span>{currencySymbols[tripData.currency]}{totalFlightCost.toLocaleString()}</span>
                                                </div>
                                                {tripData.currency !== 'USD' && (
                                                    <p className="text-sm text-white/80 mt-1 text-right">
                                                        (${totalFlightCostUSD.toLocaleString()} USD)
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-xl p-8 border border-white/20">
                            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                                <Hotel className="text-green-400" />
                                Top Hotels (First 5 Results) - {results.numberOfNights} {results.numberOfNights === 1 ? 'Night' : 'Nights'}
                            </h2>

                            <div className="space-y-3">
                                {(() => {
                                    const hotels = extractHotels(results.hotels).slice(0, 5);
                                    if (!hotels.length) {
                                        return (
                                            <div className="text-sm text-white/70 p-4 bg-black/20 rounded-lg border border-white/10">
                                                No hotels found for those dates / geo ID.
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="grid gap-3">
                                            {hotels.map((h: any, i: number) => renderHotelCard(h, i, results.numberOfNights, tripData.currency))}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
