import type { ETAResponse } from "../types";

// const API_URL = "http://localhost:8000";
const API_URL = "http://127.0.0.1:8000";

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
    throw new Error(`Authentication failed: ${response.status}`);
  }

  const data: { access_token: string } = await response.json();

  token = data.access_token;

  return token;
}

export async function getETA(
  trainNo: number,
  stationCode: string
): Promise<ETAResponse> {
  const jwt = await getToken();

  const response = await fetch(
    `${API_URL}/eta/${trainNo}/${stationCode}`,
    {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`ETA request failed: ${response.status}`);
  }

  return response.json();
}

export async function getStationTrains(stationCode: string) {
  const jwt = await getToken();

  const response = await fetch(
    `${API_URL}/ntes/station/${stationCode}`,
    {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Station request failed: ${response.status}`);
  }

  return response.json();
}

export async function getTrainStatus(
  trainNo: string,
  date: string
) {
  const jwt = await getToken();

  const response = await fetch(
    `${API_URL}/ntes/train/${trainNo}?date=${date}`,
    {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Train status request failed: ${response.status}`
    );
  }

  return response.json();
}

export async function getTrainRoute(
  trainNo: string,
  date: string
) {
  const jwt = await getToken();

  const response = await fetch(
    `${API_URL}/ntes/train/${trainNo}/route?date=${date}`,
    {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Train route request failed: ${response.status}`
    );
  }

  return response.json();
}