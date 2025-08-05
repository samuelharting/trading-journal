import React, { useEffect, useState, useContext } from "react";
import { motion } from "framer-motion";
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
import StatCard from '../components/StatCard';
import CircleCard from '../components/CircleCard';
import Gauge from '../components/Gauge';
import { useNavigate } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart, defs, linearGradient, stop } from 'recharts';

function sumPrecise(arr) {
  // Sums an array of numbers/strings as cents, returns float
  return arr.reduce((sum, v) => sum + Math.round(Number(v) * 100), 0) / 100;
}

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
  const totalPnl = sumPrecise(tradeEntries.map(e => e.pnl));
  const avgPnl = tradeEntries.length ? totalPnl / tradeEntries.length : 0;
  const avgDuration = tradeEntries.length ? tradeEntries.reduce((sum, e) => sum + (parseFloat(e.duration) || 0), 0) / tradeEntries.length : 0;
  const wins = tradeEntries.filter(e => Number(e.pnl) > 0).length;
  const losses = tradeEntries.filter(e => Number(e.pnl) < 0).length;
  const winRate = tradeEntries.length ? (wins / tradeEntries.length) * 100 : 0;
  const avgRr = tradeEntries.length ? sumPrecise(tradeEntries.map(e => e.rr)) / tradeEntries.length : 0;
  
  // Calculate average winning and losing trades
  const winningTrades = tradeEntries.filter(e => Number(e.pnl) > 0);
  const losingTrades = tradeEntries.filter(e => Number(e.pnl) < 0);
  const avgWinningTrade = winningTrades.length ? sumPrecise(winningTrades.map(e => e.pnl)) / winningTrades.length : 0;
  const avgLosingTrade = losingTrades.length ? sumPrecise(losingTrades.map(e => e.pnl)) / losingTrades.length : 0;
  
  // Group by week/month for averages (ONLY TRADES, not deposits/payouts)
  const byWeek = {};
  const byMonth = {};
  tradeEntries.forEach(e => {
    // Use year/month/day fields like the rest of the app
    let d;
    if (e.year && e.month && e.day) {
      const year = parseInt(e.year, 10);
      const month = parseInt(e.month, 10) - 1; // Convert to 0-indexed
      const day = parseInt(e.day, 10);
      d = new Date(year, month, day);
    } else {
      // Fallback to created timestamp
      d = new Date(e.created);
    }
    const week = `${d.getFullYear()}-W${getWeekNumber(d)}`;
    const month = `${d.getFullYear()}-${d.getMonth() + 1}`;
    const pnlValue = Number(e.pnl) || 0;
    byWeek[week] = Math.round(((byWeek[week] || 0) + pnlValue) * 100) / 100;
    byMonth[month] = Math.round(((byMonth[month] || 0) + pnlValue) * 100) / 100;
  });
  const avgWeekly = Object.keys(byWeek).length ? Object.values(byWeek).reduce((a, b) => a + b, 0) / Object.keys(byWeek).length : 0;
  const avgMonthly = Object.keys(byMonth).length ? Object.values(byMonth).reduce((a, b) => a + b, 0) / Object.keys(byMonth).length : 0;
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
    avgWinningTrade,
    avgLosingTrade,
    byMonth,
    byWeek,
  };
}

function getEquityCurve(entries) {
  // Helper function to get entry date using year/month/day fields (consistent with other functions)
  const getEntryDate = (entry) => {
    if (entry.year && entry.month && entry.day) {
      // Use the year/month/day fields that are stored as strings
      const year = parseInt(entry.year, 10);
      const month = parseInt(entry.month, 10) - 1; // Convert to 0-indexed
      const day = parseInt(entry.day, 10);
      return new Date(year, month, day);
    }
    // Fallback to created timestamp
    if (entry.created) {
      const timestamp = entry.created.split('-')[0]; // Remove random suffix
      return new Date(timestamp);
    }
    return new Date();
  };

  // Sort entries by date using year/month/day fields
  const sorted = [...entries].sort((a, b) => getEntryDate(a) - getEntryDate(b));
  
  let curve = [];
  let balance = 0; // Start from 0 balance
  let points = [];
  
  // Add initial point at 0
  curve.push(balance);
  points.push({ x: 0, y: balance, date: 'Start' });
  
  sorted.forEach((e, i) => {
    let pnl = 0;
    let affectsBalance = true;
    
    if (e.isDeposit) {
      // For deposits, use the stored accountBalance directly (don't double-count)
      if (e.accountBalance && !isNaN(Number(e.accountBalance))) {
        balance = Number(e.accountBalance);
        affectsBalance = false; // Already set balance directly
      } else {
        // Fallback: use deposit amount
        pnl = Number(e.pnl) || 0;
      }
    } else if (e.isPayout) {
      // For payouts, use the payout amount (already negative) - affects balance only
      pnl = Number(e.pnl) || 0;
    } else if (!e.isTapeReading) {
      // For trades, use the P&L - affects both balance and equity curve
      pnl = Number(e.pnl) || 0;
    } else {
      // Tape reading entries don't affect balance or equity curve
      affectsBalance = false;
    }
    
    // Update balance for all entries that affect it
    if (affectsBalance) {
      balance = Math.round((balance + pnl) * 100) / 100;
    }
    
    // Only add points to equity curve for trades (not deposits, payouts, or tape reading)
    if (!e.isDeposit && !e.isPayout && !e.isTapeReading) {
      curve.push(balance);
      
      // Create a meaningful label for the point
      const entryDate = getEntryDate(e);
      const dateLabel = entryDate.toLocaleDateString();
      
      points.push({ 
        x: points.length, 
        y: balance, 
        date: dateLabel,
        type: 'Trade',
        pnl: pnl,
        ticker: e.tickerTraded || ''
      });
    }
  });
  
  return { curve, points };
}

