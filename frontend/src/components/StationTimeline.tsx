import type { ETAPrediction } from "../types";

interface StationTimelineProps {
  stations: any[];
  predictions: ETAPrediction[];
  currentCode: string;
  trainStarted?: boolean;
}

export default function StationTimeline({
  stations,
  predictions,
  currentCode,
  trainStarted = true,
}: StationTimelineProps) {

  // =========================================================
  // NORMALIZED CURRENT STATION
  // =========================================================

  const normalizedCurrentCode =
    String(currentCode || "")
      .trim()
      .toUpperCase();

  // =========================================================
  // PREDICTION MAP
  // =========================================================

  const predictionMap = new Map(
    predictions.map((prediction) => [
      String(
        prediction?.station?.code || ""
      )
        .trim()
        .toUpperCase(),

      prediction,
    ])
  );

  // =========================================================
  // HELPERS
  // =========================================================

  const getStationCode = (
    station: any
  ): string => {
    return String(
      station?.station_code ||
      station?.code ||
      ""
    )
      .trim()
      .toUpperCase();
  };

  const getStationName = (
    station: any
  ): string => {
    return (
      station?.station_name ||
      station?.name ||
      getStationCode(station) ||
      "Unknown station"
    );
  };

  const getDistance = (
    station: any
  ): number | null => {

    const value =
      station?.distance ??
      station?.distance_km;

    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return null;
    }

    const numericValue =
      Number(value);

    return Number.isFinite(
      numericValue
    )
      ? numericValue
      : null;
  };

  // =========================================================
  // CURRENT STATION INDEX
  // =========================================================

  const currentIndex =
    stations.findIndex(
      (station) =>
        getStationCode(station) ===
        normalizedCurrentCode
    );

  // =========================================================
  // LAST VISITED STATION
  // =========================================================

  const lastVisitedIndex =
    stations.reduce(
      (
        latestIndex,
        station,
        index
      ) => {

        const visited =
          Boolean(
            station?.actual_arrival ||
            station?.actual_departure
          );

        return visited
          ? index
          : latestIndex;
      },
      -1
    );

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="space-y-0">

      {stations.map(
        (
          station,
          index
        ) => {

          const stationCode =
            getStationCode(
              station
            );

          const stationName =
            getStationName(
              station
            );

          const distance =
            getDistance(
              station
            );

          const prediction =
            predictionMap.get(
              stationCode
            );

          // =================================================
          // STATION STATES
          // =================================================

          const isCurrent =
            stationCode ===
            normalizedCurrentCode;

          const isPassed =
            !isCurrent &&
            currentIndex >= 0 &&
            index < currentIndex;

          const isNext =
            !isCurrent &&
            currentIndex >= 0 &&
            index ===
              currentIndex + 1;

          const isFuture =
            !isCurrent &&
            !isPassed;

          // =================================================
          // DELAY
          // =================================================

          const delay =
            Number(
              prediction?.delay_minutes ??
              0
            );

          // =================================================
          // STATUS
          // =================================================

          let statusText =
            "On time";

          if (
            delay > 15
          ) {
            statusText =
              trainStarted
                ? "Late"
                : "Predicted late";
          } else if (
            delay > 5
          ) {
            statusText =
              trainStarted
                ? "Delayed"
                : "Predicted delayed";
          } else {
            statusText =
              trainStarted
                ? "On time"
                : "Predicted on time";
          }

          // =================================================
          // STATUS COLOR
          // =================================================

          const statusClass =
            delay > 15
              ? "text-rose-300"
              : delay > 5
                ? "text-amber-300"
                : "text-emerald-300";

          // =================================================
          // ACTUAL CURRENT STATION
          // =================================================

          const actualCurrent =
            isCurrent;

          // =================================================
          // STATION CONTAINER
          // =================================================

          const stationContainerClass =
            actualCurrent
              ? "rounded-2xl border border-blue-400/30 bg-blue-400/10 p-3"
              : isNext
                ? "rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                : "rounded-2xl p-3";

          return (
            <div
              key={`${stationCode}-${index}`}
              className="relative flex gap-4 pb-4 last:pb-0"
            >

              {/* =================================================
                  TIMELINE
              ================================================= */}

              <div className="flex w-5 shrink-0 flex-col items-center">

                {/* -------------------------------------------------
                    MARKER
                ------------------------------------------------- */}

                <div
                  className={`relative z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all ${
                    actualCurrent
                      ? "border-blue-300 bg-blue-500 shadow-[0_0_18px_rgba(59,130,246,0.75)]"
                      : isPassed
                        ? "border-white/10 bg-white/10"
                        : isNext
                          ? "border-blue-400/50 bg-blue-400/10"
                          : "border-white/20 bg-[#08080f]"
                  }`}
                >

                  {actualCurrent && (
                    <span className="h-2 w-2 rounded-full bg-white" />
                  )}

                </div>

                {/* -------------------------------------------------
                    CONNECTING LINE
                ------------------------------------------------- */}

                {index <
                  stations.length - 1 && (
                  <div
                    className={`w-px flex-1 ${
                      isPassed
                        ? "bg-white/10"
                        : actualCurrent
                          ? "bg-blue-400/40"
                          : "bg-white/10"
                    }`}
                  />
                )}

              </div>

              {/* =================================================
                  STATION CONTENT
              ================================================= */}

              <div
                className={`min-w-0 flex-1 ${stationContainerClass} ${
                  isPassed
                    ? "opacity-40"
                    : ""
                }`}
              >

                <div className="flex items-start justify-between gap-4">

                  {/* =================================================
                      LEFT
                  ================================================= */}

                  <div className="min-w-0">

                    {/* CURRENT BADGE */}

                    {actualCurrent && (
                      <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-blue-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-blue-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-300" />
                        Current station
                      </div>
                    )}

                    {/* NEXT BADGE */}

                    {!actualCurrent &&
                      isNext && (
                        <div className="mb-1 inline-flex rounded-full bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/45">
                          Next station
                        </div>
                      )}

                    {/* STATION NAME */}

                    <p
                      className={`font-semibold ${
                        actualCurrent
                          ? "text-lg text-white"
                          : "text-base text-white"
                      }`}
                    >
                      {stationName}
                    </p>

                    {/* CODE + DISTANCE */}

                    <p className="mt-1 text-xs text-white/40">

                      <span>
                        {stationCode}
                      </span>

                      <span className="mx-1">
                        ·
                      </span>

                      <span>
                        {distance !== null
                          ? `${Math.round(
                              distance
                            )} km`
                          : "Distance unavailable"}
                      </span>

                    </p>

                    {/* =================================================
                        STATUS
                    ================================================= */}

                    {prediction && (
                      <p
                        className={`mt-2 text-[11px] font-medium ${statusClass}`}
                      >
                        {statusText}

                        {delay > 0 && (
                          <>
                            {" · +"}
                            {Math.round(
                              delay
                            )}
                            {" min"}
                          </>
                        )}

                        {delay < 0 && (
                          <>
                            {" · "}
                            {Math.round(
                              delay
                            )}
                            {" min"}
                          </>
                        )}
                      </p>
                    )}

                    {/* PASSED */}

                    {isPassed &&
                      !prediction && (
                        <p className="mt-2 text-[10px] uppercase tracking-wider text-white/25">
                          Passed
                        </p>
                      )}

                  </div>

                  {/* =================================================
                      RIGHT / ETA
                  ================================================= */}

                  <div className="shrink-0 text-right">

                    {prediction ? (
                      <>
                        <p
                          className={`font-semibold ${
                            actualCurrent
                              ? "text-blue-300"
                              : "text-blue-300"
                          }`}
                        >
                          {new Date(
                            prediction.eta
                          ).toLocaleTimeString(
                            [],
                            {
                              hour: "2-digit",
                              minute:
                                "2-digit",
                            }
                          )}
                        </p>

                        <p className="mt-1 text-[10px] text-white/35">
                          P10–P90{" "}
                          {Math.round(
                            Number(
                              prediction
                                ?.confidence
                                ?.width_minutes ??
                              0
                            ) / 2
                          )}
                          m
                        </p>
                      </>
                    ) : actualCurrent ? (
                      <span className="rounded-full bg-blue-400/10 px-2 py-1 text-[10px] text-blue-300">
                        LIVE
                      </span>
                    ) : null}

                  </div>

                </div>

                {/* =================================================
                    CURRENT STATION DETAIL
                ================================================= */}

                {actualCurrent && (
                  <div className="mt-3 flex items-center justify-between border-t border-blue-400/10 pt-3">

                    <div>

                      <p className="text-[10px] uppercase tracking-widest text-blue-300/50">
                        Train position
                      </p>

                      <p className="mt-1 text-xs text-white/60">
                        Currently reported at this station
                      </p>

                    </div>

                    <span className="text-xs font-semibold text-blue-300">
                      LIVE
                    </span>

                  </div>
                )}

                {/* =================================================
                    FUTURE PREDICTION
                ================================================= */}

                {isFuture &&
                  prediction &&
                  !actualCurrent && (
                    <div className="mt-3 border-t border-white/5 pt-2">

                      <p className="text-[10px] text-white/25">
                        RailDrishri predicted arrival
                      </p>

                    </div>
                  )}

              </div>

            </div>
          );
        }
      )}

    </div>
  );
}