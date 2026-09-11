import type { Station } from "../types";

interface DemoControlsProps {
  stations: Station[];
  currentCode: string;
  currentDelay: number;
  running: boolean;
  onAdvance: () => void;
  onReset: () => void;
  onToggle: () => void;
}

export default function DemoControls({
  stations,
  currentCode,
  currentDelay,
  running,
  onAdvance,
  onReset,
  onToggle,
}: DemoControlsProps) {
  const currentIndex = stations.findIndex(
    (station) => station.code === currentCode
  );

  const currentStation = stations[currentIndex];

  const nextStation =
    currentIndex >= 0 && currentIndex < stations.length - 1
      ? stations[currentIndex + 1]
      : null;

  const completed =
    currentIndex === stations.length - 1;

  return (
    <section className="rounded-3xl border border-blue-400/15 bg-blue-400/[0.04] p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

        {/* Info */}
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">
              Demo simulation
            </p>

            <span className="rounded-full bg-blue-400/10 px-2 py-1 text-[10px] text-blue-300">
              SIH Demo
            </span>
          </div>

          <h2 className="mt-2 text-lg font-semibold">
            Live train movement simulator
          </h2>

          <p className="mt-1 text-xs text-white/40">
            Advance the train through the pilot route to demonstrate
            real-time ETA forecasting.
          </p>
        </div>

        {/* Current state */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">

          <div className="rounded-2xl border border-white/10 bg-[#12121d] px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-white/35">
              Current
            </p>

            <p className="mt-1 font-semibold text-blue-300">
              {currentStation?.code ?? currentCode}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#12121d] px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-white/35">
              Delay
            </p>

            <p className="mt-1 font-semibold">
              +{currentDelay.toFixed(0)} min
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#12121d] px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-white/35">
              Next station
            </p>

            <p className="mt-1 font-semibold text-white/80">
              {nextStation?.code ?? "HWH"}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-2">

          <button
            type="button"
            onClick={onAdvance}
            disabled={completed}
            className="rounded-xl bg-blue-400 px-4 py-2 text-sm font-semibold text-[#08080F] transition hover:bg-blue-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {completed ? "Journey Complete" : "Advance Train"}
          </button>

          <button
            type="button"
            onClick={onToggle}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
          >
            {running ? "Pause" : "Auto Run"}
          </button>

          <button
            type="button"
            onClick={onReset}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10"
          >
            Reset
          </button>

        </div>
      </div>

      {/* Progress */}
      <div className="mt-5">
        <div className="flex justify-between text-[10px] text-white/35">
          <span>
            {currentStation?.name ?? "Nalhati Junction"}
          </span>

          <span>
            {Math.max(currentIndex, 0)} / {stations.length - 1} segments
          </span>

          <span>
            Howrah Junction
          </span>
        </div>

        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-blue-400 transition-all duration-700"
            style={{
              width: `${
                currentIndex >= 0
                  ? (currentIndex / (stations.length - 1)) * 100
                  : 0
              }%`,
            }}
          />
        </div>
      </div>
    </section>
  );
}