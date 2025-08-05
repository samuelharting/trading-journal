import React, { useContext } from "react";
import { UserContext } from "../App";
import CircleCard from "../components/CircleCard";
import StatCard from "../components/StatCard";
import EquityCurve from "../components/EquityCurve";

export default function Summary() {
  // TODO: Replace these with real data from context or props
  // const { ... } = useContext(UserContext);
  const currentBalance = undefined; // TODO: wire real current balance
  const dayPnl = undefined; // TODO: wire real day P&L
  const weekPnl = undefined; // TODO: wire real week P&L
  const monthPnl = undefined; // TODO: wire real month P&L
  const winRate = undefined; // TODO: wire real win rate
  const avgPnl = undefined; // TODO: wire real avg P&L per trade
  const totalTrades = undefined; // TODO: wire real total trades
  const totalPayouts = undefined; // TODO: wire real total payouts
  const bestTrade = undefined; // TODO: wire real best trade
  const worstTrade = undefined; // TODO: wire real worst trade
  const equityCurve = undefined; // TODO: wire real equity curve array

  return (
    <div className="bg-[#212121] text-neutral-100 p-5 sm:p-6 lg:p-8 min-h-screen grid gap-6 grid-cols-12 auto-rows-[200px]">
      {/* Current Balance */}
      <div className="col-span-12 sm:col-span-4 sm:col-start-5 flex items-center justify-center">
        <CircleCard
          value={currentBalance}
          label="Current Balance"
          color="#2E7D32"
          ringColor="#2E7D32"
          ariaLabel="Current Account Balance"
        />
      </div>
      {/* Day/Week/Month P&L */}
      <div className="col-span-12 flex flex-row gap-5 justify-center items-center sm:col-span-12">
        <CircleCard
          value={dayPnl}
          label="Day P&L"
          color={dayPnl > 0 ? "#2E7D32" : "#B0BEC5"}
          ariaLabel="Day Profit and Loss"
        />
        <CircleCard
          value={weekPnl}
          label="Weekly P&L"
          color={weekPnl > 0 ? "#2E7D32" : "#B0BEC5"}
          ariaLabel="Weekly Profit and Loss"
        />
        <CircleCard
          value={monthPnl}
          label="Monthly P&L"
          color={monthPnl > 0 ? "#2E7D32" : "#B0BEC5"}
          ariaLabel="Monthly Profit and Loss"
        />
      </div>
      {/* Win Rate & Avg P&L/Trade */}
      <div className="col-span-12 flex flex-row gap-4 justify-center items-center">
        <StatCard
          value={winRate !== undefined ? winRate + "%" : "--"}
          label="Win Rate"
          ariaLabel="Win Rate"
        />
        <StatCard
          value={avgPnl !== undefined ? avgPnl : "--"}
          label="Avg P&L/Trade"
          ariaLabel="Average Profit and Loss per Trade"
        />
      </div>
      {/* Footer bar (Totals) */}
      <div className="col-span-12 flex justify-center items-center">
        <div className="rounded-full bg-neutral-800 py-3 px-6 flex flex-wrap gap-x-10 w-[300px]">
          <div className="flex flex-col items-center" aria-label="Total Trades">
            <span className="text-[16px] font-bold">{totalTrades !== undefined ? totalTrades : "--"}</span>
            <span className="text-xs text-neutral-400">Trades</span>
          </div>
          <div className="flex flex-col items-center" aria-label="Total Payouts">
            <span className="text-[16px] font-bold">{totalPayouts !== undefined ? totalPayouts : "--"}</span>
            <span className="text-xs text-neutral-400">Payouts</span>
          </div>
          <div className="flex flex-col items-center" aria-label="Best Trade">
            <span className="text-[16px] font-bold text-green-300">{bestTrade !== undefined ? (bestTrade > 0 ? "+" : "") + bestTrade : "--"}</span>
            <span className="text-xs text-neutral-400">Best</span>
          </div>
          <div className="flex flex-col items-center" aria-label="Worst Trade">
            <span className="text-[16px] font-bold text-red-300">{worstTrade !== undefined ? (worstTrade > 0 ? "+" : "") + worstTrade : "--"}</span>
            <span className="text-xs text-neutral-400">Worst</span>
          </div>
        </div>
      </div>
      {/* Equity Curve */}
      <div className="col-span-12 sm:col-span-8 sm:col-start-3 flex items-center justify-center">
        <EquityCurve data={equityCurve} />
      </div>
    </div>
  );
} 