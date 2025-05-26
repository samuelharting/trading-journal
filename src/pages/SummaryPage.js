import React, { useEffect, useState, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CurrencyDollarIcon,
  ChartBarIcon,
  CalendarIcon,
  BoltIcon,
  ArrowTrendingUpIcon
} from "@heroicons/react/24/outline";
import { UserContext } from "../App";

function getAllJournalEntries(user) {
  const entries = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(`journal-${user}-`)) {
      try {
        const dayEntries = JSON.parse(localStorage.getItem(key));
        if (Array.isArray(dayEntries)) {
          dayEntries.forEach(entry => {
            entries.push({ ...entry, key });
          });
        }
      } catch {}
    }
  }
  // Sort by created date ascending
  return entries.sort((a, b) => new Date(a.created) - new Date(b.created));
}

function getStats(entries) {
  if (!entries.length) return null;
  const totalPnl = entries.reduce((sum, e) => sum + (Number(e.pnl) || 0), 0);
  const avgPnl = totalPnl / entries.length;
  const avgDuration = entries.reduce((sum, e) => sum + (parseFloat(e.duration) || 0), 0) / entries.length;
  const wins = entries.filter(e => Number(e.pnl) > 0).length;
  const losses = entries.filter(e => Number(e.pnl) < 0).length;
  const winRate = (wins / entries.length) * 100;
  const avgRr = entries.reduce((sum, e) => sum + (Number(e.rr) || 0), 0) / entries.length;
  // Group by week/month for averages
  const byWeek = {};
  const byMonth = {};
  entries.forEach(e => {
    const d = new Date(e.created);
    const week = `${d.getFullYear()}-W${getWeekNumber(d)}`;
    const month = `${d.getFullYear()}-${d.getMonth() + 1}`;
    byWeek[week] = (byWeek[week] || 0) + (Number(e.pnl) || 0);
    byMonth[month] = (byMonth[month] || 0) + (Number(e.pnl) || 0);
  });
  const avgWeekly = Object.values(byWeek).reduce((a, b) => a + b, 0) / Object.keys(byWeek).length;
  const avgMonthly = Object.values(byMonth).reduce((a, b) => a + b, 0) / Object.keys(byMonth).length;
  return {
    totalPnl,
    avgPnl,
    avgDuration,
    winRate,
    avgWeekly,
    avgMonthly,
    avgRr,
    wins,
    losses,
    byMonth,
    byWeek,
  };
}

function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1)/7);
  return weekNo;
}

function getEquityCurve(entries) {
  let curve = [];
  let last = 0;
  let points = [];
  entries.forEach((e, i) => {
    let bal = Number(e.accountBalance);
    if (!isNaN(bal) && bal > 0) {
      curve.push(bal);
      last = bal;
      points.push({ x: i, y: bal });
    } else {
      last += Number(e.pnl) || 0;
      curve.push(last);
      points.push({ x: i, y: last });
    }
  });
  return { curve, points };
}

function getStreaks(entries) {
  let greenStreak = 0, lossStreak = 0, maxGreen = 0, maxLoss = 0;
  let prevWin = null;
  entries.forEach(e => {
    const pnl = Number(e.pnl);
    if (pnl > 0) {
      greenStreak++;
      lossStreak = 0;
      maxGreen = Math.max(maxGreen, greenStreak);
      prevWin = true;
    } else if (pnl < 0) {
      greenStreak = 0;
      lossStreak = prevWin === false ? lossStreak + 1 : 1;
      maxLoss = Math.max(maxLoss, lossStreak);
      prevWin = false;
    } else {
      greenStreak = 0;
      lossStreak = 0;
      prevWin = null;
    }
  });
  return { greenStreak, lossStreak, maxGreen, maxLoss };
}

function getDailyPnl(entries) {
  const byDay = {};
  entries.forEach(e => {
    const d = new Date(e.created);
    const day = d.toLocaleDateString();
    byDay[day] = (byDay[day] || 0) + (Number(e.pnl) || 0);
  });
  return byDay;
}

