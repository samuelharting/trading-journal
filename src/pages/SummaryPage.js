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
import { db } from '../firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import Spinner from '../components/MatrixLoader';
import GlitchTitle from '../components/GlitchTitle';
import { useNavigate } from "react-router-dom";

function getStats(entries) {
  if (!entries.length) return null;
  // Only include entries that are not deposits for trade stats
  const tradeEntries = entries.filter(e => !e.isDeposit && ((e.pnl !== undefined && e.pnl !== null && e.pnl !== "" && Number(e.pnl) !== 0) || (e.rr !== undefined && e.rr !== null && e.rr !== "" && Number(e.rr) !== 0)));
  const totalPnl = tradeEntries.reduce((sum, e) => sum + (Number(e.pnl) || 0), 0);
  const avgPnl = tradeEntries.length ? totalPnl / tradeEntries.length : 0;
  const avgDuration = tradeEntries.length ? tradeEntries.reduce((sum, e) => sum + (parseFloat(e.duration) || 0), 0) / tradeEntries.length : 0;
  const wins = tradeEntries.filter(e => Number(e.pnl) > 0).length;
  const losses = tradeEntries.filter(e => Number(e.pnl) < 0).length;
  const winRate = tradeEntries.length ? (wins / tradeEntries.length) * 100 : 0;
  const avgRr = tradeEntries.length ? tradeEntries.reduce((sum, e) => sum + (Number(e.rr) || 0), 0) / tradeEntries.length : 0;
  // Group by week/month for averages (all entries)
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

function getEquityCurve(entries) {
  // Sort entries by created date ascending
  const sorted = [...entries].sort((a, b) => new Date(a.created) - new Date(b.created));
  let curve = [];
  let firstBal = (sorted.length && !isNaN(Number(sorted[0].accountBalance)) && Number(sorted[0].accountBalance) !== 0) ? Number(sorted[0].accountBalance) : 0;
  let last = firstBal;
  curve.push(last);
  let points = [];
  sorted.forEach((e, i) => {
    const pnl = Number(e.pnl) || 0;
    last = Math.round((last + pnl) * 100) / 100; // round to 2 decimals after each addition
    curve.push(last);
    points.push({ x: i, y: last });
  });
  return { curve, points };
}

function getStreaks(entries) {
  let greenStreak = 0, lossStreak = 0, maxGreen = 0, maxLoss = 0;
  let prevWin = null;
  // Only count non-deposit entries
  entries.filter(e => !e.isDeposit).forEach(e => {
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
  // Only count non-deposit entries
  entries.filter(e => !e.isDeposit).forEach(e => {
    const d = new Date(e.created);
    const day = d.toLocaleDateString();
    byDay[day] = (byDay[day] || 0) + (Number(e.pnl) || 0);
  });
  return byDay;
}

function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1)/7);
  return weekNo;
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

function formatDurationMins(mins) {
  if (!mins || isNaN(mins)) return '';
  const hours = Math.floor(mins / 60);
  const minutes = Math.round(mins % 60);
  if (hours > 0 && minutes > 0) return `${hours}hr ${minutes}min`;
  if (hours > 0) return `${hours}hr`;
  return `${minutes}min`;
}

const SummaryPage = () => {
  const { user } = useContext(UserContext);
  const [stats, setStats] = useState(null);
  const [curveData, setCurveData] = useState({ curve: [], points: [] });
  const [streaks, setStreaks] = useState({});
  const [entries, setEntries] = useState([]);
  const [dailyPnl, setDailyPnl] = useState({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const fetchEntries = async () => {
      setLoading(true);
      const entriesCol = collection(db, 'journalEntries', user, 'entries');
      const snap = await getDocs(entriesCol);
      const data = snap.docs.map(doc => doc.data());
      setEntries(data);
      setStats(getStats(data));
      setCurveData(getEquityCurve(data));
      setStreaks(getStreaks(data));
      setDailyPnl(getDailyPnl(data));
      setLoading(false);
    };
    fetchEntries();
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
  let currentBalance = "0.00";
  if (entries.length > 0) {
    const sorted = [...entries].sort((a, b) => new Date(a.created) - new Date(b.created));
    let bal = (sorted.length && !isNaN(Number(sorted[0].accountBalance)) && Number(sorted[0].accountBalance) !== 0) ? Number(sorted[0].accountBalance) : 0;
    sorted.forEach(e => {
      bal += Number(e.pnl) || 0;
    });
    currentBalance = bal.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  // Find the most recent day, week, and month
  const mostRecentDay = dailyRows.length > 0 ? dailyRows[0] : null;
  const mostRecentWeek = weeklyRows.length > 0 ? weeklyRows[0] : null;
  const mostRecentMonth = monthlyRows.length > 0 ? monthlyRows[0] : null;

  // Only consider trades with valid PnL for best/worst/recent
  const tradeEntries = entries.filter(e => typeof e.pnl === 'number' && !isNaN(e.pnl));
  const sortedTrades = [...tradeEntries].sort((a, b) => new Date(b.created) - new Date(a.created));
  const bestTrade = tradeEntries.length ? tradeEntries.reduce((a, b) => (a.pnl > b.pnl ? a : b)) : null;
  const worstTrade = tradeEntries.length ? tradeEntries.reduce((a, b) => (a.pnl < b.pnl ? a : b)) : null;
  const recentTrades = sortedTrades.slice(0, 5);
  // Average holding time (duration)
  const avgDurationMins = tradeEntries.length ? tradeEntries.reduce((sum, e) => sum + (parseFloat(e.duration) || 0), 0) / tradeEntries.length : 0;
  // Best day of week
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const pnlByDay = {};
  const countByDay = {};
  tradeEntries.forEach(e => {
    const d = new Date(e.created);
    const day = d.getDay();
    pnlByDay[day] = (pnlByDay[day] || 0) + (Number(e.pnl) || 0);
    countByDay[day] = (countByDay[day] || 0) + 1;
  });
  const avgByDay = Object.keys(pnlByDay).map(day => ({
    day: Number(day),
    avg: countByDay[day] ? pnlByDay[day] / countByDay[day] : 0
  }));
  const bestDay = avgByDay.length ? avgByDay.reduce((a, b) => (a.avg > b.avg ? a : b)) : null;
  // Best month
  const pnlByMonth = {};
  const countByMonth = {};
  tradeEntries.forEach(e => {
    const d = new Date(e.created);
    const month = d.getMonth();
    pnlByMonth[month] = (pnlByMonth[month] || 0) + (Number(e.pnl) || 0);
    countByMonth[month] = (countByMonth[month] || 0) + 1;
  });
  const avgByMonth = Object.keys(pnlByMonth).map(month => ({
    month: Number(month),
    avg: countByMonth[month] ? pnlByMonth[month] / countByMonth[month] : 0
  }));
  const bestMonth = avgByMonth.length ? avgByMonth.reduce((a, b) => (a.avg > b.avg ? a : b)) : null;
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  // Monthly/Weekly P&L trend data
  const monthlyTrend = monthNames.map((name, idx) => ({
    name,
    value: stats && stats.byMonth ? stats.byMonth[`${new Date().getFullYear()}-${idx + 1}`] || 0 : 0
  }));
  const weeklyTrend = stats && stats.byWeek ? Object.entries(stats.byWeek).map(([week, value]) => ({ week, value })) : [];

  const handleReset = async () => {
    if (!window.confirm('Are you sure you want to reset your account? This will delete ALL your journal entries and cannot be undone.')) return;
    if (!user) return;
    const entriesCol = collection(db, 'journalEntries', user, 'entries');
    const snap = await getDocs(entriesCol);
    await Promise.all(snap.docs.map(docSnap => deleteDoc(doc(db, 'journalEntries', user, 'entries', docSnap.id))));
    window.location.reload();
  };

  return (
    <div className="w-full min-h-screen bg-black pt-20 px-8">
      <div className="flex justify-between items-center mb-2">
        <button onClick={handleReset} className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded text-sm font-bold shadow ml-4">Reset Account</button>
      </div>
      {loading ? (
        <div className="flex justify-center items-center py-24 w-full">
          <div className="w-full max-w-2xl flex flex-col gap-6">
            {/* Skeleton for equity curve */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl h-80 w-full animate-pulse mb-4 shadow-2xl" />
            <div className="flex flex-row gap-6 w-full">
              <div className="bg-white/10 backdrop-blur-md rounded-xl h-24 flex-1 animate-pulse shadow-2xl" />
              <div className="bg-white/10 backdrop-blur-md rounded-xl h-24 flex-1 animate-pulse shadow-2xl" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8">
              {[...Array(4)].map((_,i) => <div key={i} className="bg-white/10 backdrop-blur-md rounded-xl h-24 animate-pulse shadow-2xl" />)}
            </div>
          </div>
        </div>
      ) : !stats ? (
        <div className="text-neutral-500">No data yet.</div>
      ) : (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{}}
          className="w-full flex flex-col gap-12"
        >
          {/* --- TOP SECTION: Equity Curve + Account Balance + Day PNL --- */}
          <div className="flex flex-col lg:flex-row gap-8 w-full">
            {/* Equity Curve (Left, 2/3) */}
            <motion.div custom={0} variants={sectionVariants} whileHover={{ scale: 1.01, boxShadow: '0 4px 32px #38bdf8aa' }} whileTap={{ scale: 0.98 }} className="bg-white/10 backdrop-blur-md rounded-2xl p-8 flex-1 min-w-0 flex flex-col gap-2 border border-white/10 shadow-2xl text-[#e5e5e5] justify-center items-center transition-all duration-200">
              <div className="flex items-center gap-3 mb-2 self-start text-2xl font-bold text-[#e5e5e5]">
                <ChartBarIcon className="w-7 h-7 text-blue-400" />
                Equity Curve
              </div>
              {curve.length > 1 && (
                <svg width={width} height={height} className="w-full max-w-2xl">
                  <defs>
                    <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.1" />
                    </linearGradient>
                  </defs>
                  <polyline
                    fill="none"
                    stroke="url(#curveGradient)"
                    strokeWidth="6"
                    points={curve.map((y, i) => `${(i / (curve.length - 1)) * width},${height - ((y - minY) / (maxY - minY || 1)) * (height - 40) - 20}`).join(" ")}
                  />
                  {/* Dot at the last point */}
                  {curve.length > 1 && (
                    <circle
                      cx={width}
                      cy={height - ((curve[curve.length - 1] - minY) / (maxY - minY || 1)) * (height - 40) - 20}
                      r="8"
                      fill="#38bdf8"
                      stroke="#fff"
                      strokeWidth="2"
                    />
                  )}
                  {/* Y-axis labels */}
                  <text x="10" y="30" fill="#fff" fontSize="16">{maxY.toFixed(2)}</text>
                  <text x="10" y={height - 10} fill="#fff" fontSize="16">{minY.toFixed(2)}</text>
                </svg>
              )}
            </motion.div>
            {/* Account Balance + Day PNL (Right, 1/3) */}
            <div className="flex flex-col gap-6 flex-1 min-w-[260px] max-w-sm justify-start">
              <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="bg-white/10 backdrop-blur-md rounded-xl p-8 flex flex-col items-center justify-center border border-white/10 shadow-2xl text-[#e5e5e5] w-full">
                <div className="text-lg font-bold mb-2 tracking-wide">Current Account Balance</div>
                <div className="text-4xl font-extrabold text-green-300">{currentBalance}</div>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="bg-white/10 backdrop-blur-md rounded-xl p-8 flex flex-col items-center justify-center border border-white/10 shadow-2xl text-[#e5e5e5] w-full">
                <div className="text-lg font-bold mb-2 tracking-wide">Day P&L</div>
                {mostRecentDay ? (
                  <>
                    <div className="text-2xl font-bold mb-1 {mostRecentDay[1] > 0 ? 'text-green-400' : mostRecentDay[1] < 0 ? 'text-red-400' : 'text-neutral-300'}">{mostRecentDay[1] > 0 ? '+' : ''}{mostRecentDay[1].toFixed(2)}</div>
                    <div className="text-base text-[#e5e5e5]">{mostRecentDay[0]}</div>
                  </>
                ) : <div className="text-neutral-400">No trades today</div>}
              </motion.div>
            </div>
          </div>
          {/* --- REST OF THE STATS --- */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 w-full">
            <motion.div custom={0} variants={sectionVariants} className="bg-white/10 backdrop-blur-md rounded-xl p-8 flex flex-col gap-2 border border-white/10 shadow-2xl text-[#e5e5e5]">
              <div className="text-lg font-bold mb-2">Total P&L</div>
              <AnimatedNumber value={stats.totalPnl} className={stats.totalPnl > 0 ? "text-green-400 text-2xl font-bold" : stats.totalPnl < 0 ? "text-red-400 text-2xl font-bold" : "text-[#e5e5e5] text-2xl font-bold"} />
            </motion.div>
            <motion.div custom={1} variants={sectionVariants} className="bg-white/10 backdrop-blur-md rounded-xl p-8 flex flex-col gap-2 border border-white/10 shadow-2xl text-[#e5e5e5]">
              <div className="text-lg font-bold mb-2">Avg P&L per Trade</div>
              <AnimatedNumber value={stats.avgPnl} className="text-green-200 text-2xl font-bold" />
            </motion.div>
            <motion.div custom={2} variants={sectionVariants} className="bg-white/10 backdrop-blur-md rounded-xl p-8 flex flex-col gap-2 border border-white/10 shadow-2xl text-[#e5e5e5]">
              <div className="text-lg font-bold mb-2">Win Rate</div>
              <AnimatedNumber value={stats.winRate} decimals={1} className="text-yellow-300 text-2xl font-bold" />%
            </motion.div>
            <motion.div custom={3} variants={sectionVariants} className="bg-white/10 backdrop-blur-md rounded-xl p-8 flex flex-col gap-2 border border-white/10 shadow-2xl text-[#e5e5e5]">
              <div className="text-lg font-bold mb-2">Avg R:R</div>
              <AnimatedNumber value={stats.avgRr} decimals={2} className="text-purple-300 text-2xl font-bold" />
            </motion.div>
          </div>
          {/* Streaks */}
          <motion.div custom={4} variants={sectionVariants} className="bg-white/10 backdrop-blur-md rounded-xl p-8 flex flex-col gap-2 border border-white/10 shadow-2xl text-[#e5e5e5] w-full">
            <div className="text-lg font-bold mb-2">Streak Tracker</div>
            <div className="flex flex-wrap gap-6">
              <div><span className="text-green-400 font-semibold">Green Day Streak:</span> {streaks.greenStreak}</div>
              <div><span className="text-green-300 font-semibold">Max Green Streak:</span> {streaks.maxGreen}</div>
              <div><span className="text-red-400 font-semibold">Loss Streak:</span> {streaks.lossStreak}</div>
              <div><span className="text-red-300 font-semibold">Max Loss Streak:</span> {streaks.maxLoss}</div>
            </div>
          </motion.div>
          {/* Modern Daily/Weekly/Monthly P&L Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
            {/* Daily */}
            <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="bg-white/10 backdrop-blur-md rounded-xl p-4 flex flex-col border border-white/10 shadow-2xl">
              <div className="text-xl font-bold mb-2">Daily P&L</div>
              <div className="flex flex-col gap-4">
                {mostRecentDay && (
                  <motion.div
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className="bg-white/10 backdrop-blur-md rounded-xl p-4 flex flex-col border border-white/10 shadow-2xl"
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
            <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="bg-white/10 backdrop-blur-md rounded-xl p-4 flex flex-col border border-white/10 shadow-2xl">
              <div className="text-xl font-bold mb-2">Weekly P&L</div>
              <div className="flex flex-col gap-4">
                {mostRecentWeek && (
                  <motion.div
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className="bg-white/10 backdrop-blur-md rounded-xl p-4 flex flex-col border border-white/10 shadow-2xl"
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
            <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="bg-white/10 backdrop-blur-md rounded-xl p-4 flex flex-col border border-white/10 shadow-2xl">
              <div className="text-xl font-bold mb-2">Monthly P&L</div>
              <div className="flex flex-col gap-4">
                {mostRecentMonth && (
                  <motion.div
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className="bg-white/10 backdrop-blur-md rounded-xl p-4 flex flex-col border border-white/10 shadow-2xl"
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
          {/* Best Trade and Worst Trade Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 w-full">
            {/* Best Trade Card */}
            {bestTrade && (
              <motion.div className="bg-green-900/80 rounded-xl p-6 flex flex-col gap-2 border-none shadow-lg text-green-200">
                <div className="text-lg font-bold mb-1">Best Trade</div>
                <div className="text-2xl font-extrabold">{bestTrade.pnl > 0 ? '+' : ''}{bestTrade.pnl}</div>
                <div className="text-sm">{bestTrade.tickerTraded} &middot; {new Date(bestTrade.created).toLocaleDateString()}</div>
              </motion.div>
            )}
            {/* Worst Trade Card */}
            {worstTrade && (
              <motion.div className="bg-red-900/80 rounded-xl p-6 flex flex-col gap-2 border-none shadow-lg text-red-200">
                <div className="text-lg font-bold mb-1">Worst Trade</div>
                <div className="text-2xl font-extrabold">{worstTrade.pnl > 0 ? '+' : ''}{worstTrade.pnl}</div>
                <div className="text-sm">{worstTrade.tickerTraded} &middot; {new Date(worstTrade.created).toLocaleDateString()}</div>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default SummaryPage; 