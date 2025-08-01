import React from "react";
import { Sparklines, SparklinesLine } from "react-sparklines";

export default function EquityCurve({ data = [], loading }) {
  if (loading) {
    return (
      <div className="w-[400px] h-[200px] bg-neutral-900 rounded-2xl shadow-lg flex items-center justify-center animate-pulse">
        <div className="w-1/2 h-6 bg-neutral-800 rounded shimmer" />
      </div>
    );
  }
  if (!data || data.length < 2) {
    return (
      <div className="w-[400px] h-[200px] bg-[#E0E0E0] rounded-2xl shadow-lg flex items-center justify-center">
        <span className="text-[12px] text-neutral-500">Insufficient data</span>
      </div>
    );
  }
  return (
    <div className="w-[400px] h-[200px] bg-neutral-900 rounded-2xl shadow-lg flex items-center justify-center" aria-label="Equity Curve">
      <Sparklines data={data} width={380} height={160} margin={12}>
        <SparklinesLine color="#2E7D32" style={{ strokeWidth: 3, fill: "none" }} />
      </Sparklines>
    </div>
  );
} 