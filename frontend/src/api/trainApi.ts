import type { ETAResponse } from "../types";

// =========================================================
// API CONFIGURATION
// =========================================================

// Local development:
// VITE_API_URL=http://localhost:8000
//
// Production:
// VITE_API_URL=https://splendid-youthfulness-production.up.railway.app

const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
  throw new Error(
    "VITE_API_URL is not configured. " +
      "Create frontend/.env.local for local development."
  );
}

// =========================================================
// TYPES
// =========================================================

export type DataSource =
  | "NTES_LIVE"
  | "REDIS_CACHE"
  | "DEMO_FALLBACK"
  | "UNAVAILABLE";

export interface StationTrain {
  train_no: string;
  train_name: string | null;

  source: string | null;
  source_name: string | null;

  destination: string | null;
  destination_name: string | null;

  eta: string | null;
  etd: string | null;

  scheduled_arrival: string | null;
  scheduled_departure: string | null;

  platform: string | number | null;

  arrival_delay: number;
  departure_delay: number;

  cancelled: number | boolean;
  diverted: number | boolean;

  train_type: string | null;
}

export interface StationTrainsResponse {
  station: string;
  station_name: string;

  total_trains: number;

  trains: StationTrain[];

  data_source: DataSource;

  cached: boolean;

  demo: boolean;

  generated_at?: string;
}

export interface TrainStatusResponse {
  [key: string]: unknown;
}

export interface TrainRouteResponse {
  [key: string]: unknown;
}

// =========================================================
// AUTHENTICATION
// =========================================================

let token: string | null = null;

async function getToken(): Promise<string> {
  if (token) {
    return token;
  }

  const response = await fetch(
    `${API_URL}/auth/token?username=railcast&password=railcast-demo`,
    {
      method: "POST",
    }
  );

  if (!response.ok) {
    throw new Error(
      `Authentication failed: ${response.status}`
    );
  }

  const data: {
    access_token: string;
  } = await response.json();

  token = data.access_token;

  return token;
}

// =========================================================
// GENERIC AUTHENTICATED REQUEST
// =========================================================

async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const jwt = await getToken();

  let response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${jwt}`,
    },
  });

  // -------------------------------------------------------
  // If JWT expired, clear it and authenticate once again.
  // -------------------------------------------------------

  if (response.status === 401) {
    token = null;

    const newJwt = await getToken();

    response = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${newJwt}`,
      },
    });
  }

  return response;
}

// =========================================================
// ETA
// =========================================================

export async function getETA(
  trainNo: string | number,
  stationCode: string
): Promise<ETAResponse> {
  const normalizedTrainNo = String(
    trainNo
  ).trim();

  const normalizedStationCode = String(
    stationCode
  )
    .trim()
    .toUpperCase();

  if (!normalizedTrainNo) {
    throw new Error(
      "Train number is required."
    );
  }

  if (!normalizedStationCode) {
    throw new Error(
      "Station code is required."
    );
  }

  const response = await authenticatedFetch(
    `${API_URL}/eta/${encodeURIComponent(
      normalizedTrainNo
    )}/${encodeURIComponent(
      normalizedStationCode
    )}`
  );

  if (!response.ok) {
    let detail = "";

    try {
      const errorData = await response.json();

      if (typeof errorData.detail === "string") {
        detail = ` - ${errorData.detail}`;
      }
    } catch {
      // Ignore JSON parsing failure.
    }

    throw new Error(
      `ETA request failed: ${response.status}${detail}`
    );
  }

  return response.json();
}

// =========================================================
// STATION LIVE TRAINS
// =========================================================

export async function getStationTrains(
  stationCode: string
): Promise<StationTrainsResponse> {
  const normalizedStationCode = String(
    stationCode
  )
    .trim()
    .toUpperCase();

  if (!normalizedStationCode) {
    throw new Error(
      "Station code is required."
    );
  }

  const response = await authenticatedFetch(
    `${API_URL}/ntes/station/${encodeURIComponent(
      normalizedStationCode
    )}`
  );

  if (!response.ok) {
    let detail = "";

    try {
      const errorData = await response.json();

      if (
        errorData.detail &&
        typeof errorData.detail === "string"
      ) {
        detail = ` - ${errorData.detail}`;
      }

      if (
        errorData.detail &&
        typeof errorData.detail === "object"
      ) {
        detail = ` - ${
          errorData.detail.message ||
          "Station data unavailable."
        }`;
      }
    } catch {
      // Ignore JSON parsing failure.
    }

    throw new Error(
      `Station request failed: ${response.status}${detail}`
    );
  }

  const data: StationTrainsResponse =
    await response.json();

  return data;
}

// =========================================================
// TRAIN STATUS
// =========================================================

export async function getTrainStatus(
  trainNo: string,
  date: string
): Promise<TrainStatusResponse> {
  const normalizedTrainNo = String(
    trainNo
  ).trim();

  const normalizedDate = String(
    date
  ).trim();

  if (!normalizedTrainNo) {
    throw new Error(
      "Train number is required."
    );
  }

  if (!normalizedDate) {
    throw new Error(
      "Date is required."
    );
  }

  const response = await authenticatedFetch(
    `${API_URL}/ntes/train/${encodeURIComponent(
      normalizedTrainNo
    )}?date=${encodeURIComponent(
      normalizedDate
    )}`
  );

  if (!response.ok) {
    let detail = "";

    try {
      const errorData = await response.json();

      if (typeof errorData.detail === "string") {
        detail = ` - ${errorData.detail}`;
      }
    } catch {
      // Ignore JSON parsing failure.
    }

    throw new Error(
      `Train status request failed: ${response.status}${detail}`
    );
  }

  return response.json();
}

// =========================================================
// TRAIN ROUTE
// =========================================================

export async function getTrainRoute(
  trainNo: string,
  date: string
): Promise<TrainRouteResponse> {
  const normalizedTrainNo = String(
    trainNo
  ).trim();

  const normalizedDate = String(
    date
  ).trim();

  if (!normalizedTrainNo) {
    throw new Error(
      "Train number is required."
    );
  }

  if (!normalizedDate) {
    throw new Error(
      "Date is required."
    );
  }

  const response = await authenticatedFetch(
    `${API_URL}/ntes/train/${encodeURIComponent(
      normalizedTrainNo
    )}/route?date=${encodeURIComponent(
      normalizedDate
    )}`
  );

  if (!response.ok) {
    let detail = "";

    try {
      const errorData = await response.json();

      if (typeof errorData.detail === "string") {
        detail = ` - ${errorData.detail}`;
      }
    } catch {
      // Ignore JSON parsing failure.
    }

    throw new Error(
      `Train route request failed: ${response.status}${detail}`
    );
  }

  return response.json();
}