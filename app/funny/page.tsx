'use client';

import React, { useState } from 'react';
import { Search, Plane, Hotel, Calendar, MapPin, Loader2, AlertCircle, Users, Star } from 'lucide-react';

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

export default function TripPriceFinder() {
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
            <div key={index} className="p-4 rounded-lg border hover:shadow-lg transition-shadow bg-white flex gap-4">
                <div className="w-32 h-24 flex-shrink-0 rounded overflow-hidden bg-gray-200 flex items-center justify-center">
                    {image ? (
                        <img src={image} alt={title} className="object-cover w-full h-full" />
                    ) : (
                        <div className="text-xs text-gray-500">No image</div>
                    )}
                </div>
                <div className="flex-1">
                    <div className="flex justify-between items-start gap-4">
                        <div>
                            <h3 className="font-semibold text-gray-800">{title}</h3>
                            <p className="text-sm text-gray-500 mt-1">{h.descriptiveText ?? h.secondaryInfo ?? ''}</p>
                        </div>
                        <div className="text-right">
                            {pricePerNight ? (
                                <div>
                                    <div className="font-bold text-lg">{currencySymbols[currency]}{priceValue.toLocaleString()}</div>
                                    <div className="text-xs text-gray-500">per night</div>
                                    {currency !== 'USD' && priceValueUSD > 0 && (
                                        <div className="text-xs text-gray-400">${priceValueUSD} USD</div>
                                    )}
                                    {numberOfNights > 0 && totalPrice > 0 && (
                                        <div className="text-sm font-semibold text-blue-600 mt-1">
                                            {currencySymbols[currency]}{totalPrice.toLocaleString()} total ({numberOfNights} {numberOfNights === 1 ? 'night' : 'nights'})
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-sm text-gray-500">No price</div>
                            )}
                        </div>
                    </div>

                    <div className="mt-3 flex items-center gap-4 text-sm text-gray-600">
                        {rating ? (
                            <div className="flex items-center gap-2">
                                <Star size={14} className="fill-yellow-400 text-yellow-400" />
                                <span className="font-medium">{rating}</span>
                                <span className="text-xs text-gray-500">{reviews}</span>
                            </div>
                        ) : (
                            <div className="text-xs text-gray-500">No rating</div>
                        )}

                        {h.rewardsBadge?.text?.string && (
                            <div className="text-xs text-green-700 bg-green-100 px-2 py-1 rounded">{h.rewardsBadge.text.string}</div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
            <div className="max-w-5xl mx-auto">
                <div className="bg-white rounded-2xl shadow-2xl p-8 mb-6">
                    <h1 className="text-4xl font-bold text-gray-800 mb-2 flex items-center gap-3">
                        <Search className="text-blue-600" />
                        Complete Trip Planner
                    </h1>
                    <p className="text-gray-600 mb-8">Search flights and hotels together for your trip dates</p>

                    <div className="space-y-6">
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl">
                            <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                                <Plane size={20} className="text-blue-600" />
                                Flight Details
                            </h3>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <MapPin className="inline mr-1" size={16} />
                                        From (Airport Code)
                                    </label>
                                    <input
                                        type="text"
                                        value={tripData.departId}
                                        onChange={(e) => setTripData({ ...tripData, departId: e.target.value.toUpperCase() })}
                                        placeholder="e.g., JFK"
                                        maxLength={3}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <MapPin className="inline mr-1" size={16} />
                                        To (Airport Code)
                                    </label>
                                    <input
                                        type="text"
                                        value={tripData.arrivalId}
                                        onChange={(e) => handleArrivalChange(e.target.value)}
                                        placeholder="e.g., LAX"
                                        maxLength={3}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Cabin Class
                                </label>
                                <select
                                    value={tripData.cabinClass}
                                    onChange={(e) => setTripData({ ...tripData, cabinClass: e.target.value })}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="ECONOMY">Economy</option>
                                    <option value="PREMIUM_ECONOMY">Premium Economy</option>
                                    <option value="BUSINESS">Business</option>
                                    <option value="FIRST">First</option>
                                </select>
                            </div>
                        </div>

                        <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-xl">
                            <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                                <Calendar size={20} className="text-purple-600" />
                                Travel Dates
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Departure Date
                                    </label>
                                    <input
                                        type="date"
                                        value={tripData.departDate}
                                        onChange={(e) => setTripData({ ...tripData, departDate: e.target.value })}
                                        min={new Date().toISOString().split('T')[0]}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Return Date
                                    </label>
                                    <input
                                        type="date"
                                        value={tripData.returnDate}
                                        onChange={(e) => setTripData({ ...tripData, returnDate: e.target.value })}
                                        min={tripData.departDate || new Date().toISOString().split('T')[0]}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-r from-green-50 to-teal-50 p-6 rounded-xl">
                            <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                                <Hotel size={20} className="text-green-600" />
                                Hotel Preferences
                            </h3>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Destination Geo ID
                                    </label>
                                    <input
                                        type="text"
                                        value={tripData.geoId}
                                        onChange={(e) => setTripData({ ...tripData, geoId: e.target.value })}
                                        placeholder="e.g., 32655 for Los Angeles"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Auto-updates for common airports
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Sort By
                                    </label>
                                    <select
                                        value={tripData.sort}
                                        onChange={(e) => setTripData({ ...tripData, sort: e.target.value })}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <Users className="inline mr-1" size={16} />
                                        Rooms
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="10"
                                        value={tripData.rooms}
                                        onChange={(e) => setTripData({ ...tripData, rooms: parseInt(e.target.value) || 1 })}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <Users className="inline mr-1" size={16} />
                                        Adults
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="20"
                                        value={tripData.adults}
                                        onChange={(e) => setTripData({ ...tripData, adults: parseInt(e.target.value) || 1 })}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Currency
                                    </label>
                                    <select
                                        value={tripData.currency}
                                        onChange={(e) => setTripData({ ...tripData, currency: e.target.value })}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                    <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-6 py-4 rounded-lg mb-6 flex items-start gap-3">
                        <AlertCircle className="flex-shrink-0 mt-0.5" size={20} />
                        <div>
                            <strong className="font-semibold">Error:</strong> {error}
                        </div>
                    </div>
                )}

                {results && (
                    <div className="space-y-6">
                        <div className="bg-white rounded-2xl shadow-xl p-8">
                            <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-3">
                                <Plane className="text-blue-600" />
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
                                                    ? 'bg-indigo-100 border-indigo-600 ring-2 ring-indigo-400'
                                                    : flight.isCheapest
                                                        ? 'bg-green-50 border-green-500'
                                                        : 'bg-blue-50 border-blue-200'
                                            }`}
                                        >
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <p className="font-semibold text-gray-800">
                                                        {new Date(flight.departureDate).toLocaleDateString('en-US', {
                                                            weekday: 'short',
                                                            month: 'short',
                                                            day: 'numeric',
                                                            year: 'numeric'
                                                        })}
                                                    </p>
                                                    <div className="flex gap-2 mt-1">
                                                        {isSelectedDate && (
                                                            <span className="text-xs font-medium text-indigo-700 bg-indigo-200 px-2 py-1 rounded">
                                                                Your Selected Date
                                                            </span>
                                                        )}
                                                        {flight.isCheapest && (
                                                            <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded">
                                                                Best Price
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-2xl font-bold text-gray-800">
                                                        {currencySymbols[tripData.currency]}{convertedPrice.toLocaleString()}
                                                    </p>
                                                    {tripData.currency !== 'USD' && (
                                                        <p className="text-xs text-gray-500">
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

                        <div className="bg-white rounded-2xl shadow-xl p-8">
                            <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-3">
                                <Plane className="text-purple-600 transform rotate-180" />
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
                                                    ? 'bg-indigo-100 border-indigo-600 ring-2 ring-indigo-400'
                                                    : flight.isCheapest
                                                        ? 'bg-green-50 border-green-500'
                                                        : 'bg-purple-50 border-purple-200'
                                            }`}
                                        >
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <p className="font-semibold text-gray-800">
                                                        {new Date(flight.departureDate).toLocaleDateString('en-US', {
                                                            weekday: 'short',
                                                            month: 'short',
                                                            day: 'numeric',
                                                            year: 'numeric'
                                                        })}
                                                    </p>
                                                    <div className="flex gap-2 mt-1">
                                                        {isSelectedDate && (
                                                            <span className="text-xs font-medium text-indigo-700 bg-indigo-200 px-2 py-1 rounded">
                                                                Your Selected Date
                                                            </span>
                                                        )}
                                                        {flight.isCheapest && (
                                                            <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded">
                                                                Best Price
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-2xl font-bold text-gray-800">
                                                        {currencySymbols[tripData.currency]}{convertedPrice.toLocaleString()}
                                                    </p>
                                                    {tripData.currency !== 'USD' && (
                                                        <p className="text-xs text-gray-500">
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

                        <div className="bg-white rounded-2xl shadow-xl p-8">
                            <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-3">
                                <Hotel className="text-green-600" />
                                Top Hotels (First 5 Results) - {results.numberOfNights} {results.numberOfNights === 1 ? 'Night' : 'Nights'}
                            </h2>

                            <div className="space-y-3">
                                {(() => {
                                    const hotels = extractHotels(results.hotels).slice(0, 5);
                                    if (!hotels.length) {
                                        return (
                                            <div className="text-sm text-gray-600 p-4 bg-gray-50 rounded-lg">
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