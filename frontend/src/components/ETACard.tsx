import type { ETAPrediction } from "../types";
import ConfidenceBand from "./ConfidenceBand";

export default function ETACard({
  prediction,
}: {
  prediction: ETAPrediction;
}) {
  const delay = prediction.delay_minutes;

  const status =
    delay <= 5
      ? "on time"
      : delay <= 15
        ? "delayed"
        : "late";

  const cls =
    status === "late"
      ? "text-rose-300 bg-rose-400/10 border-rose-400/20"
      : status === "delayed"
        ? "text-amber-300 bg-amber-400/10 border-amber-400/20"
        : "text-emerald-300 bg-emerald-400/10 border-emerald-400/20";

  return (
    <section className="rounded-3xl border border-white/10 bg-[#12121d] p-5 shadow-2xl shadow-black/20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">
            Expected arrival
          </p>

          <h2 className="mt-1 text-4xl font-semibold tracking-tight">
            {new Date(prediction.eta).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </h2>
        </div>

        <span
          className={`rounded-full border px-3 py-1 text-xs font-medium ${cls}`}
        >
          {status}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-sm text-white/50">
          {prediction.station.name}
        </p>

        <p
          className={`text-sm font-medium ${
            status === "late"
              ? "text-rose-300"
              : status === "delayed"
                ? "text-amber-300"
                : "text-emerald-300"
          }`}
        >
          +{delay.toFixed(0)} min projected delay
        </p>
      </div>

      <div className="mt-5">
        <ConfidenceBand band={prediction.confidence} />
      </div>
    </section>
  );
}