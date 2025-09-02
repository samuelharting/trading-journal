import React, { useEffect, useState, useContext, useCallback } from "react";
// Removed framer-motion for minimalistic design
import {
  CurrencyDollarIcon,
  ChartBarIcon,
  CalendarIcon,
  BoltIcon,
  ArrowTrendingUpIcon,
  PencilIcon
} from "@heroicons/react/24/outline";
import { UserContext } from "../App";
import { db } from '../firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import Spinner from '../components/MatrixLoader';

import StatCard from '../components/StatCard';
import CircleCard from '../components/CircleCard';
import { useNavigate } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart, defs, linearGradient, stop } from 'recharts';
import { getTradingPerformance } from '../statsUtils';

function sumPrecise(arr) {
  // Sums an array of numbers/strings as cents, returns float
  return arr.reduce((sum, v) => sum + Math.round(Number(v) * 100), 0) / 100;
}

function getStats(entries, selectedYear = 'all') {
  if (!entries.length) return null;
  
  // Filter entries by year if a specific year is selected
  let filteredEntries = entries;
  if (selectedYear !== 'all') {
    filteredEntries = entries.filter(e => String(e.year) === String(selectedYear));
  }
  
  // Only include entries that are actual trades (not deposits, payouts, tape reading, or reset-excluded)
  const tradeEntries = filteredEntries.filter(e => 
    !e.isDeposit && 
    !e.isPayout && 
    !e.isTapeReading && 
    !e.isResetExcluded && // Exclude trades marked as reset
    e.pnl !== undefined && 
    e.pnl !== null && 
    e.pnl !== ""
    // Include $0 P&L trades (breakeven trades) in statistics
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
  
  // Group by week/month for averages (ONLY TRADES, not deposits/payouts/reset-excluded)
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

function getEquityCurve(entries, selectedYear = 'all') {
  // Filter entries by year if a specific year is selected
  let filteredEntries = entries;
  if (selectedYear !== 'all') {
    filteredEntries = entries.filter(e => String(e.year) === String(selectedYear));
  }
  
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

  // Sort entries chronologically - using created timestamp as primary sort
  const sorted = [...entries].sort((a, b) => {
    const getTimestamp = (entry) => {
      if (entry.created) {
        // Handle format: "2025-01-06T03:43:47.677Z-u38k53"
        // Find the last dash and split there to separate ISO string from random suffix
        const lastDashIndex = entry.created.lastIndexOf('-');
        if (lastDashIndex > 10) { // Make sure it's not a date dash
          const isoString = entry.created.substring(0, lastDashIndex);
          return new Date(isoString).getTime();
        } else {
          // Fallback: try parsing the whole string
          return new Date(entry.created).getTime();
        }
      }
      // Fallback to date fields
      if (entry.year && entry.month && entry.day) {
        const year = parseInt(entry.year, 10);
        const month = parseInt(entry.month, 10) - 1;
        const day = parseInt(entry.day, 10);
        return new Date(year, month, day).getTime();
      }
      return 0;
    };
    
    const timestampA = getTimestamp(a);
    const timestampB = getTimestamp(b);
    
    console.log(`📅 Sorting: ${a.created} (${new Date(timestampA).toISOString()}) vs ${b.created} (${new Date(timestampB).toISOString()})`);
    
    return timestampA - timestampB;
  });
  
  let curve = [];
  let balance = 0; // Start from 0 balance
  let points = [];
  
  // Add initial point at 0
  curve.push(balance);
  points.push({ x: 0, y: balance, date: 'Start' });
  
  console.log('📈 getEquityCurve: Processing entries in chronological order:');
  
  sorted.forEach((e, i) => {
    const prevBal = balance;
    const entryDate = e.created ? new Date(e.created.split('-')[0]).toLocaleString() : 'Unknown';
    
    // Process each entry type and update balance
    let entryType = '';
    let displayPnl = 0;
    let shouldAddToCurve = false;
    
    if (e.isDeposit) {
      const depositAmount = Number(e.pnl) || 0;
      balance += depositAmount;
      entryType = 'Deposit';
      displayPnl = depositAmount;
      shouldAddToCurve = true;
      console.log(`  ${i + 1}. DEPOSIT [${entryDate}]: +$${depositAmount} → $${prevBal} + $${depositAmount} = $${balance}`);
    } else if (e.isPayout) {
      const payoutAmount = Number(e.pnl) || 0; // This should already be negative
      balance += payoutAmount; // Adding a negative number subtracts it
      entryType = 'Payout';
      displayPnl = Math.abs(payoutAmount); // Show positive amount for display
      shouldAddToCurve = true;
      console.log(`  ${i + 1}. PAYOUT [${entryDate}]: ${payoutAmount} → $${prevBal} + (${payoutAmount}) = $${balance}`);
          } else if (!e.tapeReading && !e.isTapeReading && !e.isResetExcluded) {
        const tradePnl = Number(e.pnl) || 0;
        balance += tradePnl;
        entryType = 'Trade';
        displayPnl = tradePnl;
        shouldAddToCurve = true;
        console.log(`  ${i + 1}. TRADE [${entryDate}]: ${tradePnl >= 0 ? '+' : ''}$${tradePnl} → $${prevBal} + $${tradePnl} = $${balance}`);
      } else if (e.isResetExcluded) {
        console.log(`  ${i + 1}. RESET-EXCLUDED TRADE [${entryDate}]: ignored (excluded from account P&L)`);
    } else {
      console.log(`  ${i + 1}. TAPE READING [${entryDate}]: ignored (no P&L impact)`);
    }
    
    // Round to avoid floating point precision issues
    balance = Math.round(balance * 100) / 100;
    
    // Add point to equity curve for each balance-affecting entry
    if (shouldAddToCurve) {
      curve.push(balance);
      
      // Create detailed point data
      const entryDate = e.created ? new Date(e.created.split('-')[0]) : new Date();
      const dateLabel = entryDate.toLocaleDateString();
      const timeLabel = entryDate.toLocaleTimeString();
      
      points.push({ 
        x: points.length, 
        y: balance, 
        date: dateLabel,
        time: timeLabel,
        type: entryType,
        pnl: displayPnl,
        ticker: e.tickerTraded || '',
        title: e.title || '',
        accountBalance: balance // Explicitly store the account balance at this point
      });
      
      console.log(`  📊 Added curve point: ${entryType} → Balance: ${balance}`);
    }
  });
  
  console.log('📈 getEquityCurve: Final balance:', balance, 'Curve points:', points.length);
  
  return { curve, points };
}

function getStreaks(entries, selectedYear = 'all') {
  // Filter entries by year if a specific year is selected
  let filteredEntries = entries;
  if (selectedYear !== 'all') {
    filteredEntries = entries.filter(e => String(e.year) === String(selectedYear));
  }
  
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
    .filter(e => !e.isDeposit && !e.isPayout && !e.isTapeReading && !e.isResetExcluded && e.pnl !== undefined && e.pnl !== null && e.pnl !== "")
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

function getDailyPnl(entries, selectedYear = 'all') {
  // Filter entries by year if a specific year is selected
  let filteredEntries = entries;
  if (selectedYear !== 'all') {
    filteredEntries = entries.filter(e => String(e.year) === String(selectedYear));
  }
  
  const byDay = {};
  // Only count actual trades (not deposits, payouts, tape reading, or reset-excluded)
  filteredEntries.filter(e => 
    !e.isDeposit && 
    !e.isPayout && 
    !e.isTapeReading &&
    !e.isResetExcluded &&
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

// Simple static number display - no animations
const StaticNumber = ({ value, decimals = 2, className = "" }) => {
  return <span className={className}>{value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</span>;
};

// Helper function to parse created timestamp correctly
const parseCreatedDate = (entry) => {
  if (entry.created) {
    const lastDashIndex = entry.created.lastIndexOf('-');
    if (lastDashIndex > 10) { // Make sure it's not a date dash
      const isoString = entry.created.substring(0, lastDashIndex);
      return new Date(isoString);
    } else {
      return new Date(entry.created);
    }
  }
  // Fallback to constructed date from year/month/day fields
  if (entry.year && entry.month && entry.day) {
    return new Date(entry.year, entry.month - 1, entry.day);
  }
  return new Date(); // Last resort
};

const iconClass = "w-6 h-6 inline-block mr-2 text-blue-400 align-middle";

// Removed animation variants for minimalistic design

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
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={points} margin={{ top: 20, right: 20, left: 50, bottom: 20 }}>
        <XAxis 
          dataKey="x" 
          tick={{ fill: '#9CA3AF', fontSize: 11 }} 
          hide 
        />
        <YAxis 
          tick={{ fill: '#9CA3AF', fontSize: 11 }} 
          width={50} 
          domain={yDomain}
          tickFormatter={(value) => `$${value.toFixed(0)}`}
        />
        <Tooltip 
          contentStyle={{
            background: '#1F2937', 
            border: '1px solid #374151', 
            color: '#E5E7EB', 
            borderRadius: 6,
            fontSize: 12
          }} 
          formatter={(value) => [`$${value.toFixed(2)}`, 'Balance']}
        />
        <Area 
          type="monotone" 
          dataKey="y" 
          stroke="#3B82F6" 
          fill="#3B82F6" 
          fillOpacity={0.1} 
          strokeWidth={2} 
          dot={{ r: 4, fill: '#60A5FA', stroke: '#ffffff', strokeWidth: 2 }} 
          isAnimationActive={false}
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

function getPercentageChanges(entries, currentBalance, selectedYear = 'all') {
  if (!entries.length) return null;
  
  // Filter entries by year if a specific year is selected
  let filteredEntries = entries;
  if (selectedYear !== 'all') {
    filteredEntries = entries.filter(e => String(e.year) === String(selectedYear));
  }
  
  // Sort all entries chronologically to calculate proper account balance progression
  const sortedEntries = [...filteredEntries].sort((a, b) => {
    const aTime = a.created ? new Date(a.created.split('-')[0]).getTime() : 0;
    const bTime = b.created ? new Date(b.created.split('-')[0]).getTime() : 0;
    return aTime - bTime;
  });
  
  // Helper to get entry date
  const getEntryDate = (entry) => {
    if (entry.year && entry.month && entry.day) {
      return new Date(parseInt(entry.year), parseInt(entry.month) - 1, parseInt(entry.day));
    }
    if (entry.created) {
      return new Date(entry.created.split('-')[0]);
    }
    return new Date();
  };
  
  // Calculate the starting capital (sum of all deposits minus payouts)
  const totalDeposits = sumPrecise(
    sortedEntries
      .filter(e => e.isDeposit)
      .map(e => Number(e.pnl) || 0)
  );
  
  const totalPayouts = sumPrecise(
    sortedEntries
      .filter(e => e.isPayout)
      .map(e => Number(e.pnl) || 0) // Already negative
  );
  
  // For percentage calculations, we need the ORIGINAL invested capital
  // This should be total deposits (don't subtract payouts for percentage base)
  const originalCapital = totalDeposits;
  
  // Calculate total trading P&L (excluding deposits, payouts, and reset-excluded trades)
  const totalTradingPnl = sumPrecise(
    sortedEntries
      .filter(e => !e.isDeposit && !e.isPayout && !e.isTapeReading && !e.isResetExcluded)
      .map(e => Number(e.pnl) || 0)
  );
  
  // Overall account performance (trading performance only based on original capital)
  const overallPercentage = originalCapital > 0 ? (totalTradingPnl / originalCapital) * 100 : 0;
  
  // For day/week/month calculations, we'll show overall performance since 
  // the user specifically mentioned the issue with period-based calculations
  // Alternatively, we could calculate actual period-based performance if trades exist in those periods
  
  // Get the current date for period calculations
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();
  
  // Helper function to get trades in a specific period
  const getTradesInPeriod = (startDate, endDate) => {
    return sortedEntries.filter(e => {
      if (e.isDeposit || e.isPayout || e.isTapeReading || e.isResetExcluded) return false;
      const entryDate = getEntryDate(e);
      return entryDate >= startDate && entryDate <= endDate;
    });
  };
  
  // Calculate periods
  const startOfToday = new Date(currentYear, currentMonth - 1, currentDay, 0, 0, 0);
  const endOfToday = new Date(currentYear, currentMonth - 1, currentDay, 23, 59, 59);
  
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  
  const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
  
  // Get trades for each period
  const todayTrades = getTradesInPeriod(startOfToday, endOfToday);
  const weekTrades = getTradesInPeriod(startOfWeek, now);
  const monthTrades = getTradesInPeriod(startOfMonth, now);
  
  // Calculate P&L for each period
  const dayPnl = sumPrecise(todayTrades.map(e => Number(e.pnl) || 0));
  const weekPnl = sumPrecise(weekTrades.map(e => Number(e.pnl) || 0));
  const monthPnl = sumPrecise(monthTrades.map(e => Number(e.pnl) || 0));
  
  // For percentage calculations, we have two options:
  // Option 1: Show 0% for periods with no trades (what user mentioned they want)
  // Option 2: Show overall performance in all cards
  // I'll implement Option 1 as per user's request
  
  const dayPercentage = todayTrades.length > 0 && originalCapital > 0 ? (dayPnl / originalCapital) * 100 : 0;
  const weekPercentage = weekTrades.length > 0 && originalCapital > 0 ? (weekPnl / originalCapital) * 100 : 0;
  const monthPercentage = monthTrades.length > 0 && originalCapital > 0 ? (monthPnl / originalCapital) * 100 : 0;
  
  const result = {
    day: { 
      pnl: dayPnl, 
      percentage: dayPercentage,
      hasTrades: todayTrades.length > 0
    },
    week: { 
      pnl: weekPnl, 
      percentage: weekPercentage,
      hasTrades: weekTrades.length > 0
    },
    month: { 
      pnl: monthPnl, 
      percentage: monthPercentage,
      hasTrades: monthTrades.length > 0
    },
    overall: {
      pnl: totalTradingPnl,
      percentage: overallPercentage,
      startingCapital: originalCapital
    }
  };
  
  console.log('📊 FIXED getPercentageChanges DEBUG:');
  console.log('  Total Deposits:', totalDeposits);
  console.log('  Total Payouts:', totalPayouts);
  console.log('  Original Capital (for % calc):', originalCapital);
  console.log('  Total Trading P&L:', totalTradingPnl);
  console.log('  Overall Performance:', overallPercentage.toFixed(2) + '%');
  console.log('  Day - P&L:', dayPnl, 'Percentage:', dayPercentage.toFixed(2) + '% (', todayTrades.length, 'trades)');
  console.log('  Week - P&L:', weekPnl, 'Percentage:', weekPercentage.toFixed(2) + '% (', weekTrades.length, 'trades)');
  console.log('  Month - P&L:', monthPnl, 'Percentage:', monthPercentage.toFixed(2) + '% (', monthTrades.length, 'trades)');
  
  return result;
}

const SummaryPage = () => {
  const { currentUser, selectedAccount, dataRefreshTrigger, triggerDataRefresh } = useContext(UserContext);
  const [stats, setStats] = useState(null);
  const [curveData, setCurveData] = useState({ curve: [], points: [] });
  const [streaks, setStreaks] = useState({});
  const [entries, setEntries] = useState([]);
  const [dailyPnl, setDailyPnl] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState('all'); // 'all' or specific year
  const navigate = useNavigate();
  
  // Year dropdown options: All Time + dynamic range based on current year
  const currentYear = new Date().getFullYear();
  const yearOptions = [
    { value: 'all', label: 'All Time' },
    ...Array.from({ length: 8 }, (_, i) => currentYear - 3 + i).map(y => ({ value: y.toString(), label: y.toString() }))
  ];

  useEffect(() => {
    const fetchEntries = async () => {
      if (!currentUser || !selectedAccount) return;
      console.log('🔄 SummaryPage: Fetching entries for:', selectedAccount.name, 'Trigger:', dataRefreshTrigger);
      setLoading(true);
      try {
        const { db } = await import('../firebase');
        const { collection, getDocs } = await import('firebase/firestore');
        const entriesCol = collection(db, 'users', currentUser.uid, 'accounts', selectedAccount.id, 'entries');
        const snap = await getDocs(entriesCol);
        const data = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        
        console.log('📊 SummaryPage: Retrieved entries:', data.length);
        console.log('📊 SummaryPage: Entry breakdown:', {
          deposits: data.filter(e => e.isDeposit).length,
          payouts: data.filter(e => e.isPayout).length,
          trades: data.filter(e => !e.isDeposit && !e.isPayout && !e.isTapeReading).length,
          tapeReadings: data.filter(e => e.isTapeReading).length
        });
        console.log('📊 SummaryPage: Selected year:', selectedYear, 'Filtered entries for year:', selectedYear === 'all' ? 'All years' : selectedYear);
        
        setEntries(data);
        const statsResult = getStats(data, selectedYear);
        const curveResult = getEquityCurve(data, selectedYear);
        
        console.log('📈 SummaryPage: Stats result:', statsResult);
        console.log('📈 SummaryPage: Curve result balance:', curveResult?.points?.length ? curveResult.points[curveResult.points.length - 1]?.y : 0);
        
        setStats(statsResult);
        setCurveData(curveResult);
        setStreaks(getStreaks(data, selectedYear));
        setDailyPnl(getDailyPnl(data, selectedYear));
      } catch (error) {
        console.error('❌ SummaryPage: Error fetching entries:', error);
      }
      setLoading(false);
    };
    
    fetchEntries();
  }, [currentUser, selectedAccount, dataRefreshTrigger, selectedYear]);

  // Note: Removed visibility/focus refresh since we now have triggerDataRefresh mechanism



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
  console.log('💰 SummaryPage: Computing balance for', entries.length, 'entries, year filter:', selectedYear);
  
  if (entries.length > 0) {
    // Filter entries by year if a specific year is selected
    let balanceEntries = entries;
    if (selectedYear !== 'all') {
      balanceEntries = entries.filter(e => String(e.year) === String(selectedYear));
      console.log('💰 SummaryPage: Filtered to', balanceEntries.length, 'entries for year', selectedYear);
    }
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

    // Sort entries chronologically - using created timestamp as primary sort
    const sorted = [...balanceEntries].sort((a, b) => {
      const getTimestamp = (entry) => {
        if (entry.created) {
          const timestamp = entry.created.split('-')[0]; // Remove random suffix
          return new Date(timestamp).getTime();
        }
        // Fallback to date fields
        if (entry.year && entry.month && entry.day) {
          const year = parseInt(entry.year, 10);
          const month = parseInt(entry.month, 10) - 1;
          const day = parseInt(entry.day, 10);
          return new Date(year, month, day).getTime();
        }
        return 0;
      };
      return getTimestamp(a) - getTimestamp(b);
    });
    
    let bal = 0;
    
    console.log('💰 SummaryPage: Processing entries in chronological order:');
    sorted.forEach((e, index) => {
      const prevBal = bal;
      const entryDate = e.created ? new Date(e.created.split('-')[0]).toLocaleString() : 'Unknown';
      
      if (e.isDeposit) {
        // For deposits, just add the pnl amount (don't use stored accountBalance as it might be wrong)
        bal += Number(e.pnl) || 0;
        console.log(`  ${index + 1}. DEPOSIT [${entryDate}]: ${e.pnl} → ${prevBal} + ${e.pnl} = ${bal}`);
      } else if (e.isPayout) {
        // For payouts, subtract the amount (pnl should already be negative)
        bal += Number(e.pnl) || 0;
        console.log(`  ${index + 1}. PAYOUT [${entryDate}]: ${e.pnl} → ${prevBal} + ${e.pnl} = ${bal}`);
      } else if (!e.isTapeReading && !e.isResetExcluded) {
        // For trades, add the P&L to the previous balance
        bal += Number(e.pnl) || 0;
        console.log(`  ${index + 1}. TRADE [${entryDate}]: ${e.pnl} → ${prevBal} + ${e.pnl} = ${bal}`);
      } else if (e.isResetExcluded) {
        console.log(`  ${index + 1}. RESET-EXCLUDED TRADE [${entryDate}]: ${e.pnl} (ignored for account balance)`);
      } else {
        console.log(`  ${index + 1}. TAPE READING [${entryDate}]: ignored`);
      }
      // Tape reading entries don't affect balance
    });
    // Round to 2 decimal places to avoid floating point precision issues
    const finalBalance = Math.round(bal * 100) / 100;
    currentBalance = finalBalance.toLocaleString(undefined, { maximumFractionDigits: 2 });
    console.log('💰 SummaryPage: Final calculated balance:', finalBalance, '→ Formatted:', currentBalance);
  } else {
    console.log('💰 SummaryPage: No entries found, balance remains 0.00');
  }

  // Calculate percentage changes (trading only, excluding deposits/payouts)
  const percentageChanges = getPercentageChanges(entries, currentBalance, selectedYear);
  
  // Get current month's trading performance for the 20% goal
  const now = new Date();
  let currentMonthPerformance = null;
  
  // Only show current month performance if we're viewing all time or the current year
  if (selectedYear === 'all' || String(now.getFullYear()) === String(selectedYear)) {
    currentMonthPerformance = getTradingPerformance(entries, now.getFullYear(), now.getMonth() + 1);
  }
  
  // Only consider actual trades (not deposits, payouts, tape reading, or reset-excluded) for best/worst/recent
  // Also respect year filter if selected
  let tradeEntries = entries.filter(e => 
    !e.isDeposit && 
    !e.isPayout && 
    !e.isTapeReading && 
    !e.isResetExcluded &&
    typeof e.pnl === 'number' && 
    !isNaN(e.pnl)
  );
  
  // Apply year filter if specific year is selected
  if (selectedYear !== 'all') {
    tradeEntries = tradeEntries.filter(e => String(e.year) === String(selectedYear));
    console.log('📊 SummaryPage: Filtered trade entries to', tradeEntries.length, 'trades for year', selectedYear);
  }

  // Final summary
  console.log('🎯 SummaryPage: CALCULATION COMPLETE');
  console.log('🎯 Year Filter:', selectedYear);
  console.log('🎯 Balance Display:', currentBalance);
  console.log('🎯 Equity Curve Points:', curveData?.points?.length || 0);
  console.log('🎯 Trade Entries Count:', tradeEntries.length);
  console.log('==========================================');

  // Find the most recent day, week, and month
  const mostRecentDay = dailyRows.length > 0 ? dailyRows[0] : null;
  const mostRecentWeek = weeklyRows.length > 0 ? weeklyRows[0] : null;
  const mostRecentMonth = monthlyRows.length > 0 ? monthlyRows[0] : null;
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

  // Get current month
  const currentMonth = new Date().getMonth() + 1;
  // Get weekly PnLs for current month - respect year filter
  let weeklyPnls = [];
  if (selectedYear === 'all' || String(currentYear) === String(selectedYear)) {
    weeklyPnls = getWeeklyPnlsForMonth(entries, currentYear, currentMonth);
  }
  // Get monthly PnL for current month
  const monthlyPnl = Math.round(weeklyPnls.reduce((sum, w) => sum + w.pnl, 0) * 100) / 100;

  // Find the most recent week and month
  const mostRecentWeekKey = weeklyRows.length > 0 ? weeklyRows[0][0] : null;
  const mostRecentMonthKey = monthlyRows.length > 0 ? monthlyRows[0][0] : null;
  const mostRecentWeekPnl = mostRecentWeekKey ? stats.byWeek[mostRecentWeekKey] : 0;
  const mostRecentMonthPnl = mostRecentMonthKey ? stats.byMonth[mostRecentMonthKey] : 0;

  const handleReset = async () => {
    if (!window.confirm('Are you sure you want to reset this account? This will:\n• Delete deposits and payouts\n• Mark trades as "reset" (excluded from this account\'s P&L)\n• Trades will still be visible on Trades page (cross-account)\n• Account balance and percentages will be reset to 0')) return;
    if (!currentUser || !selectedAccount) return;
    
    console.log('🔄 Starting account reset for:', selectedAccount.name);
    
    try {
      const { db } = await import('../firebase');
      const { collection, getDocs, deleteDoc, doc, updateDoc } = await import('firebase/firestore');
      
      const entriesCol = collection(db, 'users', currentUser.uid, 'accounts', selectedAccount.id, 'entries');
      const snap = await getDocs(entriesCol);
      
      console.log('📊 Total entries found:', snap.docs.length);
      
      const entriesToDelete = [];
      const entriesToMarkReset = [];
      
      snap.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (data.isDeposit || data.isPayout) {
          entriesToDelete.push(docSnap);
          console.log('🗑️ Will delete:', data.isDeposit ? 'Deposit' : 'Payout', data.pnl);
        } else if (!data.isTapeReading) {
          // Mark trades as reset-excluded (but keep tape readings visible)
          entriesToMarkReset.push(docSnap);
          console.log('🏷️ Will mark as reset:', 'Trade', data.title || data.tickerTraded, data.pnl);
        } else {
          console.log('✅ Will keep visible:', 'Tape Reading', data.title);
        }
      });
      
      console.log(`📈 Reset plan: Delete ${entriesToDelete.length} deposits/payouts, Mark ${entriesToMarkReset.length} trades as reset, Keep tape readings`);
      
      // Delete deposits and payouts
      if (entriesToDelete.length > 0) {
        await Promise.all(entriesToDelete.map(docSnap => 
          deleteDoc(doc(db, 'users', currentUser.uid, 'accounts', selectedAccount.id, 'entries', docSnap.id))
        ));
        console.log('✅ Deleted deposits/payouts');
      }
      
      // Mark trades as reset (exclude from account P&L but keep for TradesPage)
      if (entriesToMarkReset.length > 0) {
        await Promise.all(entriesToMarkReset.map(docSnap => 
          updateDoc(doc(db, 'users', currentUser.uid, 'accounts', selectedAccount.id, 'entries', docSnap.id), {
            isResetExcluded: true,
            resetDate: new Date().toISOString(),
            resetAccountName: selectedAccount.name
          })
        ));
        console.log('✅ Marked trades as reset-excluded');
      }
      
      console.log('✅ Account reset completed successfully');
      
      // Force refresh all data
      console.log('🔄 Triggering data refresh...');
      if (triggerDataRefresh) {
        triggerDataRefresh();
        console.log('✅ Data refresh triggered successfully');
      } else {
        console.error('❌ triggerDataRefresh not available, falling back to reload');
        window.location.reload();
      }
      
      // Give a small delay to ensure the refresh propagates
      setTimeout(() => {
        console.log('🔄 Data refresh completed');
      }, 500);
      
    } catch (error) {
      console.error('❌ Error during reset:', error);
      alert('Error during reset: ' + error.message);
    }
  };

  // Remove any button or link that navigates to or shows 'Edit Account' on the summary page.

  const totalPayouts = entries.filter(e => e.isPayout).length;

  // Check if this is a new account that needs a deposit
  const isNewAccount = entries.length === 0 || parseFloat(currentBalance.replace(/,/g, '')) <= 0;
  
  const handleStartWithDeposit = () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    navigate(`/day/${month}/${day}`, { 
      state: { 
        date: now.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }),
        forceDepositEntry: true
      } 
    });
  };

  return (
    <div className="w-full min-h-screen bg-black pt-20 px-4 sm:px-8">
      <div className="flex justify-between items-center mb-2">
        <button onClick={handleReset} className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded text-sm font-bold shadow ml-4">Reset Account</button>
      </div>
      
      {/* Year Filter Dropdown - Subtle and positioned below reset button */}
      <div className="flex justify-end mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-400">Time Period:</span>
          <select
            className="bg-neutral-900 text-[#e5e5e5] border border-neutral-700 rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
            value={selectedYear}
            onChange={e => setSelectedYear(e.target.value)}
          >
            {yearOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {selectedYear !== 'all' && (
            <span className="text-xs text-blue-400 bg-blue-900/20 px-2 py-1 rounded">
              {selectedYear} Only
            </span>
          )}
          {selectedYear !== 'all' && (
            <span className="text-xs text-neutral-500">
              ({tradeEntries.length} trades)
            </span>
          )}
        </div>
      </div>
      
      {loading ? (
        <Spinner />
      ) : isNewAccount ? (
        // New Account Onboarding - Deposit First
        <div className="w-full flex flex-col items-center justify-center min-h-[60vh]">
          <div className="max-w-2xl text-center space-y-8">
            {/* Welcome Message */}
            <div className="space-y-4">
              <div className="w-24 h-24 mx-auto bg-gradient-to-br from-blue-500 to-emerald-500 rounded-full flex items-center justify-center shadow-2xl">
                <CurrencyDollarIcon className="w-12 h-12 text-white" />
              </div>
              <h1 className="text-4xl font-bold text-[#e5e5e5] mb-4">
                Welcome to Your Trading Journal!
              </h1>
              <p className="text-xl text-neutral-400 leading-relaxed">
                Let's get started by adding your initial deposit to track your trading progress.
              </p>
            </div>

            {/* Call to Action */}
            <div className="space-y-4">
              <button
                onClick={handleStartWithDeposit}
                className="bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white text-xl font-bold px-12 py-4 rounded-xl shadow-2xl hover:shadow-emerald-500/25 transition-all duration-300 hover:scale-105"
              >
                Add Initial Deposit
              </button>
              
              <p className="text-sm text-neutral-500">
                You can always add more deposits, payouts, and trades later.
              </p>
            </div>

            {/* Features Preview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 text-center">
              <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6">
                <ChartBarIcon className="w-8 h-8 text-blue-400 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-[#e5e5e5] mb-2">Track Performance</h3>
                <p className="text-sm text-neutral-400">Monitor your P&L, win rate, and trading statistics</p>
              </div>
              
              <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6">
                <CalendarIcon className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-[#e5e5e5] mb-2">Daily Journal</h3>
                <p className="text-sm text-neutral-400">Log trades, screenshots, and notes for each day</p>
              </div>
              
              <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6">
                <ArrowTrendingUpIcon className="w-8 h-8 text-purple-400 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-[#e5e5e5] mb-2">20% Monthly Goal</h3>
                <p className="text-sm text-neutral-400">Track progress toward your monthly targets</p>
              </div>
            </div>
          </div>
        </div>
      ) : !stats ? (
        <div className="text-neutral-500">No data yet.</div>
      ) : selectedYear !== 'all' && tradeEntries.length === 0 ? (
        <div className="w-full flex flex-col items-center justify-center min-h-[60vh]">
          <div className="max-w-2xl text-center space-y-6">
            <div className="w-20 h-20 mx-auto bg-neutral-800 rounded-full flex items-center justify-center">
              <CalendarIcon className="w-10 h-10 text-neutral-500" />
            </div>
            <h2 className="text-2xl font-bold text-[#e5e5e5]">No Data for {selectedYear}</h2>
            <p className="text-neutral-400">There are no trades recorded for the year {selectedYear}.</p>
            <button
              onClick={() => setSelectedYear('all')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              View All Time
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full flex flex-col gap-6">
          {/* --- TOP PRIORITY SECTION: Day/Week/Month P&L + Account Balance --- */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 w-full">
            {/* Day P&L */}
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6 flex flex-col items-center justify-center">
              <div className="text-sm font-light mb-2 uppercase tracking-wider text-neutral-400">Today's P&L</div>
              {percentageChanges ? (
                <>
                  <div className={`text-3xl font-bold leading-tight tracking-tight ${percentageChanges.day.pnl > 0 ? 'text-[#10B981]' : percentageChanges.day.pnl < 0 ? 'text-[#EF4444]' : 'text-neutral-300'}`}>
                    {percentageChanges.day.pnl > 0 ? '+' : ''}${percentageChanges.day.pnl.toFixed(2)}
                  </div>
                  <div className={`text-sm font-semibold ${percentageChanges.day.percentage > 0 ? 'text-[#10B981]' : percentageChanges.day.percentage < 0 ? 'text-[#EF4444]' : 'text-neutral-300'}`}>
                    {percentageChanges.day.percentage > 0 ? '+' : ''}{percentageChanges.day.percentage.toFixed(2)}%
                  </div>
                </>
              ) : <div className="text-neutral-500 text-sm">No trades today</div>}
            </div>
            
            {/* Week P&L */}
            <div 
               
               
              
              className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6 flex flex-col items-center justify-center"

            >
              <div className="text-sm font-light mb-2 uppercase tracking-wider text-neutral-400">This Week</div>
              {percentageChanges ? (
                <>
                  <div className={`text-3xl font-bold leading-tight tracking-tight ${percentageChanges.week.pnl > 0 ? 'text-[#10B981]' : percentageChanges.week.pnl < 0 ? 'text-[#EF4444]' : 'text-neutral-300'}`}>
                    {percentageChanges.week.pnl > 0 ? '+' : ''}${percentageChanges.week.pnl.toFixed(2)}
                  </div>
                  <div className={`text-sm font-semibold ${percentageChanges.week.percentage > 0 ? 'text-[#10B981]' : percentageChanges.week.percentage < 0 ? 'text-[#EF4444]' : 'text-neutral-300'}`}>
                    {percentageChanges.week.percentage > 0 ? '+' : ''}{percentageChanges.week.percentage.toFixed(2)}%
                  </div>
                </>
              ) : <div className="text-neutral-500 text-sm">No trades this week</div>}
            </div>
            
            {/* Month P&L */}
            <div 
               
               
              
              className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6 flex flex-col items-center justify-center relative"

            >
              <div className="text-sm font-light mb-2 uppercase tracking-wider text-neutral-400">This Month</div>
              {percentageChanges ? (
                <>
                  <div className={`text-3xl font-bold leading-tight tracking-tight ${percentageChanges.month.pnl > 0 ? 'text-[#10B981]' : percentageChanges.month.pnl < 0 ? 'text-[#EF4444]' : 'text-neutral-300'}`}>
                    {percentageChanges.month.pnl > 0 ? '+' : ''}${percentageChanges.month.pnl.toFixed(2)}
                  </div>
                  <div className={`text-sm font-semibold ${percentageChanges.month.percentage > 0 ? 'text-[#10B981]' : percentageChanges.month.percentage < 0 ? 'text-[#EF4444]' : 'text-neutral-300'}`}>
                    {percentageChanges.month.percentage > 0 ? '+' : ''}{percentageChanges.month.percentage.toFixed(2)}%
                  </div>
                  
                  {/* 20% Goal Progress Bar */}
                  <div className="w-full mt-3">
                    <div className="flex justify-between items-center text-xs text-neutral-400 mb-1">
                      <span>Goal: 20%</span>
                      <span>{currentMonthPerformance ? currentMonthPerformance.progressToward20Percent.toFixed(0) : 0}%</span>
                    </div>
                    <div className="w-full bg-neutral-700 rounded-full h-2 overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ease-out ${
                          currentMonthPerformance && currentMonthPerformance.percentage >= 20 ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 
                          currentMonthPerformance && currentMonthPerformance.percentage >= 10 ? 'bg-gradient-to-r from-yellow-400 to-orange-500' : 
                          'bg-gradient-to-r from-blue-400 to-blue-500'
                        }`}
                        style={{ 
                          width: `${currentMonthPerformance ? currentMonthPerformance.progressToward20Percent : 0}%` 
                        }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-3xl font-bold leading-tight tracking-tight text-neutral-300">$0.00</div>
                  <div className="text-sm font-semibold text-neutral-300">0.00%</div>
                  
                  {/* 20% Goal Progress Bar - Empty State */}
                  <div className="w-full mt-3">
                    <div className="flex justify-between items-center text-xs text-neutral-400 mb-1">
                      <span>Goal: 20%</span>
                      <span>0%</span>
                    </div>
                    <div className="w-full bg-neutral-700 rounded-full h-2">
                      <div className="h-full w-0 bg-gradient-to-r from-blue-400 to-blue-500 transition-all duration-500" />
                    </div>
                  </div>
                </>
              )}
              <div className="text-xs text-neutral-500 mt-1">{now.toLocaleString('default', { month: 'short' })} {currentYear}</div>
            </div>
            
            {/* Overall Performance */}
            <div 
               
               
              
              className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6 flex flex-col items-center justify-center"

            >
              <div className="text-sm font-light mb-2 uppercase tracking-wider text-neutral-400">Overall Performance</div>
              {percentageChanges ? (
                <>
                  <div className={`text-3xl font-bold leading-tight tracking-tight ${percentageChanges.overall.pnl > 0 ? 'text-[#10B981]' : percentageChanges.overall.pnl < 0 ? 'text-[#EF4444]' : 'text-neutral-300'}`}>
                    {percentageChanges.overall.pnl > 0 ? '+' : ''}${percentageChanges.overall.pnl.toFixed(2)}
                  </div>
                  <div className={`text-sm font-semibold ${percentageChanges.overall.percentage > 0 ? 'text-[#10B981]' : percentageChanges.overall.percentage < 0 ? 'text-[#EF4444]' : 'text-neutral-300'}`}>
                    {percentageChanges.overall.percentage > 0 ? '+' : ''}{percentageChanges.overall.percentage.toFixed(2)}%
                  </div>
                </>
              ) : (
                <>
                  <div className="text-3xl font-bold leading-tight tracking-tight text-neutral-300">$0.00</div>
                  <div className="text-sm font-semibold text-neutral-300">0.00%</div>
                </>
              )}
              <div className="text-xs text-neutral-500 mt-1">Trading Performance</div>
            </div>
          </div>

          {/* --- EQUITY CURVE SECTION --- */}
          <div 
             
             
            className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <ChartBarIcon className="w-7 h-7 text-[#3B82F6]" />
                <span className="text-2xl font-bold text-[#e5e5e5] tracking-tight">Equity Curve</span>
              </div>
              <div className="text-right">
                <div className="text-sm font-light text-neutral-400 uppercase tracking-wider">Account Balance</div>
                <div className="flex items-center justify-end gap-2">
                  <div className="text-xl font-bold text-[#10B981]">{currentBalance}</div>
                  <button
                    onClick={() => navigate('/edit-account')}
                    className="p-1 text-neutral-400 hover:text-[#10B981] rounded-md hover:bg-white/5"
                    title="Edit Account Balance"
                    aria-label="Edit account balance"
                  >
                    <PencilIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
            <div className="w-full h-72 flex items-center justify-center">
              <EquityCurveChart points={points} />
            </div>
          </div>

          {/* --- TRADING PERFORMANCE GAUGES --- */}
          <div
            
            
            className="w-full"
          >
            <div className="flex items-center gap-3 mb-6">
              <BoltIcon className="w-7 h-7 text-[#F59E0B]" />
              <span className="text-2xl font-bold text-[#e5e5e5] tracking-tight">Trading Performance</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
              {/* Avg Winning Trade */}
              <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6 flex flex-col items-center justify-center">
                <div className="text-sm font-light mb-2 uppercase tracking-wider text-neutral-400">Avg. Winning Trade</div>
                <div className="text-2xl font-bold leading-tight tracking-tight text-[#10B981]">
                  ${stats.avgWinningTrade?.toFixed(2) || "0.00"}
                </div>
              </div>
              
              {/* Win Rate */}
              <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6 flex flex-col items-center justify-center">
                <div className="text-sm font-light mb-2 uppercase tracking-wider text-neutral-400">Winning Trade %</div>
                <div className="text-2xl font-bold leading-tight tracking-tight text-[#3B82F6]">
                  {stats.winRate?.toFixed(1) || "0.0"}%
                </div>
              </div>
              
              {/* Avg Losing Trade */}
              <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6 flex flex-col items-center justify-center">
                <div className="text-sm font-light mb-2 uppercase tracking-wider text-neutral-400">Avg. Losing Trade</div>
                <div className="text-2xl font-bold leading-tight tracking-tight text-[#EF4444]">
                  ${Math.abs(stats.avgLosingTrade)?.toFixed(2) || "0.00"}
                </div>
              </div>
            </div>
          </div>

          {/* --- KEY STATS SECTION --- */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 w-full">
            <div 
               
               
              
              className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6 flex flex-col items-center justify-center"

            >
              <div className="text-sm font-light mb-2 uppercase tracking-wider text-neutral-400">Total P&L</div>
              <span className={`text-2xl font-bold leading-tight tracking-tight ${stats.totalPnl > 0 ? "text-[#10B981]" : stats.totalPnl < 0 ? "text-[#EF4444]" : "text-neutral-300"}`}>
                {stats.totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div 
               
               
              
              className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6 flex flex-col items-center justify-center"

            >
              <div className="text-sm font-light mb-2 uppercase tracking-wider text-neutral-400">Avg P&L</div>
              <span className="text-2xl font-bold leading-tight tracking-tight text-[#10B981]">
                {stats.avgPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div 
               
               
              
              className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6 flex flex-col items-center justify-center"

            >
              <div className="text-sm font-light mb-2 uppercase tracking-wider text-neutral-400">Avg R:R</div>
              <span className="text-2xl font-bold leading-tight tracking-tight text-[#8B5CF6]">
                {stats.avgRr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div 
               
               
              
              className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6 flex flex-col items-center justify-center"

            >
              <div className="text-sm font-light mb-2 uppercase tracking-wider text-neutral-400">Total Trades</div>
              <div className="text-2xl font-bold leading-tight tracking-tight text-[#3B82F6]">{stats.totalTrades}</div>
            </div>
            <div 
               
               
              
              className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6 flex flex-col items-center justify-center"

            >
              <div className="text-sm font-light mb-2 uppercase tracking-wider text-neutral-400">Payouts</div>
              <div className="text-2xl font-bold leading-tight tracking-tight text-[#F59E0B]">{totalPayouts}</div>
            </div>
          </div>

          {/* --- STREAKS + BEST/WORST TRADES SECTION --- */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
            {/* Streaks */}
            <div 
               
               
              
              className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6 flex flex-col gap-4"

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
            </div>

            {/* Best/Worst Trades */}
            <div className="flex flex-col gap-4">
              {bestTrade && (
                <div 
                  
                  className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6 flex flex-col gap-2"
                  style={{
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(31, 41, 55, 0.8) 100%)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)'
                  }}
                >
                  <div className="text-sm font-light uppercase tracking-wider text-neutral-400">Best Trade</div>
                  <div className="text-2xl font-bold text-[#10B981] leading-tight tracking-tight">{bestTrade.pnl > 0 ? '+' : ''}{bestTrade.pnl}</div>
                  <div className="text-xs text-neutral-500">{bestTrade.tickerTraded} • {parseCreatedDate(bestTrade).toLocaleDateString()}</div>
                </div>
              )}
              {worstTrade && (
                <div 
                  
                  className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6 flex flex-col gap-2"
                  style={{
                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(31, 41, 55, 0.8) 100%)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)'
                  }}
                >
                  <div className="text-sm font-light uppercase tracking-wider text-neutral-400">Worst Trade</div>
                  <div className="text-2xl font-bold text-[#EF4444] leading-tight tracking-tight">{worstTrade.pnl > 0 ? '+' : ''}{worstTrade.pnl}</div>
                  <div className="text-xs text-neutral-500">{worstTrade.tickerTraded} • {parseCreatedDate(worstTrade).toLocaleDateString()}</div>
                </div>
              )}
            </div>
          </div>


        </div>
      )}
    </div>
  );
};

export default SummaryPage; 