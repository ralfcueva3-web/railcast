import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import type { ETAPrediction } from "../types";

interface DelayPropagationChartProps {
  predictions: ETAPrediction[];
}

export default function DelayPropagationChart({
  predictions,
}: DelayPropagationChartProps) {
  const chartData = predictions.map((prediction) => ({
    station: prediction.station.code,
    delay: Number(prediction.delay_minutes.toFixed(1)),
  }));

  return (
    <section className="rounded-3xl border border-white/10 bg-[#0f0f18] p-6">
      <div className="mb-5">
        <h2 className="font-semibold">Delay propagation</h2>

        <p className="mt-1 text-xs text-white/40">
          Predicted delay as the train moves through each station
        </p>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{
              top: 10,
              right: 10,
              left: 0,
              bottom: 5,
            }}
          >
            <CartesianGrid
              stroke="rgba(255,255,255,0.08)"
              vertical={false}
            />

            <XAxis
              dataKey="station"
              tick={{
                fill: "rgba(255,255,255,0.45)",
                fontSize: 11,
              }}
              axisLine={false}
              tickLine={false}
            />

            <YAxis
              tick={{
                fill: "rgba(255,255,255,0.45)",
                fontSize: 11,
              }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `${value}m`}
            />

            <Tooltip
              contentStyle={{
                background: "#12121d",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "12px",
                color: "#fff",
              }}
              labelStyle={{
                color: "rgba(255,255,255,0.55)",
              }}
              formatter={(value) => [`${value} min`, "Predicted delay"]}
            />

            <Line
              type="monotone"
              dataKey="delay"
              stroke="#60a5fa"
              strokeWidth={3}
              dot={{
                r: 4,
                strokeWidth: 2,
              }}
              activeDot={{
                r: 6,
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}