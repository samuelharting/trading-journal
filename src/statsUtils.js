// src/statsUtils.js

// Get daily PnL for a given year and month
export function getDailyPnl(entries, year, month) {
  const byDay = {};
  // Only count actual trades (not deposits, payouts, or tape reading)
  entries.filter(e => 
    String(e.year) === String(year) && 
    String(e.month) === String(month) &&
    !e.isDeposit && 
    !e.isPayout && 
    !e.isTapeReading &&
    e.pnl !== undefined &&
    e.pnl !== null &&
    e.pnl !== ""
  ).forEach(entry => {
    const d = new Date(entry.created);
    const day = d.toLocaleDateString();
    const pnlValue = Number(entry.pnl) || 0;
    byDay[day] = Math.round(((byDay[day] || 0) + pnlValue) * 100) / 100;
  });
  return byDay;
}

// Get weekly PnL for a given year and month, using a calendar grid
export function getWeeklyPnls(entries, year, month, calendarGrid) {
  // Only entries in the given month that are actual trades
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
  // Build a map day->PnL and day->count
  const dayPnls = {};
  const dayCounts = {};
  filtered.forEach(e => {
    const day = parseInt(e.day, 10);
    if (!isNaN(day)) {
      const pnlValue = Number(e.pnl) || 0;
      dayPnls[day] = Math.round(((dayPnls[day] || 0) + pnlValue) * 100) / 100;
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    }
  });
  // For each week in the grid, sum the PnL and count for the days in that week
  return calendarGrid.map(weekArr => {
    let sum = 0;
    let count = 0;
    weekArr.forEach(day => {
      if (day && dayPnls[day]) {
        sum += dayPnls[day];
        count += dayCounts[day] || 0;
      }
    });
    return { pnl: Math.round(sum * 100) / 100, count };
  });
}

// Get monthly PnL for a given year and month
export function getMonthlyPnl(entries, year, month) {
  const result = entries.filter(e => 
    String(e.year) === String(year) && 
    String(e.month) === String(month) &&
    !e.isDeposit && 
    !e.isPayout && 
    !e.isTapeReading &&
    e.pnl !== undefined &&
    e.pnl !== null &&
    e.pnl !== ""
  ).reduce((sum, e) => sum + (Number(e.pnl) || 0), 0);
  return Math.round(result * 100) / 100;
}

// Precision-safe sum function
function sumPrecise(arr) {
  return arr.reduce((sum, v) => sum + Math.round(Number(v) * 100), 0) / 100;
}

// Calculate trading performance percentages (fixed logic from SummaryPage)
export function getTradingPerformance(entries, targetYear = null, targetMonth = null) {
  if (!entries.length) return null;
  
  // Sort all entries chronologically
  const sortedEntries = [...entries].sort((a, b) => {
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
  
  const startingCapital = totalDeposits + totalPayouts; // totalPayouts is negative, so this subtracts
  
  // If specific year/month requested, filter trades to that period
  let tradesToAnalyze = sortedEntries.filter(e => !e.isDeposit && !e.isPayout && !e.isTapeReading);
  
  if (targetYear !== null && targetMonth !== null) {
    tradesToAnalyze = tradesToAnalyze.filter(e => 
      String(e.year) === String(targetYear) && String(e.month) === String(targetMonth)
    );
  }
  
  // Calculate total trading P&L for the period
  const tradingPnl = sumPrecise(tradesToAnalyze.map(e => Number(e.pnl) || 0));
  
  // Calculate performance percentage
  const performancePercentage = startingCapital > 0 ? (tradingPnl / startingCapital) * 100 : 0;
  
  return {
    pnl: tradingPnl,
    percentage: performancePercentage,
    startingCapital: startingCapital,
    progressToward20Percent: Math.min(100, Math.max(0, (performancePercentage / 20) * 100)),
    hasTrades: tradesToAnalyze.length > 0
  };
}

// Get the current account balance using the logic from SummaryPage
export function getCurrentBalance(entries) {
  if (!entries.length) return { balance: '0.00', totalDeposits: '0.00', totalPayouts: '0.00' };
  const sorted = [...entries].sort((a, b) => new Date(a.created) - new Date(b.created));
  let bal = 0;
  let totalDeposits = 0;
  let totalPayouts = 0;
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    if (e.isDeposit) {
      // For deposits, add the deposit amount to the current balance
      const depositAmount = Number(e.pnl) || 0;
      bal += depositAmount;
      totalDeposits += depositAmount;
    } else if (e.isPayout) {
      // For payouts, add the payout amount (pnl is stored as negative)
      const payoutAmount = Number(e.pnl) || 0; // Already negative
      bal += payoutAmount;
      totalPayouts += Math.abs(payoutAmount);
    } else if (!e.isTapeReading) {
      // For trades, add the P&L to the previous balance
      bal += Number(e.pnl) || 0;
    }
    // Tape reading entries don't affect balance
  }
  return {
    balance: (Math.round(bal * 100) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 }),
    totalDeposits: (Math.round(totalDeposits * 100) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 }),
    totalPayouts: (Math.round(totalPayouts * 100) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })
  };
} 