import type { ETAPrediction, Station } from "../types";

interface LiveRouteMapProps {
  stations: Station[];
  predictions: ETAPrediction[];
  currentCode: string;
  currentDelay: number;
}

export default function LiveRouteMap({
  stations,
  predictions,
  currentCode,
  currentDelay,
}: LiveRouteMapProps) {
  const startDistance = stations[0]?.distance_km ?? 0;
  const endDistance = stations[stations.length - 1]?.distance_km ?? 1;

  const getPosition = (distance: number) => {
    return (
      ((distance - startDistance) /
        (endDistance - startDistance)) *
      100
    );
  };

  const getDelay = (code: string) => {
    if (code === currentCode) {
      return currentDelay;
    }

    return (
      predictions.find(
        (prediction) => prediction.station.code === code
      )?.delay_minutes ?? null
    );
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-[#0f0f18] p-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">
            Live route
          </p>

          <h2 className="mt-1 font-semibold">
            Train position & delay propagation
          </h2>

          <p className="mt-1 text-xs text-white/40">
            Distance-aware railway route from Nalhati to Howrah
          </p>
        </div>

        <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
          ● Live
        </span>
      </div>

      {/* Route */}
      <div className="mt-8 overflow-x-auto pb-3">
        <div className="relative min-w-[850px]">

          {/* Railway line */}
          <div className="absolute left-0 right-0 top-[31px] h-[2px] bg-white/10" />

          {/* Progress line */}
          <div
            className="absolute left-0 top-[31px] h-[2px] bg-blue-400 transition-all duration-700"
            style={{
              width: `${getPosition(
                stations.find(
                  (station) => station.code === currentCode
                )?.distance_km ?? startDistance
              )}%`,
            }}
          />

          {/* Train */}
          <div
            className="absolute top-[16px] z-20 -translate-x-1/2 transition-all duration-700"
            style={{
              left: `${getPosition(
                stations.find(
                  (station) => station.code === currentCode
                )?.distance_km ?? startDistance
              )}%`,
            }}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-blue-300 bg-blue-400/20 text-sm text-blue-200 shadow-lg shadow-blue-400/20">
              🚆
            </div>
          </div>

          {/* Stations */}
          <div className="relative flex h-40 items-start justify-between">
            {stations.map((station) => {
              const isCurrent = station.code === currentCode;
              const delay = getDelay(station.code);

              return (
                <div
                  key={station.code}
                  className="absolute -translate-x-1/2 text-center"
                  style={{
                    left: `${getPosition(
                      station.distance_km
                    )}%`,
                  }}
                >
                  {/* Station marker */}
                  <div
                    className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full border ${
                      isCurrent
                        ? "border-blue-300 bg-blue-400/20 text-blue-300"
                        : "border-white/20 bg-[#12121d] text-white/40"
                    }`}
                  >
                    <div
                      className={`h-2 w-2 rounded-full ${
                        isCurrent
                          ? "bg-blue-300"
                          : "bg-white/30"
                      }`}
                    />
                  </div>

                  {/* Station code */}
                  <p
                    className={`mt-3 text-xs font-semibold ${
                      isCurrent
                        ? "text-blue-300"
                        : "text-white/70"
                    }`}
                  >
                    {station.code}
                  </p>

                  {/* Distance */}
                  <p className="mt-1 text-[10px] text-white/30">
                    {station.distance_km} km
                  </p>

                  {/* Delay */}
                  {delay !== null && (
                    <p
                      className={`mt-1 text-[10px] font-medium ${
                        delay > 15
                          ? "text-rose-300"
                          : delay > 5
                            ? "text-amber-300"
                            : "text-emerald-300"
                      }`}
                    >
                      {delay > 0 ? "+" : ""}
                      {delay.toFixed(0)}m
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Current train status */}
      <div className="mt-2 grid gap-3 sm:grid-cols-3">

        <div className="rounded-2xl border border-white/10 bg-[#12121d] p-4">
          <p className="text-xs text-white/35">
            Current station
          </p>

          <p className="mt-1 font-semibold text-blue-300">
            {currentCode}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#12121d] p-4">
          <p className="text-xs text-white/35">
            Current delay
          </p>

          <p className="mt-1 font-semibold">
            +{currentDelay.toFixed(0)} min
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#12121d] p-4">
          <p className="text-xs text-white/35">
            Route distance
          </p>

          <p className="mt-1 font-semibold">
            {endDistance - startDistance} km
          </p>
        </div>
      </div>
    </section>
  );
}