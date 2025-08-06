import React from "react";
import { Sparklines, SparklinesLine } from "react-sparklines";

export default function EquityCurve({ data = [], loading }) {
  if (loading) {
    return (
      <div className="w-[400px] h-[160px] bg-black/20 rounded border border-neutral-800 flex items-center justify-center">
        <div className="w-1/3 h-3 bg-neutral-800 rounded" />
      </div>
    );
  }
  if (!data || data.length < 2) {
    return (
      <div className="w-[400px] h-[160px] bg-black/20 rounded border border-neutral-800 flex items-center justify-center">
        <span className="text-sm text-neutral-500">No data</span>
      </div>
    );
  }
  return (
    <div className="w-[400px] h-[160px] bg-black/20 rounded border border-neutral-800 flex items-center justify-center" aria-label="Equity Curve">
      <Sparklines data={data} width={380} height={140} margin={8}>
        <SparklinesLine color="#3B82F6" style={{ strokeWidth: 1.5, fill: "none" }} />
      </Sparklines>
    </div>
  );
} 