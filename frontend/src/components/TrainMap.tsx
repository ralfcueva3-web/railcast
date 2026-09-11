import type { Station } from "../types";

export default function TrainMap({
  stations,
  currentCode,
}: {
  stations: Station[];
  currentCode: string;
}) {
  if (!stations || stations.length === 0) {
    return null;
  }

  const normalizedCurrentCode = String(currentCode)
    .trim()
    .toUpperCase();

  const currentIndex = stations.findIndex(
    (station) =>
      String(station.code)
        .trim()
        .toUpperCase() === normalizedCurrentCode
  );

  const currentDistance =
    currentIndex >= 0
      ? Number(stations[currentIndex].distance_km ?? 0)
      : Number(stations[0].distance_km ?? 0);

  const startDistance = Number(stations[0].distance_km ?? 0);

  const endDistance = Number(
    stations[stations.length - 1].distance_km ?? 0
  );

  const totalDistance = endDistance - startDistance;

  const progress =
    totalDistance > 0
      ? ((currentDistance - startDistance) / totalDistance) * 100
      : 0;

  const safeProgress = Math.min(
    100,
    Math.max(0, progress)
  );

  const currentStationName =
    currentIndex >= 0
      ? stations[currentIndex].name
      : normalizedCurrentCode;

  return (
    <div className="rounded-3xl border border-white/10 bg-[#12121d] p-5">

      {/* =================================================
          ROUTE MAP
      ================================================= */}

      <div className="mb-4 flex items-center justify-between">

        <div>

          <p className="text-xs uppercase tracking-[0.2em] text-white/40">
            Train route
          </p>

          <p className="mt-1 text-sm text-white/60">
            {currentStationName}
          </p>

        </div>

        <span className="text-xs text-white/40">
          {stations.length} stations
        </span>

      </div>

      {/* =================================================
          ROUTE PROGRESS
      ================================================= */}

      <div className="relative h-2 rounded-full bg-white/10">

        <div
          className="absolute inset-y-0 left-0 rounded-full bg-blue-500 transition-all duration-700"
          style={{
            width: `${safeProgress}%`,
          }}
        />

        <div
          className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_18px_#3b82f6] transition-all duration-700"
          style={{
            left: `${safeProgress}%`,
          }}
        />

      </div>

      {/* =================================================
          START / DESTINATION
      ================================================= */}

      <div className="mt-3 flex justify-between text-[10px] text-white/35">

        <span>
          {stations[0].code}
          <span className="ml-1">
            {stations[0].distance_km} km
          </span>
        </span>

        <span>
          {stations[stations.length - 1]?.code}
          <span className="ml-1">
            {stations[stations.length - 1]?.distance_km} km
          </span>
        </span>

      </div>

    </div>
  );
}