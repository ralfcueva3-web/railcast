import { useEffect, useMemo, useState } from "react";

import { getETA } from "../api/trainApi";
import { useTrainSocket } from "../hooks/useTrainSocket";

import type { ETAResponse } from "../types";

import DelayPropagationChart from "../components/DelayPropagationChart";
import PredictionFactors from "../components/PredictionFactors";
import LiveRouteMap from "../components/LiveRouteMap";
import DemoControls from "../components/DemoControls";

import { stations, routeCodes } from "../data/route";


function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}


function formatDateTime(value?: string) {
  if (!value) return "Waiting for update";

  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}


function statusLabel(status: string) {
  if (status === "on_time") return "On time";
  if (status === "delayed") return "Delayed";
  return "Late";
}


export default function Dashboard() {
  const [initial, setInitial] = useState<ETAResponse | null>(null);
  const [error, setError] = useState("");

  // Demo simulation state
  const [demoStationIndex, setDemoStationIndex] = useState(0);
  const [demoRunning, setDemoRunning] = useState(false);

  // Real-time backend data
  const { data: liveData, connected } = useTrainSocket();

  const data = liveData ?? initial;

  /*
   * ---------------------------------------------------------
   * INITIAL ETA REQUEST
   * ---------------------------------------------------------
   */

  useEffect(() => {
    getETA(13028, "NHT")
      .then(setInitial)
      .catch((err) => {
        console.error(err);
        setError("Unable to load ETA prediction.");
      });
  }, []);


  /*
   * ---------------------------------------------------------
   * DEMO AUTO-RUN
   * ---------------------------------------------------------
   *
   * Advances the simulated train every 5 seconds.
   */

  useEffect(() => {
    if (!demoRunning) return;

    const timer = window.setInterval(() => {
      setDemoStationIndex((index) => {
        if (index >= stations.length - 1) {
          setDemoRunning(false);
          return index;
        }

        return index + 1;
      });
    }, 5000);

    return () => window.clearInterval(timer);
  }, [demoRunning]);


  /*
   * ---------------------------------------------------------
   * PREDICTION DATA
   * ---------------------------------------------------------
   */

  const predictions = data?.predictions ?? [];

  const finalPrediction = useMemo(
    () => predictions[predictions.length - 1],
    [predictions]
  );


  /*
   * ---------------------------------------------------------
   * DEMO CURRENT STATION
   * ---------------------------------------------------------
   *
   * If the user has advanced the simulator, the demo station
   * becomes the displayed station.
   *
   * When Reset is pressed, the dashboard returns to the
   * real backend station.
   */

  const demoActive =
    demoRunning || demoStationIndex > 0;

  const currentStation = demoActive
    ? stations[demoStationIndex].code
    : data?.current_station ?? "NHT";


  /*
   * ---------------------------------------------------------
   * JOURNEY PROGRESS
   * ---------------------------------------------------------
   */

  const progressIndex = routeCodes.indexOf(currentStation);

  const progress =
    progressIndex >= 0
      ? Math.round(
          (progressIndex / (routeCodes.length - 1)) * 100
        )
      : 0;


  /*
   * ---------------------------------------------------------
   * CURRENT DELAY
   * ---------------------------------------------------------
   *
   * At this stage the demo controls the visual position.
   * The actual delay remains the real backend value until
   * Demo Mode is connected to the prediction API.
   */

  const currentDelay =
    data?.current_delay_minutes ?? 4;


  return (
    <main className="min-h-screen bg-[#08080F] px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl space-y-6">


        {/* =====================================================
            HEADER
        ====================================================== */}

        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-400">
              RailCast · Staff Console
            </p>

            <h1 className="mt-2 text-3xl font-semibold">
              Kaviguru Express — Live ETA Control
            </h1>

            <p className="mt-2 text-sm text-white/45">
              Train 13028 · Nalhati Junction → Howrah Junction
            </p>
          </div>


          <div className="flex items-center gap-3">

            <span
              className={`rounded-full px-3 py-1 text-xs ${
                connected
                  ? "bg-emerald-400/10 text-emerald-300"
                  : "bg-amber-400/10 text-amber-300"
              }`}
            >
              {connected ? "● Live" : "Connecting…"}
            </span>

            <span className="text-xs text-white/35">
              Updated {formatDateTime(data?.generated_at)}
            </span>

          </div>

        </header>


        {/* =====================================================
            ERROR
        ====================================================== */}

        {error && (
          <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-300">
            {error}
          </div>
        )}


        {/* =====================================================
            TOP SUMMARY
        ====================================================== */}

        <section className="grid gap-4 md:grid-cols-4">


          {/* Current station */}

          <div className="rounded-3xl border border-white/10 bg-[#12121d] p-5">

            <p className="text-xs uppercase tracking-widest text-white/35">
              Current station
            </p>

            <p className="mt-3 text-xl font-semibold">
              {stations.find(
                (station) => station.code === currentStation
              )?.name ?? currentStation}
            </p>

            <p className="mt-2 text-sm text-white/45">
              {currentDelay.toFixed(0)} min current delay
            </p>

          </div>


          {/* Model confidence */}

          <div className="rounded-3xl border border-white/10 bg-[#12121d] p-5">

            <p className="text-xs uppercase tracking-widest text-white/35">
              Model confidence
            </p>

            <p className="mt-3 text-3xl font-semibold text-blue-300">
              {data
                ? `${data.model_confidence.toFixed(1)}%`
                : "--"}
            </p>

            <p className="mt-2 text-sm text-white/45">
              XGBoost + LSTM ensemble
            </p>

          </div>


          {/* Final ETA */}

          <div className="rounded-3xl border border-white/10 bg-[#12121d] p-5">

            <p className="text-xs uppercase tracking-widest text-white/35">
              Howrah predicted ETA
            </p>

            <p className="mt-3 text-3xl font-semibold text-blue-300">
              {finalPrediction
                ? formatTime(finalPrediction.eta)
                : "--:--"}
            </p>

            <p className="mt-2 text-sm text-white/45">
              {finalPrediction
                ? `+${finalPrediction.delay_minutes.toFixed(0)} min delay`
                : "Waiting for prediction"}
            </p>

          </div>


          {/* Journey progress */}

          <div className="rounded-3xl border border-white/10 bg-[#12121d] p-5">

            <p className="text-xs uppercase tracking-widest text-white/35">
              Journey progress
            </p>

            <p className="mt-3 text-3xl font-semibold">
              {progress}%
            </p>

            <p className="mt-2 text-sm text-white/45">
              {currentStation} → HWH
            </p>

          </div>

        </section>


        {/* =====================================================
            DEMO SIMULATION
        ====================================================== */}

        <DemoControls
          stations={stations}
          currentCode={stations[demoStationIndex].code}
          currentDelay={currentDelay}
          running={demoRunning}

          onAdvance={() => {
            setDemoStationIndex((index) => {
              const nextIndex = Math.min(
                index + 1,
                stations.length - 1
              );

              return nextIndex;
            });
          }}

          onReset={() => {
            setDemoStationIndex(0);
            setDemoRunning(false);
          }}

          onToggle={() => {
            /*
             * Don't allow Auto Run to start after reaching
             * Howrah.
             */
            if (
              demoStationIndex >=
              stations.length - 1
            ) {
              setDemoStationIndex(0);
            }

            setDemoRunning((running) => !running);
          }}
        />


        {/* =====================================================
            ROUTE OVERVIEW
        ====================================================== */}

        <section className="rounded-3xl border border-white/10 bg-[#0f0f18] p-6">

          <div className="flex items-center justify-between">

            <div>
              <h2 className="font-semibold">
                Route overview
              </h2>

              <p className="mt-1 text-xs text-white/40">
                Predicted delay propagation across the journey
              </p>
            </div>

            <span className="text-xs text-white/35">
              7 monitored segments
            </span>

          </div>


          <div className="mt-7 overflow-x-auto">

            <div className="flex min-w-[850px] items-start">

              {routeCodes.map((code, index) => {

                const prediction = predictions.find(
                  (item) => item.station.code === code
                );

                const isCurrent =
                  code === currentStation;


                return (
                  <div
                    key={code}
                    className="flex flex-1 items-start"
                  >

                    <div className="flex min-w-[90px] flex-col items-center text-center">

                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-full border ${
                          isCurrent
                            ? "border-blue-400 bg-blue-400/15 text-blue-300"
                            : "border-white/15 bg-white/5 text-white/40"
                        }`}
                      >
                        {isCurrent
                          ? "●"
                          : index + 1}
                      </div>


                      <p
                        className={`mt-3 text-xs font-semibold ${
                          isCurrent
                            ? "text-blue-300"
                            : "text-white/70"
                        }`}
                      >
                        {code}
                      </p>


                      {prediction && (
                        <p className="mt-1 text-[10px] text-white/35">
                          +
                          {prediction.delay_minutes.toFixed(
                            0
                          )}
                          m
                        </p>
                      )}

                    </div>


                    {index < routeCodes.length - 1 && (
                      <div className="mt-4 h-px flex-1 bg-white/10" />
                    )}

                  </div>
                );
              })}

            </div>

          </div>

        </section>


        {/* =====================================================
            DELAY PROPAGATION
        ====================================================== */}

        <DelayPropagationChart
          predictions={predictions}
        />


        {/* =====================================================
            PREDICTION FACTORS
        ====================================================== */}

        {data && (
          <PredictionFactors
            data={data}
          />
        )}


        {/* =====================================================
            LIVE ROUTE
        ====================================================== */}

        {data && (
          <LiveRouteMap
            stations={stations}
            predictions={predictions}
            currentCode={currentStation}
            currentDelay={currentDelay}
          />
        )}


        {/* =====================================================
            ML INSIGHT
        ====================================================== */}

        {data && (
          <section className="rounded-3xl border border-blue-400/15 bg-blue-400/[0.04] p-6">

            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

              <div>

                <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">
                  ML insight
                </p>

                <p className="mt-2 text-lg font-medium">
                  {data.insight ??
                    "Dynamic ensemble is updating ETA from live operating conditions."}
                </p>

                <p className="mt-2 text-sm text-white/40">
                  Prediction generated from current operating
                  conditions, historical delay patterns and
                  sequential delay behaviour.
                </p>

              </div>


              <div className="shrink-0 rounded-2xl border border-white/10 bg-[#12121d] px-5 py-4 text-center">

                <p className="text-xs text-white/40">
                  Confidence
                </p>

                <p className="mt-1 text-2xl font-semibold text-blue-300">
                  {data.model_confidence.toFixed(1)}%
                </p>

              </div>

            </div>

          </section>
        )}


        {/* =====================================================
            ETA TABLE
        ====================================================== */}

        <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#0f0f18]">

          <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">

            <div>

              <h2 className="font-semibold">
                Station-by-station prediction
              </h2>

              <p className="mt-1 text-xs text-white/40">
                Live ETA forecast generated by the RailCast ensemble
              </p>

            </div>

            <span className="text-xs text-white/35">
              {predictions.length} predictions
            </span>

          </div>


          <div className="overflow-x-auto">

            <table className="w-full min-w-[800px] text-left">

              <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-white/35">

                <tr>

                  <th className="px-6 py-4">
                    Station
                  </th>

                  <th className="px-6 py-4">
                    Scheduled
                  </th>

                  <th className="px-6 py-4">
                    Predicted ETA
                  </th>

                  <th className="px-6 py-4">
                    Delay
                  </th>

                  <th className="px-6 py-4">
                    Confidence
                  </th>

                  <th className="px-6 py-4">
                    Status
                  </th>

                </tr>

              </thead>


              <tbody>

                {predictions.map((prediction) => {

                  const delay =
                    prediction.delay_minutes;


                  const status =
                    delay <= 5
                      ? "on_time"
                      : delay <= 15
                        ? "delayed"
                        : "late";


                  const statusClass =
                    status === "on_time"
                      ? "text-emerald-300"
                      : status === "delayed"
                        ? "text-amber-300"
                        : "text-rose-300";


                  return (
                    <tr
                      key={prediction.station.code}
                      className="border-b border-white/5 last:border-0"
                    >

                      {/* Station */}

                      <td className="px-6 py-5">

                        <p className="font-medium">
                          {prediction.station.name}
                        </p>

                        <p className="mt-1 text-xs text-white/35">
                          {prediction.station.code} ·{" "}
                          {prediction.station.distance_km} km
                        </p>

                      </td>


                      {/* Scheduled */}

                      <td className="px-6 py-5 text-sm text-white/55">
                        {prediction.station.scheduled_arrival}
                      </td>


                      {/* Predicted ETA */}

                      <td className="px-6 py-5">

                        <span className="text-lg font-semibold text-blue-300">
                          {formatTime(prediction.eta)}
                        </span>

                      </td>


                      {/* Delay */}

                      <td className="px-6 py-5">

                        <span
                          className={
                            delay > 5
                              ? "font-semibold text-amber-300"
                              : "font-semibold text-emerald-300"
                          }
                        >
                          {delay > 0 ? "+" : ""}
                          {delay.toFixed(0)} min
                        </span>

                      </td>


                      {/* Confidence */}

                      <td className="px-6 py-5 text-sm text-white/55">

                        ±
                        {Math.round(
                          prediction.confidence.width_minutes /
                            2
                        )}
                        m

                      </td>


                      {/* Status */}

                      <td className="px-6 py-5">

                        <span
                          className={`text-sm ${statusClass}`}
                        >
                          {statusLabel(status)}
                        </span>

                      </td>

                    </tr>
                  );

                })}

              </tbody>

            </table>

          </div>

        </section>


        {/* =====================================================
            FOOTER
        ====================================================== */}

        <footer className="pb-4 text-center text-xs text-white/25">
          RailCast · Real-time ML ETA forecasting prototype · Train 13028
        </footer>

      </div>
    </main>
  );
}