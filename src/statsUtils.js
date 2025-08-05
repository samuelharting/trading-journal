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