function getStreaks(entries) {
  // Helper function to get entry date using year/month/day fields (consistent with other functions)
  const getEntryDate = (entry) => {
    if (entry.year && entry.month && entry.day) {
      // Use the year/month/day fields that are stored as strings
      const year = parseInt(entry.year, 10);
      const month = parseInt(entry.month, 10) - 1; // Convert to 0-indexed
      const day = parseInt(entry.day, 10);
      return new Date(year, month, day);
    }
    // Fallback to created timestamp
    if (entry.created) {
      const timestamp = entry.created.split('-')[0]; // Remove random suffix
      return new Date(timestamp);
    }
    return new Date();
  };

  // Filter and sort trades by date to ensure chronological order
  const tradingEntries = entries
    .filter(e => !e.isDeposit && !e.isPayout && !e.isTapeReading && e.pnl !== undefined && e.pnl !== null && e.pnl !== "")
    .sort((a, b) => getEntryDate(a) - getEntryDate(b));

  let greenStreak = 0, lossStreak = 0, maxGreen = 0, maxLoss = 0;
  let prevWin = null;
  
  tradingEntries.forEach(e => {
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
  entries.filter(e => 
    !e.isDeposit && 
    !e.isPayout && 
    !e.isTapeReading &&
    e.pnl !== undefined &&
    e.pnl !== null &&
    e.pnl !== ""
  ).forEach(e => {
    // Use year/month/day fields like the rest of the app
    if (e.year && e.month && e.day) {
      const year = parseInt(e.year, 10);
      const month = parseInt(e.month, 10) - 1; // Convert to 0-indexed
      const day = parseInt(e.day, 10);
      const date = new Date(year, month, day);
      const dayKey = date.toLocaleDateString();
      byDay[dayKey] = (byDay[dayKey] || 0) + (Number(e.pnl) || 0);
    } else {
      // Fallback to created timestamp
      const d = new Date(e.created);
      const day = d.toLocaleDateString();
      byDay[day] = (byDay[day] || 0) + (Number(e.pnl) || 0);
    }
  });
  return byDay;
}

function getWeekNumber(d) {
  // ISO week calculation - more reliable
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  // Thursday in current week decides the year
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  // January 4 is always in week 1
  const week1 = new Date(date.getFullYear(), 0, 4);
  // Adjust to Thursday in week 1 and count number of weeks from date to week1
  week1.setHours(0, 0, 0, 0);
  week1.setDate(week1.getDate() + 3 - (week1.getDay() + 6) % 7);
  const weekNo = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
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
  
  // Calculate Y-axis domain for better scaling
  const values = points.map(p => p.y);
  const minY = Math.min(...values);
  const maxY = Math.max(...values);
  const range = maxY - minY;
  
  // Add padding to Y-axis domain for better visualization
  const padding = range * 0.1; // 10% padding
  const yDomain = [
    Math.max(0, minY - padding), // Don't go below 0 for equity curves
    maxY + padding
  ];
  
  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={points} margin={{ top: 24, right: 24, left: 60, bottom: 0 }}>
        <defs>
          <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10B981" stopOpacity={0.8} />
            <stop offset="50%" stopColor="#3B82F6" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.1} />
          </linearGradient>
          <linearGradient id="equityStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="50%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
        <XAxis 
          dataKey="x" 
          tick={{ fill: '#e5e5e5', fontSize: 12, fontWeight: 500 }} 
          hide 
        />
        <YAxis 
          tick={{ fill: '#e5e5e5', fontSize: 12, fontWeight: 500 }} 
          width={60} 
          domain={yDomain}
          tickFormatter={(value) => `$${value.toFixed(0)}`}
        />
        <Tooltip 
          contentStyle={{ 
            background: 'rgba(31, 41, 55, 0.95)', 
            border: '1px solid rgba(255, 255, 255, 0.1)', 
            color: '#e5e5e5', 
            borderRadius: 12,
            backdropFilter: 'blur(10px)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }} 
          labelFormatter={(value, payload) => {
            if (payload && payload[0] && payload[0].payload) {
              const point = payload[0].payload;
              return `${point.type} - ${point.date}`;
            }
            return `Entry #${value}`;
          }}
          formatter={(value, name, props) => {
            const point = props.payload;
            return [
              `$${value.toFixed(2)}`, 
              'Balance',
              point.pnl !== undefined ? `P&L: ${point.pnl > 0 ? '+' : ''}$${point.pnl.toFixed(2)}` : '',
              point.ticker ? `Ticker: ${point.ticker}` : ''
            ].filter(Boolean);
          }}
        />
        <Area 
          type="monotone" 
          dataKey="y" 
          stroke="url(#equityStroke)" 
          fillOpacity={1} 
          fill="url(#equityGradient)" 
          strokeWidth={3} 
          dot={{ r: 4, fill: '#3B82F6', stroke: '#fff', strokeWidth: 2 }} 
          isAnimationActive={true} 
          animationDuration={400}
          animationEasing="ease-out"
        />
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
  // Only entries in the given month that are actual trades (not deposits, payouts, or tape reading)
  const filtered = entries.filter(e => 
    String(e.year) === String(year) && 
    String(e.month) === String(month) &&
    !e.isDeposit && 
    !e.isPayout && 
    !e.isTapeReading &&
    e.pnl !== undefined &&
    e.pnl !== null &&
    e.pnl !== ""
  );
  const daysInMonth = new Date(year, month, 0).getDate();
  // Build a map day->PnL
  const dayPnls = {};
  filtered.forEach(e => {
    const day = parseInt(e.day, 10);
    if (!isNaN(day)) {
      const pnlValue = Number(e.pnl) || 0;
      dayPnls[day] = Math.round(((dayPnls[day] || 0) + pnlValue) * 100) / 100;
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

function getPercentageChanges(entries, currentBalance) {
  if (!entries.length) return null;
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // Month is 1-indexed in entries
  const currentDay = now.getDate();
  
  // Filter for actual trades only (not deposits, payouts, or tape reading)
  const tradingEntries = entries.filter(e => 
    !e.isDeposit && 
    !e.isPayout && 
    !e.isTapeReading &&
    e.pnl !== undefined &&
    e.pnl !== null &&
    e.pnl !== "" &&
    Number(e.pnl) !== 0
  );
  
  // Helper function to get entry date using year/month/day fields (like CalendarPage does)
  const getEntryDate = (entry) => {
    if (entry.year && entry.month && entry.day) {
      // Use the year/month/day fields that are stored as strings
      const year = parseInt(entry.year, 10);
      const month = parseInt(entry.month, 10) - 1; // Convert to 0-indexed
      const day = parseInt(entry.day, 10);
      return new Date(year, month, day);
    }
    // Fallback to created timestamp
    if (entry.created) {
      const timestamp = entry.created.split('-')[0]; // Remove random suffix
      return new Date(timestamp);
    }
    return new Date();
  };
  
  // Helper function to check if entry is in a specific period
  const isEntryInPeriod = (entry, startDate, endDate) => {
    const entryDate = getEntryDate(entry);
    return entryDate >= startDate && entryDate <= endDate;
  };
  
  // Day calculations - use year/month/day fields like CalendarPage
  const dayEntries = tradingEntries.filter(e => 
    String(e.year) === String(currentYear) && 
    String(e.month) === String(currentMonth) && 
    String(e.day) === String(currentDay)
  );
  const dayPnl = sumPrecise(dayEntries.map(e => Number(e.pnl)));
  
  // Week calculations
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  
  const weekEntries = tradingEntries.filter(e => isEntryInPeriod(e, weekStart, weekEnd));
  const weekPnl = sumPrecise(weekEntries.map(e => Number(e.pnl)));
  
  // Month calculations - use year/month fields like CalendarPage
  const monthEntries = tradingEntries.filter(e => 
    String(e.year) === String(currentYear) && 
    String(e.month) === String(currentMonth)
  );
  const monthPnl = sumPrecise(monthEntries.map(e => Number(e.pnl)));
  
  // YTD calculations - use year field like CalendarPage
  const yearEntries = tradingEntries.filter(e => String(e.year) === String(currentYear));
  const yearPnl = sumPrecise(yearEntries.map(e => Number(e.pnl)));
  
  // Calculate starting balances for percentage calculations
  const getStartingBalance = (periodStart) => {
    const entriesBeforePeriod = entries.filter(e => {
      const entryDate = getEntryDate(e);
      return entryDate < periodStart;
    });
    
    let balance = 0;
    entriesBeforePeriod.forEach(e => {
      if (e.isDeposit) {
        balance += Number(e.pnl) || 0;
      } else if (e.isPayout) {
        balance += Number(e.pnl) || 0; // Already negative
      } else if (!e.isTapeReading) {
        balance += Number(e.pnl) || 0;
      }
    });
    
    return Math.max(balance, 0.01); // Avoid division by zero, minimum 1 cent
  };
  
  const dayStartBalance = getStartingBalance(new Date(currentYear, currentMonth - 1, currentDay));
  const weekStartBalance = getStartingBalance(weekStart);
  const monthStartBalance = getStartingBalance(new Date(currentYear, currentMonth - 1, 1));
  const yearStartBalance = getStartingBalance(new Date(currentYear, 0, 1));
  
  const result = {
    day: { 
      pnl: dayPnl, 
      percentage: (dayPnl / dayStartBalance) * 100, 
      startBalance: dayStartBalance 
    },
    week: { 
      pnl: weekPnl, 
      percentage: (weekPnl / weekStartBalance) * 100, 
      startBalance: weekStartBalance 
    },
    month: { 
      pnl: monthPnl, 
      percentage: (monthPnl / monthStartBalance) * 100, 
      startBalance: monthStartBalance 
    },
    year: { 
      pnl: yearPnl, 
      percentage: (yearPnl / yearStartBalance) * 100, 
      startBalance: yearStartBalance 
    }
  };
  
  return result;
}

const SummaryPage = () => {
  const { currentUser, selectedAccount } = useContext(UserContext);
  const [stats, setStats] = useState(null);
  const [curveData, setCurveData] = useState({ curve: [], points: [] });
  const [streaks, setStreaks] = useState({});
  const [entries, setEntries] = useState([]);
  const [dailyPnl, setDailyPnl] = useState({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser || !selectedAccount) return;
    const fetchEntries = async () => {
      setLoading(true);
      const { db } = await import('../firebase');
      const { collection, getDocs } = await import('firebase/firestore');
      const entriesCol = collection(db, 'users', currentUser.uid, 'accounts', selectedAccount.id, 'entries');
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
  }, [currentUser, selectedAccount]);



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
    // Helper function to get entry date using year/month/day fields (consistent with other functions)
    const getEntryDate = (entry) => {
      if (entry.year && entry.month && entry.day) {
        // Use the year/month/day fields that are stored as strings
        const year = parseInt(entry.year, 10);
        const month = parseInt(entry.month, 10) - 1; // Convert to 0-indexed
        const day = parseInt(entry.day, 10);
        return new Date(year, month, day);
      }
      // Fallback to created timestamp
      if (entry.created) {
        const timestamp = entry.created.split('-')[0]; // Remove random suffix
        return new Date(timestamp);
      }
      return new Date();
    };

    const sorted = [...entries].sort((a, b) => getEntryDate(a) - getEntryDate(b));
    let bal = 0;
    sorted.forEach(e => {
      if (e.isDeposit) {
        // For deposits, add the deposit amount to the current balance
        bal += Number(e.pnl) || 0;
      } else if (e.isPayout) {
        // For payouts, add the payout amount (pnl is stored as negative)
        bal += Number(e.pnl) || 0; // pnl is already negative for payouts
      } else if (!e.isTapeReading) {
        // For trades, add the P&L to the previous balance
        bal += Number(e.pnl) || 0;
      }
      // Tape reading entries don't affect balance
    });
    // Round to 2 decimal places to avoid floating point precision issues
    currentBalance = (Math.round(bal * 100) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  // Calculate percentage changes (trading only, excluding deposits/payouts)
  const percentageChanges = getPercentageChanges(entries, currentBalance);
  
  // Debug logging for percentage calculations
  if (percentageChanges) {
    console.log('Percentage Changes Debug:', {
      day: { pnl: percentageChanges.day.pnl, percentage: percentageChanges.day.percentage, startBalance: percentageChanges.day.startBalance },
      week: { pnl: percentageChanges.week.pnl, percentage: percentageChanges.week.percentage, startBalance: percentageChanges.week.startBalance },
      month: { pnl: percentageChanges.month.pnl, percentage: percentageChanges.month.percentage, startBalance: percentageChanges.month.startBalance },
      year: { pnl: percentageChanges.year.pnl, percentage: percentageChanges.year.percentage, startBalance: percentageChanges.year.startBalance }
    });
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
  // Helper function to get entry date using year/month/day fields (consistent with other functions)
  const getEntryDate = (entry) => {
    if (entry.year && entry.month && entry.day) {
      // Use the year/month/day fields that are stored as strings
      const year = parseInt(entry.year, 10);
      const month = parseInt(entry.month, 10) - 1; // Convert to 0-indexed
      const day = parseInt(entry.day, 10);
      return new Date(year, month, day);
    }
    // Fallback to created timestamp
    if (entry.created) {
      const timestamp = entry.created.split('-')[0]; // Remove random suffix
      return new Date(timestamp);
    }
    return new Date();
  };

  const sortedTrades = [...tradeEntries].sort((a, b) => getEntryDate(b) - getEntryDate(a));
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
    // Use year/month/day fields like the rest of the app
    let d;
    if (e.year && e.month && e.day) {
      const year = parseInt(e.year, 10);
      const month = parseInt(e.month, 10) - 1; // Convert to 0-indexed
      const day = parseInt(e.day, 10);
      d = new Date(year, month, day);
    } else {
      // Fallback to created timestamp
      d = new Date(e.created);
    }
    const dayOfWeek = d.getDay();
    pnlByDay[dayOfWeek] = (pnlByDay[dayOfWeek] || 0) + (Number(e.pnl) || 0);
    countByDay[dayOfWeek] = (countByDay[dayOfWeek] || 0) + 1;
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
    // Use year/month/day fields like the rest of the app
    let d;
    if (e.year && e.month && e.day) {
      const year = parseInt(e.year, 10);
      const month = parseInt(e.month, 10) - 1; // Convert to 0-indexed
      const day = parseInt(e.day, 10);
      d = new Date(year, month, day);
    } else {
      // Fallback to created timestamp
      d = new Date(e.created);
    }
    const monthOfYear = d.getMonth();
    pnlByMonth[monthOfYear] = (pnlByMonth[monthOfYear] || 0) + (Number(e.pnl) || 0);
    countByMonth[monthOfYear] = (countByMonth[monthOfYear] || 0) + 1;
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
  const monthlyPnl = Math.round(weeklyPnls.reduce((sum, w) => sum + w.pnl, 0) * 100) / 100;

  // Find the most recent week and month
  const mostRecentWeekKey = weeklyRows.length > 0 ? weeklyRows[0][0] : null;
  const mostRecentMonthKey = monthlyRows.length > 0 ? monthlyRows[0][0] : null;
  const mostRecentWeekPnl = mostRecentWeekKey ? stats.byWeek[mostRecentWeekKey] : 0;
  const mostRecentMonthPnl = mostRecentMonthKey ? stats.byMonth[mostRecentMonthKey] : 0;

  const handleReset = async () => {
    if (!window.confirm('Are you sure you want to reset your account? This will delete ALL your journal entries, screenshots, and cannot be undone.')) return;
    if (!currentUser || !selectedAccount) return;
    // Delete all entries for this account
    const { db, storage } = await import('../firebase');
    const { collection, getDocs, deleteDoc, doc } = await import('firebase/firestore');
    const { ref, listAll, deleteObject } = await import('firebase/storage');
    const entriesCol = collection(db, 'users', currentUser.uid, 'accounts', selectedAccount.id, 'entries');
    const snap = await getDocs(entriesCol);
    await Promise.all(snap.docs.map(docSnap => deleteDoc(doc(db, 'users', currentUser.uid, 'accounts', selectedAccount.id, 'entries', docSnap.id))));
    // Delete all screenshots for this account
    const screenshotsRef = ref(storage, `screenshots/${currentUser.uid}/${selectedAccount.id}`);
    try {
      const list = await listAll(screenshotsRef);
      await Promise.all(list.items.map(itemRef => deleteObject(itemRef)));
    } catch (err) {
      // It's ok if there are no screenshots
      if (err.code !== 'storage/object-not-found') {
        console.error('Error deleting screenshots:', err);
      }
    }
    window.location.reload();
  };

  // Remove any button or link that navigates to or shows 'Edit Account' on the summary page.

  const totalPayouts = entries.filter(e => e.isPayout).length;

  return (
    <div className="w-full min-h-screen bg-black pt-20 px-4 sm:px-8">
      <div className="flex justify-between items-center mb-2">
        <button onClick={handleReset} className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded text-sm font-bold shadow ml-4">Reset Account</button>
      </div>
      
      {loading ? (
        <Spinner />
      ) : !stats ? (
        <div className="text-neutral-500">No data yet.</div>
      ) : (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{}}
          className="w-full flex flex-col gap-6"
        >
          {/* --- TOP PRIORITY SECTION: Day/Week/Month P&L + Account Balance --- */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 w-full">
            {/* Day P&L */}
            <motion.div 
              custom={0} 
              variants={sectionVariants} 
              whileHover={{ scale: 1.02, boxShadow: '0 25px 50px -12px rgba(16, 185, 129, 0.2)' }}
              className="backdrop-blur-sm bg-black/20 border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center shadow-2xl relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(31, 41, 55, 0.8) 0%, rgba(17, 24, 39, 0.8) 100%)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)'
              }}
            >
              <div className="text-sm font-light mb-2 uppercase tracking-wider text-neutral-400">Today's P&L</div>
              {percentageChanges ? (
                <>
                  <div className={`text-3xl font-bold leading-tight tracking-tight ${percentageChanges.day.pnl > 0 ? 'text-[#10B981]' : percentageChanges.day.pnl < 0 ? 'text-[#EF4444]' : 'text-neutral-300'}`}>
                    {percentageChanges.day.pnl > 0 ? '+' : ''}{percentageChanges.day.pnl.toFixed(2)}
                  </div>
                  <div className={`text-sm font-semibold ${percentageChanges.day.percentage > 0 ? 'text-[#10B981]' : percentageChanges.day.percentage < 0 ? 'text-[#EF4444]' : 'text-neutral-300'}`}>
                    {percentageChanges.day.percentage > 0 ? '+' : ''}{percentageChanges.day.percentage.toFixed(2)}%
                  </div>
                </>
              ) : <div className="text-neutral-500 text-sm">No trades today</div>}
            </motion.div>
            
            {/* Week P&L */}
            <motion.div 
              custom={1} 
              variants={sectionVariants} 
              whileHover={{ scale: 1.02, boxShadow: '0 25px 50px -12px rgba(59, 130, 246, 0.2)' }}
              className="backdrop-blur-sm bg-black/20 border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center shadow-2xl relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(31, 41, 55, 0.8) 0%, rgba(17, 24, 39, 0.8) 100%)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)'
              }}
            >
              <div className="text-sm font-light mb-2 uppercase tracking-wider text-neutral-400">This Week</div>
              {percentageChanges ? (
                <>
                  <div className={`text-3xl font-bold leading-tight tracking-tight ${percentageChanges.week.pnl > 0 ? 'text-[#10B981]' : percentageChanges.week.pnl < 0 ? 'text-[#EF4444]' : 'text-neutral-300'}`}>
                    {percentageChanges.week.pnl > 0 ? '+' : ''}{percentageChanges.week.pnl.toFixed(2)}
                  </div>
                  <div className={`text-sm font-semibold ${percentageChanges.week.percentage > 0 ? 'text-[#10B981]' : percentageChanges.week.percentage < 0 ? 'text-[#EF4444]' : 'text-neutral-300'}`}>
                    {percentageChanges.week.percentage > 0 ? '+' : ''}{percentageChanges.week.percentage.toFixed(2)}%
                  </div>
                </>
              ) : <div className="text-neutral-500 text-sm">No trades this week</div>}
            </motion.div>
            
            {/* Month P&L */}
            <motion.div 
              custom={2} 
              variants={sectionVariants} 
              whileHover={{ scale: 1.02, boxShadow: '0 25px 50px -12px rgba(139, 92, 246, 0.2)' }}
              className="backdrop-blur-sm bg-black/20 border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center shadow-2xl relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(31, 41, 55, 0.8) 0%, rgba(17, 24, 39, 0.8) 100%)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)'
              }}
            >
              <div className="text-sm font-light mb-2 uppercase tracking-wider text-neutral-400">This Month</div>
              {percentageChanges ? (
                <>
                  <div className={`text-3xl font-bold leading-tight tracking-tight ${percentageChanges.month.pnl > 0 ? 'text-[#10B981]' : percentageChanges.month.pnl < 0 ? 'text-[#EF4444]' : 'text-neutral-300'}`}>
                    {percentageChanges.month.pnl > 0 ? '+' : ''}{percentageChanges.month.pnl.toFixed(2)}
                  </div>
                  <div className={`text-sm font-semibold ${percentageChanges.month.percentage > 0 ? 'text-[#10B981]' : percentageChanges.month.percentage < 0 ? 'text-[#EF4444]' : 'text-neutral-300'}`}>
                    {percentageChanges.month.percentage > 0 ? '+' : ''}{percentageChanges.month.percentage.toFixed(2)}%
                  </div>
                </>
              ) : (
                <>
                  <div className="text-3xl font-bold leading-tight tracking-tight text-neutral-300">0.00</div>
                  <div className="text-sm font-semibold text-neutral-300">0.00%</div>
                </>
              )}
              <div className="text-xs text-neutral-500 mt-1">{now.toLocaleString('default', { month: 'short' })} {currentYear}</div>
            </motion.div>
            
            {/* YTD Performance */}
            <motion.div 
              custom={3} 
              variants={sectionVariants} 
              whileHover={{ scale: 1.02, boxShadow: '0 25px 50px -12px rgba(16, 185, 129, 0.2)' }}
              className="backdrop-blur-sm bg-black/20 border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center shadow-2xl relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(31, 41, 55, 0.8) 0%, rgba(17, 24, 39, 0.8) 100%)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)'
              }}
            >
              <div className="text-sm font-light mb-2 uppercase tracking-wider text-neutral-400">YTD Performance</div>
              {percentageChanges ? (
                <>
                  <div className={`text-3xl font-bold leading-tight tracking-tight ${percentageChanges.year.pnl > 0 ? 'text-[#10B981]' : percentageChanges.year.pnl < 0 ? 'text-[#EF4444]' : 'text-neutral-300'}`}>
                    {percentageChanges.year.pnl > 0 ? '+' : ''}{percentageChanges.year.pnl.toFixed(2)}
                  </div>
                  <div className={`text-sm font-semibold ${percentageChanges.year.percentage > 0 ? 'text-[#10B981]' : percentageChanges.year.percentage < 0 ? 'text-[#EF4444]' : 'text-neutral-300'}`}>
                    {percentageChanges.year.percentage > 0 ? '+' : ''}{percentageChanges.year.percentage.toFixed(2)}%
                  </div>
                </>
              ) : (
                <>
                  <div className="text-3xl font-bold leading-tight tracking-tight text-neutral-300">0.00</div>
                  <div className="text-sm font-semibold text-neutral-300">0.00%</div>
                </>
              )}
              <div className="text-xs text-neutral-500 mt-1">{currentYear}</div>
            </motion.div>
          </div>

          {/* --- EQUITY CURVE SECTION --- */}
          <motion.div 
            custom={4} 
            variants={sectionVariants} 
            whileHover={{ scale: 1.01, boxShadow: '0 25px 50px -12px rgba(59, 130, 246, 0.2)' }} 
            className="backdrop-blur-sm bg-black/20 border border-white/10 rounded-2xl p-8 flex flex-col gap-4 shadow-2xl relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(31, 41, 55, 0.8) 0%, rgba(17, 24, 39, 0.8) 100%)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)'
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <ChartBarIcon className="w-7 h-7 text-[#3B82F6]" />
                <span className="text-2xl font-bold text-[#e5e5e5] tracking-tight">Equity Curve</span>
              </div>
              <div className="text-right">
                <div className="text-sm font-light text-neutral-400 uppercase tracking-wider">Account Balance</div>
                <div className="text-xl font-bold text-[#10B981]">{currentBalance}</div>
              </div>
            </div>
            <div className="w-full h-72 flex items-center justify-center">
              <EquityCurveChart points={points} />
            </div>
          </motion.div>

          {/* --- TRADING PERFORMANCE GAUGES --- */}
          <motion.div
            custom={4.5}
            variants={sectionVariants}
            className="w-full"
          >
            <div className="flex items-center gap-3 mb-6">
              <BoltIcon className="w-7 h-7 text-[#F59E0B]" />
              <span className="text-2xl font-bold text-[#e5e5e5] tracking-tight">Trading Performance</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
              <Gauge
                value={stats.avgWinningTrade}
                label="Avg. Winning Trade"
                min={0}
                max={Math.max(200, stats.avgWinningTrade * 1.5)}
                unit="$"
                color="#10B981"
                tooltip="Average profit per winning trade. Shows how much you typically make on successful trades."
                ariaLabel={`Average winning trade: $${stats.avgWinningTrade?.toFixed(2) || 0}`}
                formatValue={(val) => `$${val?.toFixed(2) || "0.00"}`}
              />
              <Gauge
                value={stats.winRate}
                label="Winning Trade %"
                min={0}
                max={100}
                unit=""
                color="#3B82F6"
                tooltip="Percentage of trades that were profitable. A good trader typically has 50%+ win rate."
                ariaLabel={`Win rate: ${stats.winRate?.toFixed(1) || 0}%`}
                formatValue={(val) => `${val?.toFixed(1) || "0.0"}%`}
              />
              <Gauge
                value={Math.abs(stats.avgLosingTrade)}
                label="Avg. Losing Trade"
                min={0}
                max={Math.max(200, Math.abs(stats.avgLosingTrade) * 1.5)}
                unit="$"
                color="#EF4444"
                tooltip="Average loss per losing trade. Lower values indicate better risk management."
                ariaLabel={`Average losing trade: $${Math.abs(stats.avgLosingTrade)?.toFixed(2) || 0}`}
                formatValue={(val) => `-$${val?.toFixed(2) || "0.00"}`}
              />
            </div>
          </motion.div>

          {/* --- KEY STATS SECTION --- */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 w-full">
            <motion.div 
              custom={5} 
              variants={sectionVariants} 
              whileHover={{ scale: 1.02, boxShadow: '0 25px 50px -12px rgba(16, 185, 129, 0.2)' }}
              className="backdrop-blur-sm bg-black/20 border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center shadow-2xl relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(31, 41, 55, 0.8) 0%, rgba(17, 24, 39, 0.8) 100%)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)'
              }}
            >
              <div className="text-sm font-light mb-2 uppercase tracking-wider text-neutral-400">Total P&L</div>
              <AnimatedNumber 
                value={stats.totalPnl} 
                className={`text-2xl font-bold leading-tight tracking-tight ${stats.totalPnl > 0 ? "text-[#10B981]" : stats.totalPnl < 0 ? "text-[#EF4444]" : "text-neutral-300"}`} 
              />
            </motion.div>
            <motion.div 
              custom={6} 
              variants={sectionVariants} 
              whileHover={{ scale: 1.02, boxShadow: '0 25px 50px -12px rgba(16, 185, 129, 0.2)' }}
              className="backdrop-blur-sm bg-black/20 border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center shadow-2xl relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(31, 41, 55, 0.8) 0%, rgba(17, 24, 39, 0.8) 100%)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)'
              }}
            >
              <div className="text-sm font-light mb-2 uppercase tracking-wider text-neutral-400">Avg P&L</div>
              <AnimatedNumber 
                value={stats.avgPnl} 
                className="text-2xl font-bold leading-tight tracking-tight text-[#10B981]" 
              />
            </motion.div>
            <motion.div 
              custom={7} 
              variants={sectionVariants} 
              whileHover={{ scale: 1.02, boxShadow: '0 25px 50px -12px rgba(139, 92, 246, 0.2)' }}
              className="backdrop-blur-sm bg-black/20 border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center shadow-2xl relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(31, 41, 55, 0.8) 0%, rgba(17, 24, 39, 0.8) 100%)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)'
              }}
            >
              <div className="text-sm font-light mb-2 uppercase tracking-wider text-neutral-400">Avg R:R</div>
              <AnimatedNumber 
                value={stats.avgRr} 
                decimals={2} 
                className="text-2xl font-bold leading-tight tracking-tight text-[#8B5CF6]" 
              />
            </motion.div>
            <motion.div 
              custom={8} 
              variants={sectionVariants} 
              whileHover={{ scale: 1.02, boxShadow: '0 25px 50px -12px rgba(59, 130, 246, 0.2)' }}
              className="backdrop-blur-sm bg-black/20 border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center shadow-2xl relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(31, 41, 55, 0.8) 0%, rgba(17, 24, 39, 0.8) 100%)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)'
              }}
            >
              <div className="text-sm font-light mb-2 uppercase tracking-wider text-neutral-400">Total Trades</div>
              <div className="text-2xl font-bold leading-tight tracking-tight text-[#3B82F6]">{stats.totalTrades}</div>
            </motion.div>
            <motion.div 
              custom={9} 
              variants={sectionVariants} 
              whileHover={{ scale: 1.02, boxShadow: '0 25px 50px -12px rgba(245, 158, 11, 0.2)' }}
              className="backdrop-blur-sm bg-black/20 border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center shadow-2xl relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(31, 41, 55, 0.8) 0%, rgba(17, 24, 39, 0.8) 100%)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)'
              }}
            >
              <div className="text-sm font-light mb-2 uppercase tracking-wider text-neutral-400">Payouts</div>
              <div className="text-2xl font-bold leading-tight tracking-tight text-[#F59E0B]">{totalPayouts}</div>
            </motion.div>
          </div>

          {/* --- STREAKS + BEST/WORST TRADES SECTION --- */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
            {/* Streaks */}
            <motion.div 
              custom={10} 
              variants={sectionVariants} 
              whileHover={{ scale: 1.01, boxShadow: '0 25px 50px -12px rgba(59, 130, 246, 0.2)' }}
              className="backdrop-blur-sm bg-black/20 border border-white/10 rounded-2xl p-8 flex flex-col gap-4 shadow-2xl relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(31, 41, 55, 0.8) 0%, rgba(17, 24, 39, 0.8) 100%)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)'
              }}
            >
              <div className="text-xl font-bold mb-4 text-[#e5e5e5] tracking-tight">Streak Tracker</div>
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-[#10B981] mb-1">{streaks.greenStreak}</div>
                  <div className="text-sm font-light text-neutral-400 uppercase tracking-wider">Current Green</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-[#059669] mb-1">{streaks.maxGreen}</div>
                  <div className="text-sm font-light text-neutral-400 uppercase tracking-wider">Max Green</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-[#EF4444] mb-1">{streaks.lossStreak}</div>
                  <div className="text-sm font-light text-neutral-400 uppercase tracking-wider">Current Loss</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-[#DC2626] mb-1">{streaks.maxLoss}</div>
                  <div className="text-sm font-light text-neutral-400 uppercase tracking-wider">Max Loss</div>
                </div>
              </div>
            </motion.div>

            {/* Best/Worst Trades */}
            <div className="flex flex-col gap-4">
              {bestTrade && (
                <motion.div 
                  whileHover={{ scale: 1.02, boxShadow: '0 25px 50px -12px rgba(16, 185, 129, 0.2)' }}
                  className="backdrop-blur-sm bg-black/20 border border-white/10 rounded-2xl p-6 flex flex-col gap-2 shadow-2xl relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(31, 41, 55, 0.8) 100%)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)'
                  }}
                >
                  <div className="text-sm font-light uppercase tracking-wider text-neutral-400">Best Trade</div>
                  <div className="text-2xl font-bold text-[#10B981] leading-tight tracking-tight">{bestTrade.pnl > 0 ? '+' : ''}{bestTrade.pnl}</div>
                  <div className="text-xs text-neutral-500">{bestTrade.tickerTraded} • {new Date(bestTrade.created).toLocaleDateString()}</div>
                </motion.div>
              )}
              {worstTrade && (
                <motion.div 
                  whileHover={{ scale: 1.02, boxShadow: '0 25px 50px -12px rgba(239, 68, 68, 0.2)' }}
                  className="backdrop-blur-sm bg-black/20 border border-white/10 rounded-2xl p-6 flex flex-col gap-2 shadow-2xl relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(31, 41, 55, 0.8) 100%)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)'
                  }}
                >
                  <div className="text-sm font-light uppercase tracking-wider text-neutral-400">Worst Trade</div>
                  <div className="text-2xl font-bold text-[#EF4444] leading-tight tracking-tight">{worstTrade.pnl > 0 ? '+' : ''}{worstTrade.pnl}</div>
                  <div className="text-xs text-neutral-500">{worstTrade.tickerTraded} • {new Date(worstTrade.created).toLocaleDateString()}</div>
                </motion.div>
              )}
            </div>
          </div>


        </motion.div>
      )}
    </div>
  );
};

export default SummaryPage; 