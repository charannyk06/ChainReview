"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DailyUsage } from "@/lib/api";

interface UsageChartProps {
  data: DailyUsage[];
  className?: string;
}

export function UsageChart({ data, className }: UsageChartProps) {
  const chartData = data.map((d) => ({
    date: d.date.slice(5), // MM-DD
    input: d.total_input_tokens,
    output: d.total_output_tokens,
    requests: d.request_count,
  }));

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorInput" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorOutput" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" opacity={0.3} />
          <XAxis dataKey="date" fontSize={12} stroke="#a1a1aa" />
          <YAxis fontSize={12} stroke="#a1a1aa" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#18181b",
              border: "1px solid #3f3f46",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            labelStyle={{ color: "#e4e4e7" }}
            formatter={(value: number, name: string) => [
              value.toLocaleString(),
              name === "input" ? "Input Tokens" : "Output Tokens",
            ]}
          />
          <Area
            type="monotone"
            dataKey="input"
            stroke="#6366f1"
            fillOpacity={1}
            fill="url(#colorInput)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="output"
            stroke="#06b6d4"
            fillOpacity={1}
            fill="url(#colorOutput)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
