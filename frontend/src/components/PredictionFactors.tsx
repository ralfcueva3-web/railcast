import type { ETAResponse } from "../types";

interface PredictionFactorsProps {
  data: ETAResponse;
}

export default function PredictionFactors({
  data,
}: PredictionFactorsProps) {
  const predictions = data.predictions;

  const firstDelay = predictions[0]?.delay_minutes ?? data.current_delay_minutes;
  const finalDelay =
    predictions[predictions.length - 1]?.delay_minutes ??
    data.current_delay_minutes;

  const delayChange = finalDelay - data.current_delay_minutes;

  const trend =
    delayChange > 2
      ? "Increasing"
      : delayChange < -2
        ? "Recovering"
        : "Stable";

  const trendSymbol =
    trend === "Increasing"
      ? "↑"
      : trend === "Recovering"
        ? "↓"
        : "→";

  const trendClass =
    trend === "Increasing"
      ? "text-amber-300"
      : trend === "Recovering"
        ? "text-emerald-300"
        : "text-blue-300";

  const uncertainty =
    predictions.length > 0
      ? Math.round(
          predictions.reduce(
            (sum, prediction) =>
              sum + prediction.confidence.width_minutes / 2,
            0
          ) / predictions.length
        )
      : 0;

  return (
    <section className="rounded-3xl border border-white/10 bg-[#0f0f18] p-6">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">
          Prediction factors
        </p>

        <p className="mt-1 text-xs text-white/40">
          Signals currently reflected in the RailCast forecast
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

        {/* Current delay */}
        <div className="rounded-2xl border border-white/10 bg-[#12121d] p-4">
          <p className="text-xs text-white/40">
            Current delay
          </p>

          <p className="mt-2 text-2xl font-semibold text-white">
            +{data.current_delay_minutes.toFixed(0)} min
          </p>

          <p className="mt-1 text-xs text-white/30">
            Live operating delay
          </p>
        </div>

        {/* Delay trend */}
        <div className="rounded-2xl border border-white/10 bg-[#12121d] p-4">
          <p className="text-xs text-white/40">
            Delay trend
          </p>

          <p className={`mt-2 text-2xl font-semibold ${trendClass}`}>
            {trendSymbol} {trend}
          </p>

          <p className="mt-1 text-xs text-white/30">
            Current → final forecast
          </p>
        </div>

        {/* Final predicted delay */}
        <div className="rounded-2xl border border-white/10 bg-[#12121d] p-4">
          <p className="text-xs text-white/40">
            Final predicted delay
          </p>

          <p className="mt-2 text-2xl font-semibold text-amber-300">
            +{finalDelay.toFixed(0)} min
          </p>

          <p className="mt-1 text-xs text-white/30">
            At Howrah Junction
          </p>
        </div>

        {/* Uncertainty */}
        <div className="rounded-2xl border border-white/10 bg-[#12121d] p-4">
          <p className="text-xs text-white/40">
            Avg. uncertainty
          </p>

          <p className="mt-2 text-2xl font-semibold text-blue-300">
            ±{uncertainty} min
          </p>

          <p className="mt-1 text-xs text-white/30">
            P10–P90 forecast band
          </p>
        </div>
      </div>

      {/* Model explanation */}
      <div className="mt-4 rounded-2xl border border-blue-400/10 bg-blue-400/[0.03] p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">
              Ensemble forecast
            </p>

            <p className="mt-1 text-xs text-white/40">
              XGBoost captures structured delay patterns while LSTM
              models sequential delay behaviour across the route.
            </p>
          </div>

          <div className="shrink-0">
            <span className="rounded-full bg-blue-400/10 px-3 py-1 text-xs text-blue-300">
              {data.model_confidence.toFixed(1)}% confidence
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}