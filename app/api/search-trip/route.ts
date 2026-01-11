import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const { departId, arrivalId, departDate, returnDate, geoId, cabinClass, currency, rooms, adults, sort } = await request.json();

        const apiKey = process.env.HOTELSANDFLIGHTS_API_KEY;

        const [outboundFlightsResponse, returnFlightsResponse, hotelsResponse] = await Promise.all([
            fetch(`https://booking-com18.p.rapidapi.com/flights/v2/min-price-oneway?departId=${departId}&arrivalId=${arrivalId}&departDate=${departDate}&cabinClass=${cabinClass}&languageCode=en-us`, {
                headers: {
                    'x-rapidapi-key': apiKey!,
                    'x-rapidapi-host': 'booking-com18.p.rapidapi.com'
                }
            }),
            fetch(`https://booking-com18.p.rapidapi.com/flights/v2/min-price-oneway?departId=${arrivalId}&arrivalId=${departId}&departDate=${returnDate}&cabinClass=${cabinClass}&languageCode=en-us`, {
                headers: {
                    'x-rapidapi-key': apiKey!,
                    'x-rapidapi-host': 'booking-com18.p.rapidapi.com'
                }
            }),
            fetch(`https://tripadvisor-com1.p.rapidapi.com/hotels/search?geoId=${geoId}&checkIn=${departDate}&checkOut=${returnDate}&language=en_US&currency=${currency}&rooms=${rooms}&adults=${adults}&sort=${sort}&currencyCode=${currency}`, {
                headers: {
                    'x-rapidapi-key': apiKey!,
                    'x-rapidapi-host': 'tripadvisor-com1.p.rapidapi.com'
                }
            })
        ]);

        const [outboundFlights, returnFlights, hotels] = await Promise.all([
            outboundFlightsResponse.json(),
            returnFlightsResponse.json(),
            hotelsResponse.json()
        ]);

        return NextResponse.json({ outboundFlights, returnFlights, hotels });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch trip data' }, { status: 500 });
    }
}