// Animated number counter
const AnimatedNumber = ({ value, decimals = 2, className = "" }) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = display;
    let end = value;
    if (start === end) return;
    let raf;
    const step = () => {
      start += (end - start) * 0.2;
      if (Math.abs(end - start) < 0.01) start = end;
      setDisplay(Number(start.toFixed(decimals)));
      if (start !== end) raf = requestAnimationFrame(step);
    };
    step();
    return () => raf && cancelAnimationFrame(raf);
    // eslint-disable-next-line
  }, [value]);
  return <span className={className}>{display.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</span>;
};

const iconClass = "w-6 h-6 inline-block mr-2 text-blue-400 align-middle";

const sectionVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.12, duration: 0.5 } })
};

const SummaryPage = () => {
  const { user } = useContext(UserContext);
  const [stats, setStats] = useState(null);
  const [curveData, setCurveData] = useState({ curve: [], points: [] });
  const [streaks, setStreaks] = useState({});
  const [entries, setEntries] = useState([]);
  const [dailyPnl, setDailyPnl] = useState({});

  useEffect(() => {
    if (!user) return;
    const allEntries = getAllJournalEntries(user);
    setStats(getStats(allEntries));
    setCurveData(getEquityCurve(allEntries));
    setStreaks(getStreaks(allEntries));
    setEntries(allEntries);
    setDailyPnl(getDailyPnl(allEntries));
  }, [user]);

  const { curve, points } = curveData;
  const minY = Math.min(...curve);
  const maxY = Math.max(...curve);
  const height = 320;
  const width = 700;

  // Prepare weekly and monthly PnL tables
  const weeklyRows = stats ? Object.entries(stats.byWeek).sort((a, b) => b[0].localeCompare(a[0])) : [];
  const monthlyRows = stats ? Object.entries(stats.byMonth).sort((a, b) => b[0].localeCompare(a[0])) : [];
  const dailyRows = Object.entries(dailyPnl).sort((a, b) => new Date(b[0]) - new Date(a[0]));

  // Compute current account balance
  let currentBalance = null;
  if (entries.length > 0) {
    // Always calculate: first accountBalance + sum of all P&L
    const firstBalance = Number(entries[0].accountBalance) || 0;
    const totalPnl = entries.reduce((sum, e) => sum + (Number(e.pnl) || 0), 0);
    currentBalance = (firstBalance + totalPnl).toLocaleString(undefined, { maximumFractionDigits: 2 });
  } else {
    currentBalance = "0.00";
  }

  // Find the most recent day, week, and month
  const mostRecentDay = dailyRows.length > 0 ? dailyRows[0] : null;
  const mostRecentWeek = weeklyRows.length > 0 ? weeklyRows[0] : null;
  const mostRecentMonth = monthlyRows.length > 0 ? monthlyRows[0] : null;

  return (
    <div className="w-full min-h-screen bg-black pt-20 px-8">
      <h2 className="text-3xl font-bold mb-8 text-[#e5e5e5]">Summary</h2>
      {!stats ? (
        <div className="text-neutral-500">No data yet.</div>
      ) : (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{}}
          className="w-full flex flex-col gap-8"
        >
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 w-full">
            <motion.div custom={0} variants={sectionVariants} className="bg-neutral-900 rounded-md p-8 flex flex-col gap-2 border-none shadow-none text-[#e5e5e5]">
              <div className="text-lg font-bold mb-2">Total P&L</div>
              <AnimatedNumber value={stats.totalPnl} className={stats.totalPnl > 0 ? "text-green-400 text-2xl font-bold" : stats.totalPnl < 0 ? "text-red-400 text-2xl font-bold" : "text-[#e5e5e5] text-2xl font-bold"} />
            </motion.div>
            <motion.div custom={1} variants={sectionVariants} className="bg-neutral-900 rounded-md p-8 flex flex-col gap-2 border-none shadow-none text-[#e5e5e5]">
              <div className="text-lg font-bold mb-2">Avg P&L per Trade</div>
              <AnimatedNumber value={stats.avgPnl} className="text-green-200 text-2xl font-bold" />
            </motion.div>
            <motion.div custom={2} variants={sectionVariants} className="bg-neutral-900 rounded-md p-8 flex flex-col gap-2 border-none shadow-none text-[#e5e5e5]">
              <div className="text-lg font-bold mb-2">Win Rate</div>
              <AnimatedNumber value={stats.winRate} decimals={1} className="text-yellow-300 text-2xl font-bold" />%
            </motion.div>
            <motion.div custom={3} variants={sectionVariants} className="bg-neutral-900 rounded-md p-8 flex flex-col gap-2 border-none shadow-none text-[#e5e5e5]">
              <div className="text-lg font-bold mb-2">Avg R:R</div>
              <AnimatedNumber value={stats.avgRr} decimals={2} className="text-purple-300 text-2xl font-bold" />
            </motion.div>
          </div>
          {/* Current Account Balance Card */}
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="bg-neutral-900 rounded-xl p-10 flex flex-col items-center justify-center border-none shadow-none text-[#e5e5e5] w-full max-w-xl mx-auto">
            <div className="text-lg font-bold mb-2 tracking-wide">Current Account Balance</div>
            <div className="text-4xl font-extrabold text-green-300">{currentBalance}</div>
          </motion.div>
          {/* Streaks */}
          <motion.div custom={4} variants={sectionVariants} className="bg-neutral-900 rounded-md p-8 flex flex-col gap-2 border-none shadow-none text-[#e5e5e5] w-full">
            <div className="text-lg font-bold mb-2">Streak Tracker</div>
            <div className="flex flex-wrap gap-6">
              <div><span className="text-green-400 font-semibold">Green Day Streak:</span> {streaks.greenStreak}</div>
              <div><span className="text-green-300 font-semibold">Max Green Streak:</span> {streaks.maxGreen}</div>
              <div><span className="text-red-400 font-semibold">Loss Streak:</span> {streaks.lossStreak}</div>
              <div><span className="text-red-300 font-semibold">Max Loss Streak:</span> {streaks.maxLoss}</div>
            </div>
          </motion.div>
          {/* Equity Curve */}
          <motion.div custom={5} variants={sectionVariants} className="bg-neutral-900 rounded-md p-8 flex flex-col gap-4 items-center border-none shadow-none text-[#e5e5e5] w-full">
            <div className="text-lg font-bold mb-2">Equity Curve</div>
            {curve.length < 2 ? (
              <div className="text-gray-400">Not enough data for chart.</div>
            ) : (
              <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-80 bg-gray-900 rounded">
                {/* Gradient fill under curve */}
                <defs>
                  <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#1e293b" stopOpacity="0.1" />
                  </linearGradient>
                </defs>
                <polyline
                  fill="none"
                  stroke="#60a5fa"
                  strokeWidth="3"
                  points={curve.map((v, i) => `${(i / (curve.length - 1)) * width},${height - ((v - minY) / (maxY - minY || 1)) * (height - 40) - 20}`).join(" ")}
                />
                {/* Animated fill under curve */}
                <motion.polygon
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1 }}
                  fill="url(#curveGradient)"
                  points={curve.map((v, i) => `${(i / (curve.length - 1)) * width},${height - ((v - minY) / (maxY - minY || 1)) * (height - 40) - 20}`).join(" ") + ` ${width},${height} 0,${height}`}
                />
                {points.map((pt, i) => (
                  <circle
                    key={i}
                    cx={(i / (curve.length - 1)) * width}
                    cy={height - ((pt.y - minY) / (maxY - minY || 1)) * (height - 40) - 20}
                    r="4"
                    fill="#38bdf8"
                    stroke="#fff"
                    strokeWidth="1"
                  />
                ))}
                {/* Y-axis labels */}
                <text x="10" y="30" fill="#fff" fontSize="16">{maxY.toFixed(2)}</text>
                <text x="10" y={height - 10} fill="#fff" fontSize="16">{minY.toFixed(2)}</text>
              </svg>
            )}
          </motion.div>
          {/* Modern Daily/Weekly/Monthly P&L Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
            {/* Daily */}
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="flex flex-col gap-4">
              <div className="text-xl font-bold mb-2">Daily P&L</div>
              <div className="flex flex-col gap-4">
                {mostRecentDay && (
                  <motion.div
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className="bg-white/10 backdrop-blur-lg rounded-xl p-4 flex flex-col border border-white/20 shadow-lg"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-[#e5e5e5] text-base">{mostRecentDay[0]}</span>
                      <span className={mostRecentDay[1] > 0 ? "text-green-400 font-bold" : mostRecentDay[1] < 0 ? "text-red-400 font-bold" : "text-neutral-300 font-bold"}>{mostRecentDay[1] > 0 ? "+" : ""}{mostRecentDay[1].toFixed(2)}</span>
                    </div>
                    <div className="w-full h-2 rounded bg-neutral-800 overflow-hidden">
                      <div className={mostRecentDay[1] > 0 ? "bg-green-500" : mostRecentDay[1] < 0 ? "bg-red-500" : "bg-neutral-500"} style={{ width: `${Math.min(Math.abs(mostRecentDay[1]) * 2, 100)}%`, height: '100%' }} />
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
            {/* Weekly */}
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="flex flex-col gap-4">
              <div className="text-xl font-bold mb-2">Weekly P&L</div>
              <div className="flex flex-col gap-4">
                {mostRecentWeek && (
                  <motion.div
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className="bg-white/10 backdrop-blur-lg rounded-xl p-4 flex flex-col border border-white/20 shadow-lg"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-[#e5e5e5] text-base">{mostRecentWeek[0]}</span>
                      <span className={mostRecentWeek[1] > 0 ? "text-green-400 font-bold" : mostRecentWeek[1] < 0 ? "text-red-400 font-bold" : "text-neutral-300 font-bold"}>{mostRecentWeek[1] > 0 ? "+" : ""}{mostRecentWeek[1].toFixed(2)}</span>
                    </div>
                    <div className="w-full h-2 rounded bg-neutral-800 overflow-hidden">
                      <div className={mostRecentWeek[1] > 0 ? "bg-green-500" : mostRecentWeek[1] < 0 ? "bg-red-500" : "bg-neutral-500"} style={{ width: `${Math.min(Math.abs(mostRecentWeek[1]) * 2, 100)}%`, height: '100%' }} />
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
            {/* Monthly */}
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }} className="flex flex-col gap-4">
              <div className="text-xl font-bold mb-2">Monthly P&L</div>
              <div className="flex flex-col gap-4">
                {mostRecentMonth && (
                  <motion.div
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className="bg-white/10 backdrop-blur-lg rounded-xl p-4 flex flex-col border border-white/20 shadow-lg"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-[#e5e5e5] text-base">{mostRecentMonth[0]}</span>
                      <span className={mostRecentMonth[1] > 0 ? "text-green-400 font-bold" : mostRecentMonth[1] < 0 ? "text-red-400 font-bold" : "text-neutral-300 font-bold"}>{mostRecentMonth[1] > 0 ? "+" : ""}{mostRecentMonth[1].toFixed(2)}</span>
                    </div>
                    <div className="w-full h-2 rounded bg-neutral-800 overflow-hidden">
                      <div className={mostRecentMonth[1] > 0 ? "bg-green-500" : mostRecentMonth[1] < 0 ? "bg-red-500" : "bg-neutral-500"} style={{ width: `${Math.min(Math.abs(mostRecentMonth[1]) * 2, 100)}%`, height: '100%' }} />
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default SummaryPage; 