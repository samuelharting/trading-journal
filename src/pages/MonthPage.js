import React, { useMemo, useContext, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import CalendarBox from "../components/CalendarBox";
import { motion } from "framer-motion";
import { UserContext } from "../App";
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import Spinner from '../components/MatrixLoader';
import GlitchTitle from '../components/GlitchTitle';
import { CalendarIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { getTradingPerformance } from '../statsUtils';

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const MonthPage = () => {
  const { currentUser, selectedAccount, dataRefreshTrigger } = useContext(UserContext);
  const { year, month } = useParams();
  const navigate = useNavigate();
  const monthIndex = parseInt(month, 10) - 1;
  const monthName = new Date(year, monthIndex).toLocaleString('default', { month: 'long' });
  const daysInMonth = new Date(year, month, 0).getDate();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

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
      setLoading(false);
    };
    fetchEntries();
  }, [currentUser, selectedAccount, year, month, dataRefreshTrigger]);

  useEffect(() => {
    console.log('MonthPage user:', currentUser, 'entries:', entries, 'loading:', loading);
  }, [currentUser, entries, loading]);

  // Aggregate P&L by day
  const dayData = useMemo(() => {
    const data = Array(daysInMonth).fill(null).map(() => ({ pnl: 0, count: 0 }));
    entries.forEach(entry => {
      if (String(entry.year) === String(year) && String(entry.month) === String(month)) {
        const idx = parseInt(entry.day, 10) - 1;
        if (idx >= 0 && idx < daysInMonth) {
          // Only count actual trades (not deposits, payouts, tape reading, or reset-excluded)
          const isActualTrade = !entry.isDeposit && !entry.isPayout && !entry.isTapeReading && !entry.isResetExcluded && entry.pnl !== undefined && entry.pnl !== null && entry.pnl !== "";
          if (isActualTrade) {
            data[idx].pnl += Number(entry.pnl) || 0;
            data[idx].count += 1;
          }
        }
      }
    });
    return data;
  }, [entries, year, month, daysInMonth, selectedAccount]);

  const calendarGrid = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1).getDay();
    const grid = [];
    let week = Array((firstDay + 6) % 7).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      week.push(d);
      if (week.length === 7) {
        grid.push(week);
        week = [];
      }
    }
    if (week.length) grid.push(week);
    return grid;
  }, [year, month, daysInMonth, selectedAccount]);

  // Helper to compute weekly PnL and trade counts for the month
  function getWeeklyPnls(entries, year, month, calendarGrid) {
    // Only entries in the given month that are actual trades
    const filtered = entries.filter(e => 
      String(e.year) === String(year) && 
      String(e.month) === String(month) &&
      !e.isDeposit && 
      !e.isPayout && 
      !e.isTapeReading &&
      !e.isResetExcluded &&
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
        dayPnls[day] = (dayPnls[day] || 0) + (Number(e.pnl) || 0);
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
      return { pnl: sum, count };
    });
  }

  const weeklyPnls = useMemo(() => getWeeklyPnls(entries, year, month, calendarGrid), [entries, year, month, calendarGrid]);

  // Year dropdown: dynamic range based on current year (same as HomePage and CalendarPage)
  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let y = currentYear - 3; y <= currentYear + 2; y++) yearOptions.push(y);

  return (
    <div className="w-full min-h-screen bg-black pt-8 px-8">
      <button
        className="flex items-center gap-2 mb-4 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-[#e5e5e5] rounded shadow"
        onClick={() => navigate('/')}
      >
        <ArrowLeftIcon className="w-5 h-5" />
        Back
      </button>
      {loading ? (
        <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto py-24">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl h-16 w-1/3 animate-pulse mb-4 shadow-2xl" />
          <div className="grid grid-cols-7 gap-8">
            {[...Array(35)].map((_,i) => <div key={i} className="bg-white/10 backdrop-blur-md rounded-xl h-24 animate-pulse shadow-2xl" />)}
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-6 mt-2">
            <CalendarIcon className="w-7 h-7 text-blue-400" />
            <span className="text-3xl font-bold text-[#e5e5e5]">{monthName}</span>
            {/* Year dropdown */}
            <select
              className="ml-2 bg-neutral-900 text-[#e5e5e5] border border-neutral-700 rounded px-2 py-1 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={year}
              onChange={e => navigate(`/month/${e.target.value}/${month}`)}
              style={{ width: 80 }}
            >
              {yearOptions.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            
            {/* Monthly Goal Progress - Inline */}
            {(() => {
              // Use the fixed trading performance calculation
              const monthlyPerformance = getTradingPerformance(entries, year, month);
              
              if (!monthlyPerformance || !monthlyPerformance.hasTrades) {
                return (
                  <div className="flex items-center gap-2 ml-4">
                    <span className="text-sm text-neutral-400">20% Goal:</span>
                    <div className="w-24 bg-neutral-700 rounded-full h-2 relative">
                      <div className="h-full w-0 bg-gradient-to-r from-blue-400 to-blue-500 transition-all duration-500 rounded-full" />
                    </div>
                    <span className="text-xs text-neutral-400 min-w-[32px]">0%</span>
                  </div>
                );
              }
              
              const { percentage, progressToward20Percent } = monthlyPerformance;
              
              return (
                <div className="flex items-center gap-2 ml-4">
                  <span className="text-sm text-neutral-400">20% Goal:</span>
                  <div className="w-24 bg-neutral-700 rounded-full h-2 relative">
                    <div 
                      className={`h-full transition-all duration-500 ease-out rounded-full ${
                        percentage >= 20 ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 
                        percentage >= 10 ? 'bg-gradient-to-r from-yellow-400 to-orange-500' : 
                        'bg-gradient-to-r from-blue-400 to-blue-500'
                      }`}
                      style={{ width: `${progressToward20Percent}%` }}
                    />
                  </div>
                  <span className="text-xs text-neutral-400 min-w-[32px]">{progressToward20Percent.toFixed(0)}%</span>
                </div>
              );
            })()}
            
            <div className="flex-1 border-b border-white/10 ml-4" />
          </div>
          <div className="w-full">
            <div className="grid grid-cols-7 mb-2">
              {weekdays.map(w => (
                <div key={w} className="text-center text-[#e5e5e5] font-bold pb-2 text-base tracking-wide">{w}</div>
              ))}
              <div className="text-center text-[#e5e5e5] font-bold pb-2 text-base tracking-wide">Week PnL</div>
            </div>
            {calendarGrid.map((weekArr, weekIdx) => {
              // Only render if the week has at least one real day in the month
              const hasRealDay = weekArr.some(day => !!day);
              if (!hasRealDay) return null;
              return (
                <div key={weekIdx} className="grid grid-cols-8 gap-8 items-center mb-2">
                  {weekArr.map((day, idx) => {
                    if (!day) return <div key={idx} className="" />;
                    const { pnl, count } = dayData[day - 1];
                    let color = "gray", status = "no-trades";
                    if (count > 0) {
                      if (pnl > 0) { color = "green"; status = "trades"; }
                      else if (pnl < 0) { color = "red"; status = "trades"; }
                      else { color = "gray"; status = "trades"; }
                    }
                    return (
                      <CalendarBox
                        key={idx}
                        label={<span className="text-2xl font-bold flex items-center justify-center h-full w-full">{day}</span>}
                        color={color}
                        pnl={pnl}
                        status={status}
                        tradeCount={count}
                        onClick={() => navigate(`/day/${month}/${day}`)}
                        delay={weekIdx * 0.02 + idx * 0.01}
                      />
                    );
                  })}
                  {/* Fill out the rest of the 7 columns if weekArr is short */}
                  {Array.from({ length: 7 - weekArr.length }).map((_, i) => (
                    <div key={`empty-${i}`} className="" />
                  ))}
                  {/* Weekly PnL pill */}
                  <div className="flex justify-center items-center h-full">
                    {(() => {
                      const { pnl, count } = weeklyPnls[weekIdx];
                      let bg = 'bg-neutral-800', text = 'text-neutral-200', icon = null, shadow = '';
                      if (pnl > 0) {
                        bg = 'bg-green-800'; text = 'text-green-200'; shadow = 'shadow-green-500/30';
                        icon = (
                          <svg className="w-4 h-4 inline-block mr-1 -mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                        );
                      } else if (pnl < 0) {
                        bg = 'bg-red-900'; text = 'text-red-200'; shadow = 'shadow-red-500/30';
                        icon = (
                          <svg className="w-4 h-4 inline-block mr-1 -mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                        );
                      }
                      return (
                        <div className={`px-3 py-2 rounded-full font-bold text-sm flex flex-col items-center justify-center min-w-[80px] ${bg} ${text} ${shadow} transition-all duration-200`} style={{ boxShadow: shadow ? `0 0 12px 2px ${shadow.split('-')[1]}` : undefined }}>
                          <div className="flex items-center">
                            {icon}
                            {pnl > 0 ? '+' : pnl < 0 ? '' : ''}{typeof pnl === 'number' ? pnl.toFixed(2) : '0.00'}
                          </div>
                          {count > 0 && (
                            <div className="text-xs opacity-80 mt-1">
                              {count} trade{count !== 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default MonthPage; 