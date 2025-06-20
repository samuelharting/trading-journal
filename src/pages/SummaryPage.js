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
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart, defs, linearGradient, stop } from 'recharts';

function getStats(entries) {
  if (!entries.length) return null;
  // Only include entries that are actual trades (not deposits, payouts, or tape reading)
  const tradeEntries = entries.filter(e => 
    !e.isDeposit && 
    !e.isPayout && 
    !e.isTapeReading && 
    e.pnl !== undefined && 
    e.pnl !== null && 
    e.pnl !== "" && 
    Number(e.pnl) !== 0
  );
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
    totalTrades: tradeEntries.length,
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
    let pnl = 0;
    if (e.isDeposit) {
      // For deposits, use the account balance field directly
      pnl = (Number(e.accountBalance) || 0) - last;
    } else {
      // For trades, payouts, and tape reading, use the P&L
      pnl = Number(e.pnl) || 0;
    }
    last = Math.round((last + pnl) * 100) / 100; // round to 2 decimals after each addition
    curve.push(last);
    points.push({ x: i, y: last });
  });
  return { curve, points };
}

function getStreaks(entries) {
  let greenStreak = 0, lossStreak = 0, maxGreen = 0, maxLoss = 0;
  let prevWin = null;
  // Only count actual trades (not deposits, payouts, or tape reading)
  entries.filter(e => !e.isDeposit && !e.isPayout && !e.isTapeReading).forEach(e => {
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
  // Only count actual trades (not deposits, payouts, or tape reading)
  entries.filter(e => !e.isDeposit && !e.isPayout && !e.isTapeReading).forEach(e => {
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

// EquityCurveChart component
function EquityCurveChart({ points }) {
  if (!points || points.length < 2) return <div className="w-full h-80 flex items-center justify-center text-neutral-400">Not enough data for equity curve.</div>;
  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={points} margin={{ top: 24, right: 24, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.7} />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#2226" />
        <XAxis dataKey="x" tick={{ fill: '#e5e5e5', fontSize: 14 }} hide />
        <YAxis tick={{ fill: '#e5e5e5', fontSize: 14 }} width={60} domain={['auto', 'auto']} />
        <Tooltip contentStyle={{ background: '#18181b', border: 'none', color: '#e5e5e5', borderRadius: 8 }} labelFormatter={i => `Trade #${i + 1}`} formatter={(v) => [`$${v.toFixed(2)}`, 'Balance']} />
        <Area type="monotone" dataKey="y" stroke="#38bdf8" fillOpacity={1} fill="url(#equityGradient)" strokeWidth={4} dot={{ r: 3, fill: '#38bdf8', stroke: '#fff', strokeWidth: 1.5 }} isAnimationActive={true} animationDuration={1200} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// Add helper to group entries by week for the current month
function getWeeksOfMonth(year, month) {
  // Returns an array of [startDay, endDay] for each week in the month
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const weeks = [];
  let current = new Date(firstDay);
  while (current <= lastDay) {
    const weekStart = new Date(current);
    const weekEnd = new Date(current);
    weekEnd.setDate(weekEnd.getDate() + (6 - weekEnd.getDay() + 1) % 7);
    if (weekEnd > lastDay) weekEnd.setTime(lastDay.getTime());
    weeks.push([new Date(weekStart), new Date(weekEnd)]);
    current.setDate(current.getDate() + 7 - (current.getDay() + 6) % 7);
  }
  return weeks;
}

function getWeeklyPnlsForMonth(entries, year, month) {
  // Only entries in the given month
  const filtered = entries.filter(e => String(e.year) === String(year) && String(e.month) === String(month));
  const daysInMonth = new Date(year, month, 0).getDate();
  // Build a map day->PnL
  const dayPnls = {};
  filtered.forEach(e => {
    const day = parseInt(e.day, 10);
    if (!isNaN(day)) {
      dayPnls[day] = (dayPnls[day] || 0) + (Number(e.pnl) || 0);
    }
  });
  // Get week ranges
  const weeks = [];
  let weekStart = 1;
  let weekEnd = 7 - (new Date(year, month - 1, 1).getDay() + 6) % 7;
  if (weekEnd < 1) weekEnd = 7;
  while (weekStart <= daysInMonth) {
    if (weekEnd > daysInMonth) weekEnd = daysInMonth;
    let sum = 0;
    for (let d = weekStart; d <= weekEnd; d++) {
      sum += dayPnls[d] || 0;
    }
    weeks.push({ weekStart, weekEnd, pnl: sum });
    weekStart = weekEnd + 1;
    weekEnd = weekStart + 6;
  }
  return weeks;
}

// Trading Score Calculation Functions
function calculateTradingScore(entries) {
  if (!entries.length) return { score: 0, breakdown: {} };
  
  // Filter out deposits, payouts, and tape reading - only include actual trades
  const tradeEntries = entries.filter(e => 
    !e.isDeposit && 
    !e.isPayout && 
    !e.isTapeReading && 
    e.pnl !== undefined && 
    e.pnl !== null && 
    e.pnl !== ""
  );
  
  if (!tradeEntries.length) return { score: 0, breakdown: {} };

  // Win Rate (40 points)
  const wins = tradeEntries.filter(e => Number(e.pnl) > 0).length;
  const totalTrades = tradeEntries.length;
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  
  let winRateScore = 0;
  if (winRate >= 80) winRateScore = 20;
  else if (winRate >= 60) winRateScore = 15;
  else if (winRate >= 40) winRateScore = 10;
  else if (winRate >= 20) winRateScore = 5;
  else winRateScore = 0;

  // Consecutive wins (20 points)
  let maxConsecutiveWins = 0;
  let currentStreak = 0;
  tradeEntries.forEach(e => {
    if (Number(e.pnl) > 0) {
      currentStreak++;
      maxConsecutiveWins = Math.max(maxConsecutiveWins, currentStreak);
    } else {
      currentStreak = 0;
    }
  });
  
  let consecutiveWinsScore = 0;
  if (maxConsecutiveWins >= 5) consecutiveWinsScore = 20;
  else if (maxConsecutiveWins >= 4) consecutiveWinsScore = 15;
  else if (maxConsecutiveWins >= 3) consecutiveWinsScore = 10;
  else if (maxConsecutiveWins >= 2) consecutiveWinsScore = 5;
  else consecutiveWinsScore = 0;

  // Overall P&L (20 points)
  const totalPnl = tradeEntries.reduce((sum, e) => sum + (Number(e.pnl) || 0), 0);
  let overallPnlScore = 0;
  if (totalPnl > 0) overallPnlScore = 20;
  else if (totalPnl === 0) overallPnlScore = 10;
  else overallPnlScore = 0;

  // Profit Consistency (15 points) - per week
  const dailyPnl = {};
  tradeEntries.forEach(e => {
    const d = new Date(e.created);
    const day = d.toLocaleDateString();
    dailyPnl[day] = (dailyPnl[day] || 0) + (Number(e.pnl) || 0);
  });
  
  // Group by week
  const weeklyPnl = {};
  tradeEntries.forEach(e => {
    const d = new Date(e.created);
    const week = `${d.getFullYear()}-W${getWeekNumber(d)}`;
    weeklyPnl[week] = (weeklyPnl[week] || 0) + (Number(e.pnl) || 0);
  });
  
  const redWeeks = Object.values(weeklyPnl).filter(pnl => pnl < 0).length;
  let profitConsistencyScore = 0;
  if (redWeeks === 0) profitConsistencyScore = 15;
  else if (redWeeks <= 2) profitConsistencyScore = 10;
  else if (redWeeks <= 4) profitConsistencyScore = 5;
  else profitConsistencyScore = 0;

  // Tilt Detection (15 points)
  let maxConsecutiveLosses = 0;
  let currentLossStreak = 0;
  tradeEntries.forEach(e => {
    if (Number(e.pnl) < 0) {
      currentLossStreak++;
      maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLossStreak);
    } else {
      currentLossStreak = 0;
    }
  });
  
  let tiltDetectionScore = 0;
  if (maxConsecutiveLosses === 0) tiltDetectionScore = 15;
  else if (maxConsecutiveLosses === 2) tiltDetectionScore = 10;
  else if (maxConsecutiveLosses === 3) tiltDetectionScore = 5;
  else tiltDetectionScore = 0;

  // Trading Frequency (10 points)
  const tradesPerDay = {};
  tradeEntries.forEach(e => {
    const d = new Date(e.created);
    const day = d.toLocaleDateString();
    tradesPerDay[day] = (tradesPerDay[day] || 0) + 1;
  });
  
  const avgTradesPerDay = Object.values(tradesPerDay).reduce((a, b) => a + b, 0) / Object.keys(tradesPerDay).length;
  let tradingFrequencyScore = 0;
  if (avgTradesPerDay >= 1 && avgTradesPerDay <= 3) tradingFrequencyScore = 10;
  else if (avgTradesPerDay >= 4 && avgTradesPerDay <= 5) tradingFrequencyScore = 7;
  else if (avgTradesPerDay >= 6 && avgTradesPerDay <= 7) tradingFrequencyScore = 4;
  else tradingFrequencyScore = 0;

  const totalScore = winRateScore + consecutiveWinsScore + overallPnlScore + profitConsistencyScore + tiltDetectionScore + tradingFrequencyScore;
  
  return {
    score: Math.round(totalScore),
    breakdown: {
      winRate: { score: winRateScore, max: 20, percentage: winRate },
      consecutiveWins: { score: consecutiveWinsScore, max: 20, count: maxConsecutiveWins },
      overallPnl: { score: overallPnlScore, max: 20, value: totalPnl },
      profitConsistency: { score: profitConsistencyScore, max: 15, redWeeks },
      tiltDetection: { score: tiltDetectionScore, max: 15, maxLossStreak: maxConsecutiveLosses },
      tradingFrequency: { score: tradingFrequencyScore, max: 10, avgTradesPerDay }
    }
  };
}

const SummaryPage = () => {
  const { user } = useContext(UserContext);
  const [stats, setStats] = useState(null);
  const [curveData, setCurveData] = useState({ curve: [], points: [] });
  const [streaks, setStreaks] = useState({});
  const [entries, setEntries] = useState([]);
  const [dailyPnl, setDailyPnl] = useState({});
  const [loading, setLoading] = useState(true);
  const [tradingScore, setTradingScore] = useState({ score: 0, breakdown: {} });
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);
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
      setTradingScore(calculateTradingScore(data));
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
    let bal = 0;
    sorted.forEach(e => {
      if (e.isDeposit) {
        // For deposits, use the account balance field directly
        bal = Number(e.accountBalance) || 0;
      } else {
        // For trades, add the P&L to the previous balance
        bal += Number(e.pnl) || 0;
      }
    });
    currentBalance = bal.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  // Find the most recent day, week, and month
  const mostRecentDay = dailyRows.length > 0 ? dailyRows[0] : null;
  const mostRecentWeek = weeklyRows.length > 0 ? weeklyRows[0] : null;
  const mostRecentMonth = monthlyRows.length > 0 ? monthlyRows[0] : null;

  // Only consider actual trades (not deposits, payouts, or tape reading) for best/worst/recent
  const tradeEntries = entries.filter(e => 
    !e.isDeposit && 
    !e.isPayout && 
    !e.isTapeReading && 
    typeof e.pnl === 'number' && 
    !isNaN(e.pnl)
  );
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

  // Get current year/month
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  // Get weekly PnLs for current month
  const weeklyPnls = getWeeklyPnlsForMonth(entries, currentYear, currentMonth);
  // Get monthly PnL for current month
  const monthlyPnl = weeklyPnls.reduce((sum, w) => sum + w.pnl, 0);

  // Find the most recent week and month
  const mostRecentWeekKey = weeklyRows.length > 0 ? weeklyRows[0][0] : null;
  const mostRecentMonthKey = monthlyRows.length > 0 ? monthlyRows[0][0] : null;
  const mostRecentWeekPnl = mostRecentWeekKey ? stats.byWeek[mostRecentWeekKey] : 0;
  const mostRecentMonthPnl = mostRecentMonthKey ? stats.byMonth[mostRecentMonthKey] : 0;

  const handleReset = async () => {
    if (!window.confirm('Are you sure you want to reset your account? This will delete ALL your journal entries and cannot be undone.')) return;
    if (!user) return;
    const entriesCol = collection(db, 'journalEntries', user, 'entries');
    const snap = await getDocs(entriesCol);
    await Promise.all(snap.docs.map(docSnap => deleteDoc(doc(db, 'journalEntries', user, 'entries', docSnap.id))));
    window.location.reload();
  };

  const handleEdit = () => {
    // Navigate to a new edit page or open a modal
    navigate('/edit-account');
  };

  return (
    <div className="w-full min-h-screen bg-black pt-20 px-4 sm:px-8">
      <div className="flex justify-between items-center mb-2">
        <button onClick={handleReset} className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded text-sm font-bold shadow ml-4">Reset Account</button>
        <button onClick={handleEdit} className="bg-blue-700 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold shadow ml-4">Edit Account</button>
      </div>
      
      {/* Trading Score Display */}
      {!loading && stats && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="flex justify-center mb-8"
        >
          <div className="relative">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowScoreBreakdown(!showScoreBreakdown)}
              className="relative cursor-pointer"
            >
              {/* Score Circle */}
              {/* Mobile SVG */}
              <svg width="150" height="150" className="transform -rotate-90 sm:hidden">
                <circle
                  cx="75"
                  cy="75"
                  r="60"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="6"
                  fill="none"
                />
                <circle
                  cx="75"
                  cy="75"
                  r="60"
                  stroke={tradingScore.score <= 40 ? "#ef4444" : tradingScore.score <= 70 ? "#eab308" : "#22c55e"}
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray={`${(tradingScore.score / 100) * 376.8} 376.8`}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              
              {/* Desktop SVG */}
              <svg width="200" height="200" className="transform -rotate-90 hidden sm:block">
                <circle
                  cx="100"
                  cy="100"
                  r="80"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="80"
                  stroke={tradingScore.score <= 40 ? "#ef4444" : tradingScore.score <= 70 ? "#eab308" : "#22c55e"}
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${(tradingScore.score / 100) * 502.4} 502.4`}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              
              {/* Score Text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-3xl sm:text-4xl font-bold text-[#e5e5e5]">{tradingScore.score}</div>
                <div className="text-xs sm:text-sm text-neutral-400">Score</div>
              </div>
            </motion.div>
            
            {/* Score Label */}
            <div className="text-center mt-4">
              <div className={`text-base sm:text-lg font-bold ${
                tradingScore.score <= 40 ? "text-red-400" : 
                tradingScore.score <= 70 ? "text-yellow-400" : 
                "text-green-400"
              }`}>
                {tradingScore.score <= 40 ? "Needs Improvement" : 
                 tradingScore.score <= 70 ? "Good" : 
                 "Excellent"}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Score Breakdown Modal */}
      <AnimatePresence>
        {showScoreBreakdown && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
            onClick={() => setShowScoreBreakdown(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-neutral-900 rounded-2xl p-4 sm:p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-xl sm:text-2xl font-bold text-[#e5e5e5] mb-6 text-center">Trading Score Breakdown</div>
              
              <div className="space-y-4">
                <div className="bg-neutral-800 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[#e5e5e5] font-semibold text-sm sm:text-base">Win Rate (20 pts)</span>
                    <span className="text-green-400 font-bold text-sm sm:text-base">{tradingScore.breakdown.winRate?.score || 0}/20</span>
                  </div>
                  <div className="text-xs sm:text-sm text-neutral-400">
                    {tradingScore.breakdown.winRate?.percentage?.toFixed(1) || 0}% win rate
                  </div>
                </div>
                
                <div className="bg-neutral-800 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[#e5e5e5] font-semibold text-sm sm:text-base">Consecutive Wins (20 pts)</span>
                    <span className="text-green-400 font-bold text-sm sm:text-base">{tradingScore.breakdown.consecutiveWins?.score || 0}/20</span>
                  </div>
                  <div className="text-xs sm:text-sm text-neutral-400">
                    Max consecutive wins: {tradingScore.breakdown.consecutiveWins?.count || 0}
                  </div>
                </div>
                
                <div className="bg-neutral-800 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[#e5e5e5] font-semibold text-sm sm:text-base">Overall P&L (20 pts)</span>
                    <span className="text-green-400 font-bold text-sm sm:text-base">{tradingScore.breakdown.overallPnl?.score || 0}/20</span>
                  </div>
                  <div className="text-xs sm:text-sm text-neutral-400">
                    Total P&L: ${tradingScore.breakdown.overallPnl?.value?.toFixed(2) || 0}
                  </div>
                </div>
                
                <div className="bg-neutral-800 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[#e5e5e5] font-semibold text-sm sm:text-base">Profit Consistency (15 pts)</span>
                    <span className="text-green-400 font-bold text-sm sm:text-base">{tradingScore.breakdown.profitConsistency?.score || 0}/15</span>
                  </div>
                  <div className="text-xs sm:text-sm text-neutral-400">
                    Red weeks: {tradingScore.breakdown.profitConsistency?.redWeeks || 0}
                  </div>
                </div>
                
                <div className="bg-neutral-800 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[#e5e5e5] font-semibold text-sm sm:text-base">Tilt Detection (15 pts)</span>
                    <span className="text-green-400 font-bold text-sm sm:text-base">{tradingScore.breakdown.tiltDetection?.score || 0}/15</span>
                  </div>
                  <div className="text-xs sm:text-sm text-neutral-400">
                    Max consecutive losses: {tradingScore.breakdown.tiltDetection?.maxLossStreak || 0}
                  </div>
                </div>
                
                <div className="bg-neutral-800 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[#e5e5e5] font-semibold text-sm sm:text-base">Trading Frequency (10 pts)</span>
                    <span className="text-green-400 font-bold text-sm sm:text-base">{tradingScore.breakdown.tradingFrequency?.score || 0}/10</span>
                  </div>
                  <div className="text-xs sm:text-sm text-neutral-400">
                    Avg trades per day: {tradingScore.breakdown.tradingFrequency?.avgTradesPerDay?.toFixed(1) || 0}
                  </div>
                </div>
              </div>
              
              <div className="text-center mt-6">
                <button
                  onClick={() => setShowScoreBreakdown(false)}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-semibold"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center items-center py-24 w-full">
          <div className="w-full max-w-2xl flex flex-col gap-6">
            {/* Skeleton for equity curve */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl h-80 w-full animate-pulse mb-4 shadow-2xl" />
            <div className="flex flex-col sm:flex-row gap-6 w-full">
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
          className="w-full flex flex-col gap-8 sm:gap-12"
        >
          {/* --- TOP SECTION: Equity Curve + Account Balance + Day PNL --- */}
          <div className="flex flex-col lg:flex-row gap-6 sm:gap-8 w-full">
            {/* Equity Curve (Left, 2/3) */}
            <motion.div custom={0} variants={sectionVariants} whileHover={{ scale: 1.01, boxShadow: '0 4px 32px #38bdf8aa' }} whileTap={{ scale: 0.98 }} className="bg-white/10 backdrop-blur-md rounded-2xl p-4 sm:p-8 flex-1 min-w-0 flex flex-col gap-2 border border-white/10 shadow-2xl text-[#e5e5e5] justify-center items-center transition-all duration-200">
              <div className="flex items-center gap-3 mb-2 self-start text-xl sm:text-2xl font-bold text-[#e5e5e5]">
                <ChartBarIcon className="w-6 h-6 sm:w-7 sm:h-7 text-blue-400" />
                Equity Curve
              </div>
              <div className="w-full max-w-2xl h-60 sm:h-80 flex items-center justify-center">
                <EquityCurveChart points={points} />
              </div>
            </motion.div>
            {/* Account Balance + Day PNL (Right, 1/3) */}
            <div className="flex flex-col gap-4 sm:gap-6 flex-1 min-w-[260px] max-w-sm justify-start">
              <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="bg-white/10 backdrop-blur-md rounded-xl p-4 sm:p-8 flex flex-col items-center justify-center border border-white/10 shadow-2xl text-[#e5e5e5] w-full">
                <div className="text-base sm:text-lg font-bold mb-2 tracking-wide">Current Account Balance</div>
                <div className="text-3xl sm:text-4xl font-extrabold text-green-300">{currentBalance}</div>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="bg-white/10 backdrop-blur-md rounded-xl p-4 sm:p-8 flex flex-col items-center justify-center border border-white/10 shadow-2xl text-[#e5e5e5] w-full">
                <div className="text-base sm:text-lg font-bold mb-2 tracking-wide">Day P&L</div>
                {mostRecentDay ? (
                  <>
                    <div className="text-xl sm:text-2xl font-bold mb-1 {mostRecentDay[1] > 0 ? 'text-green-400' : mostRecentDay[1] < 0 ? 'text-red-400' : 'text-neutral-300'}">{mostRecentDay[1] > 0 ? '+' : ''}{mostRecentDay[1].toFixed(2)}</div>
                    <div className="text-sm sm:text-base text-[#e5e5e5]">{mostRecentDay[0]}</div>
                  </>
                ) : <div className="text-neutral-400">No trades today</div>}
              </motion.div>
            </div>
          </div>
          {/* --- REST OF THE STATS --- */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 sm:gap-8 w-full">
            <motion.div custom={0} variants={sectionVariants} className="bg-white/10 backdrop-blur-md rounded-xl p-4 sm:p-8 flex flex-col gap-2 border border-white/10 shadow-2xl text-[#e5e5e5]">
              <div className="text-base sm:text-lg font-bold mb-2">Total P&L</div>
              <AnimatedNumber value={stats.totalPnl} className={stats.totalPnl > 0 ? "text-green-400 text-xl sm:text-2xl font-bold" : stats.totalPnl < 0 ? "text-red-400 text-xl sm:text-2xl font-bold" : "text-[#e5e5e5] text-xl sm:text-2xl font-bold"} />
            </motion.div>
            <motion.div custom={1} variants={sectionVariants} className="bg-white/10 backdrop-blur-md rounded-xl p-4 sm:p-8 flex flex-col gap-2 border border-white/10 shadow-2xl text-[#e5e5e5]">
              <div className="text-base sm:text-lg font-bold mb-2">Win Rate</div>
              <AnimatedNumber value={stats.winRate} decimals={1} className="text-yellow-300 text-xl sm:text-2xl font-bold" />%
            </motion.div>
            <motion.div custom={2} variants={sectionVariants} className="bg-white/10 backdrop-blur-md rounded-xl p-4 sm:p-8 flex flex-col gap-2 border border-white/10 shadow-2xl text-[#e5e5e5]">
              <div className="text-base sm:text-lg font-bold mb-2">Avg P&L per Trade</div>
              <AnimatedNumber value={stats.avgPnl} className="text-green-200 text-xl sm:text-2xl font-bold" />
            </motion.div>
            <motion.div custom={3} variants={sectionVariants} className="bg-white/10 backdrop-blur-md rounded-xl p-4 sm:p-8 flex flex-col gap-2 border border-white/10 shadow-2xl text-[#e5e5e5]">
              <div className="text-base sm:text-lg font-bold mb-2">Avg R:R</div>
              <AnimatedNumber value={stats.avgRr} decimals={2} className="text-purple-300 text-xl sm:text-2xl font-bold" />
            </motion.div>
            <motion.div custom={4} variants={sectionVariants} className="bg-white/10 backdrop-blur-md rounded-xl p-4 sm:p-8 flex flex-col gap-2 border border-white/10 shadow-2xl text-[#e5e5e5]">
              <div className="text-base sm:text-lg font-bold mb-2">Total Trades</div>
              <div className="text-blue-300 text-xl sm:text-2xl font-bold">{stats.totalTrades}</div>
            </motion.div>
          </div>
          {/* Streaks */}
          <motion.div custom={5} variants={sectionVariants} className="bg-white/10 backdrop-blur-md rounded-xl p-4 sm:p-8 flex flex-col gap-2 border border-white/10 shadow-2xl text-[#e5e5e5] w-full">
            <div className="text-base sm:text-lg font-bold mb-2">Streak Tracker</div>
            <div className="flex flex-wrap gap-4 sm:gap-6 text-sm sm:text-base">
              <div><span className="text-green-400 font-semibold">Green Day Streak:</span> {streaks.greenStreak}</div>
              <div><span className="text-green-300 font-semibold">Max Green Streak:</span> {streaks.maxGreen}</div>
              <div><span className="text-red-400 font-semibold">Loss Streak:</span> {streaks.lossStreak}</div>
              <div><span className="text-red-300 font-semibold">Max Loss Streak:</span> {streaks.maxLoss}</div>
            </div>
          </motion.div>
          {/* Modern Daily/Weekly/Monthly P&L Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8 w-full">
            {/* Daily */}
            <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="bg-white/10 backdrop-blur-md rounded-xl p-4 flex flex-col border border-white/10 shadow-2xl">
              <div className="text-lg sm:text-xl font-bold mb-2">Daily P&L</div>
              <div className="flex flex-col gap-4">
                {mostRecentDay && (
                  <motion.div
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className="bg-white/10 backdrop-blur-md rounded-xl p-4 flex flex-col border border-white/10 shadow-2xl"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-[#e5e5e5] text-sm sm:text-base">{mostRecentDay[0]}</span>
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
              <div className="text-lg sm:text-xl font-bold mb-2">Weekly P&L</div>
              <div className="flex flex-col gap-4">
                {weeklyPnls.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className="bg-white/10 backdrop-blur-md rounded-xl p-4 flex flex-col border border-white/10 shadow-2xl"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-[#e5e5e5] text-sm sm:text-base">Week {weeklyPnls.length}</span>
                      <span className={weeklyPnls[weeklyPnls.length-1].pnl > 0 ? "text-green-400 font-bold" : weeklyPnls[weeklyPnls.length-1].pnl < 0 ? "text-red-400 font-bold" : "text-neutral-300 font-bold"}>{weeklyPnls[weeklyPnls.length-1].pnl > 0 ? "+" : ""}{weeklyPnls[weeklyPnls.length-1].pnl.toFixed(2)}</span>
                    </div>
                    <div className="w-full h-2 rounded bg-neutral-800 overflow-hidden">
                      <div className={weeklyPnls[weeklyPnls.length-1].pnl > 0 ? "bg-green-500" : weeklyPnls[weeklyPnls.length-1].pnl < 0 ? "bg-red-500" : "bg-neutral-500"} style={{ width: `${Math.min(Math.abs(weeklyPnls[weeklyPnls.length-1].pnl) * 2, 100)}%`, height: '100%' }} />
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
            {/* Monthly */}
            <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="bg-white/10 backdrop-blur-md rounded-xl p-4 flex flex-col border border-white/10 shadow-2xl">
              <div className="text-lg sm:text-xl font-bold mb-2">Monthly P&L</div>
              <div className="flex flex-col gap-4">
                <motion.div
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                  className="bg-white/10 backdrop-blur-md rounded-xl p-4 flex flex-col border border-white/10 shadow-2xl"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-[#e5e5e5] text-sm sm:text-base">{now.toLocaleString('default', { month: 'long' })} {currentYear}</span>
                    <span className={monthlyPnl > 0 ? "text-green-400 font-bold" : monthlyPnl < 0 ? "text-red-400 font-bold" : "text-neutral-300 font-bold"}>{monthlyPnl > 0 ? "+" : ""}{monthlyPnl.toFixed(2)}</span>
                  </div>
                  <div className="w-full h-2 rounded bg-neutral-800 overflow-hidden">
                    <div className={monthlyPnl > 0 ? "bg-green-500" : monthlyPnl < 0 ? "bg-red-500" : "bg-neutral-500"} style={{ width: `${Math.min(Math.abs(monthlyPnl) * 2, 100)}%`, height: '100%' }} />
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
          {/* Best Trade and Worst Trade Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8 w-full">
            {/* Best Trade Card */}
            {bestTrade && (
              <motion.div className="bg-green-900/80 rounded-xl p-4 sm:p-6 flex flex-col gap-2 border-none shadow-lg text-green-200">
                <div className="text-base sm:text-lg font-bold mb-1">Best Trade</div>
                <div className="text-xl sm:text-2xl font-extrabold">{bestTrade.pnl > 0 ? '+' : ''}{bestTrade.pnl}</div>
                <div className="text-xs sm:text-sm">{bestTrade.tickerTraded} &middot; {new Date(bestTrade.created).toLocaleDateString()}</div>
              </motion.div>
            )}
            {/* Worst Trade Card */}
            {worstTrade && (
              <motion.div className="bg-red-900/80 rounded-xl p-4 sm:p-6 flex flex-col gap-2 border-none shadow-lg text-red-200">
                <div className="text-base sm:text-lg font-bold mb-1">Worst Trade</div>
                <div className="text-xl sm:text-2xl font-extrabold">{worstTrade.pnl > 0 ? '+' : ''}{worstTrade.pnl}</div>
                <div className="text-xs sm:text-sm">{worstTrade.tickerTraded} &middot; {new Date(worstTrade.created).toLocaleDateString()}</div>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default SummaryPage; 