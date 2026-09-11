import type { ETAPrediction, Station } from "../types";

export default function StationTimeline({
  stations,
  predictions,
  currentCode,
  trainStarted = true,
}: {
  stations: any[];
  predictions: ETAPrediction[];
  currentCode: string;
  trainStarted?: boolean;
}) {
  /*
   * RailCast predictions are indexed by station code.
   */
  const map = new Map(
    predictions.map((p) => [
      p.station.code?.trim().toUpperCase(),
      p,
    ])
  );

  /*
   * Find current station using either:
   *
   * Static route:
   * station.code
   *
   * Dynamic NTES route:
   * station.station_code
   */
  const normalizedCurrentCode =
    currentCode?.trim().toUpperCase();

  const getStationCode = (station: any): string => {
    return (
      station.station_code ||
      station.code ||
      ""
    )
      .trim()
      .toUpperCase();
  };

  const getStationName = (station: any): string => {
    return (
      station.station_name ||
      station.name ||
      getStationCode(station)
    );
  };

  const getDistance = (station: any): number | null => {
    const value =
      station.distance ??
      station.distance_km;

    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return null;
    }

    const numericValue = Number(value);

    return Number.isFinite(numericValue)
      ? numericValue
      : null;
  };

  const currentIndex = stations.findIndex(
    (station) =>
      getStationCode(station) ===
      normalizedCurrentCode
  );

  return (
    <div className="space-y-0">
      {stations.map((station, index) => {
        const stationCode =
          getStationCode(station);

        const stationName =
          getStationName(station);

        const distance =
          getDistance(station);

        const prediction =
          map.get(stationCode);

        const current =
          stationCode ===
          normalizedCurrentCode;

        const passed =
          !prediction &&
          !current &&
          currentIndex >= 0 &&
          index < currentIndex;

        const delay =
          prediction?.delay_minutes ?? 0;

        /*
         * =====================================================
         * STATUS LOGIC
         * =====================================================
         *
         * If the train has NOT started:
         *
         * Future delay is a prediction, NOT an actual delay.
         *
         * Therefore:
         *
         * Predicted +5 min
         * Predicted +9 min
         *
         * instead of:
         *
         * Delayed +5 min
         * Delayed +9 min
         */

        const predictedStatus =
          delay <= 5
            ? "Predicted on time"
            : delay <= 15
              ? "Predicted delayed"
              : "Predicted late";

        /*
         * Normal running-train status.
         */
        const runningStatus =
          delay <= 5
            ? "On time"
            : delay <= 15
              ? "Delayed"
              : "Late";

        /*
         * Use prediction wording when the train
         * has not started yet.
         */
        const status =
          !trainStarted && !current
            ? predictedStatus
            : runningStatus;

        const statusClass =
          delay > 15
            ? "text-rose-300"
            : delay > 5
              ? "text-amber-300"
              : "text-emerald-300";

        return (
          <div
            key={`${stationCode}-${index}`}
            className="relative flex gap-4 pb-7 last:pb-0"
          >
            {/* =================================================
                TIMELINE MARKER
            ================================================= */}

            <div className="flex w-5 flex-col items-center">
              <div
                className={`z-10 h-4 w-4 rounded-full border-2 transition-all ${
                  current
                    ? "border-blue-300 bg-blue-500 shadow-[0_0_20px_#3b82f6]"
                    : passed
                      ? "border-white/15 bg-white/10"
                      : "border-white/25 bg-[#08080f]"
                }`}
              />

              {index < stations.length - 1 && (
                <div className="w-px flex-1 bg-white/10" />
              )}
            </div>

            {/* =================================================
                STATION INFORMATION
            ================================================= */}

            <div
              className={`flex-1 ${
                passed ? "opacity-35" : ""
              }`}
            >
              <div className="flex justify-between gap-4">

                {/* =================================================
                    LEFT SIDE
                ================================================= */}

                <div>
                  <p className="font-medium">
                    {stationName}
                  </p>

                  <p className="text-xs text-white/40">
                    {stationCode}
                    {" · "}
                    {distance !== null
                      ? `${distance} km`
                      : "Distance unavailable"}
                  </p>

                  {/* =================================================
                      PREDICTION STATUS
                  ================================================= */}

                  {prediction && (
                    <p
                      className={`mt-1 text-[11px] ${statusClass}`}
                    >
                      {status}

                      {delay > 0 &&
                        ` · +${delay.toFixed(0)} min`}
                    </p>
                  )}
                </div>

                {/* =================================================
                    RIGHT SIDE / ETA
                ================================================= */}

                <div className="text-right">

                  {prediction && (
                    <>
                      <p className="font-semibold text-blue-300">
                        {new Date(
                          prediction.eta
                        ).toLocaleTimeString(
                          [],
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </p>

                      <p className="text-[11px] text-white/40">
                        P10–P90{" "}
                        {Math.round(
                          prediction.confidence
                            .width_minutes / 2
                        )}
                        m
                      </p>
                    </>
                  )}

                  {/* =================================================
                      CURRENT STATION
                  ================================================= */}

                  {current && (
                    <span className="mt-1 inline-block rounded-full bg-blue-500/10 px-2 py-1 text-xs text-blue-300">
                      Live
                    </span>
                  )}

                </div>

              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}