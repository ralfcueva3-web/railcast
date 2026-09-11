import { useEffect, useRef, useState } from "react";
import type { ETAResponse } from "../types";

const WS_URL = "ws://localhost:8000/live/13028";

export function useTrainSocket() {
  const [data, setData] = useState<ETAResponse | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const socket = new WebSocket(WS_URL);

    socketRef.current = socket;

    socket.onopen = () => {
      console.log("RailCast WebSocket connected");

      setConnected(true);
      setError(null);
    };

    socket.onmessage = (event) => {
      try {
        const message: ETAResponse = JSON.parse(event.data);

        console.log("RailCast update:", message);

        setData(message);
      } catch (err) {
        console.error("Invalid WebSocket message:", err);
        setError("Received invalid data from server");
      }
    };

    socket.onerror = () => {
      console.error("RailCast WebSocket error");
      setError("Unable to connect to RailCast server");
    };

    socket.onclose = () => {
      console.log("RailCast WebSocket disconnected");
      setConnected(false);
    };

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, []);

  return {
    data,
    connected,
    error,
  };
}