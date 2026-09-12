export interface WeatherData {
    temperature: number;
    humidity: number;
    precipitation: number;
    rain: number;
    weatherCode: number;
    visibility: number;
    windSpeed: number;
    time: string;
    timezone: string;
}

type StationCoordinates = {
    latitude: number;
    longitude: number;
};

const STATION_COORDINATES: Record<string, StationCoordinates> = {
    HWH: {
        latitude: 22.5839,
        longitude: 88.3428,
    },

    NJP: {
        latitude: 26.6826,
        longitude: 88.4580,
    },

    RPH: {
        latitude: 24.1760,
        longitude: 87.8400,
    },

    SNT: {
        latitude: 23.9465,
        longitude: 87.6800,
    },

    AMP: {
        latitude: 23.6150,
        longitude: 87.0550,
    },

    BHP: {
        latitude: 23.6680,
        longitude: 87.7170,
    },

    BWN: {
        latitude: 23.2324,
        longitude: 87.8615,
    },

    BDC: {
        latitude: 23.0710,
        longitude: 88.3770,
    },

    NDLS: {
        latitude: 28.6420,
        longitude: 77.2195,
    },
};

export async function getWeather(
    stationCode: string,
): Promise<WeatherData> {
    const code = stationCode.trim().toUpperCase();

    const coordinates = STATION_COORDINATES[code];

    if (!coordinates) {
        throw new Error(
            `Weather coordinates are not configured for ${code}.`,
        );
    }

    const params = new URLSearchParams({
        latitude: String(coordinates.latitude),
        longitude: String(coordinates.longitude),

        current:
            "temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,visibility,wind_speed_10m",

        timezone: "Asia/Kolkata",

        temperature_unit: "celsius",

        wind_speed_unit: "kmh",

        precipitation_unit: "mm",
    });

    const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
    );

    if (!response.ok) {
        throw new Error(
            `Weather API returned ${response.status}.`,
        );
    }

    const data = await response.json();

    if (!data?.current) {
        throw new Error(
            "Weather API returned no current weather data.",
        );
    }

    return {
        temperature: Number(
            data.current.temperature_2m ?? 0,
        ),

        humidity: Number(
            data.current.relative_humidity_2m ?? 0,
        ),

        precipitation: Number(
            data.current.precipitation ?? 0,
        ),

        rain: Number(
            data.current.rain ?? 0,
        ),

        weatherCode: Number(
            data.current.weather_code ?? 0,
        ),

        visibility: Number(
            data.current.visibility ?? 0,
        ),

        windSpeed: Number(
            data.current.wind_speed_10m ?? 0,
        ),

        time: String(
            data.current.time ?? "",
        ),

        timezone: String(
            data.timezone ?? "Asia/Kolkata",
        ),
    };
}

export function getWeatherDescription(
    code: number,
): string {
    if (code === 0) {
        return "Clear sky";
    }

    if (code === 1) {
        return "Mainly clear";
    }

    if (code === 2) {
        return "Partly cloudy";
    }

    if (code === 3) {
        return "Overcast";
    }

    if (code === 45 || code === 48) {
        return "Foggy";
    }

    if (code >= 51 && code <= 57) {
        return "Drizzle";
    }

    if (code >= 61 && code <= 67) {
        return "Rain";
    }

    if (code >= 71 && code <= 77) {
        return "Snow";
    }

    if (code >= 80 && code <= 82) {
        return "Rain showers";
    }

    if (code >= 85 && code <= 86) {
        return "Snow showers";
    }

    if (code >= 95 && code <= 99) {
        return "Thunderstorm";
    }

    return "Weather conditions available";
}