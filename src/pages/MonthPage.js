import React, { useMemo, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import CalendarBox from "../components/CalendarBox";
import { motion } from "framer-motion";
import { UserContext } from "../App";

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getAllJournalEntries(user) {
  const entries = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(`journal-${user}-`)) {
      try {
        const dayEntries = JSON.parse(localStorage.getItem(key));
        if (Array.isArray(dayEntries)) {
          const [_, __, year, month, day] = key.split("-");
          dayEntries.forEach(entry => {
            entries.push({ ...entry, year, month, day });
          });
        }
      } catch {}
    }
  }
  return entries;
}

function getCalendarGrid(year, month) {
  const firstDay = new Date(year, month - 1, 1);
  // JS: 0=Sun, 1=Mon, ..., 6=Sat. We want 0=Mon, 6=Sun
  let start = firstDay.getDay();
  if (start === 0) start = 6; // Sunday to end
  else start = start - 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  const grid = [];
  let day = 1;
  for (let i = 0; i < 6; i++) { // max 6 rows
    const row = [];
    for (let j = 0; j < 7; j++) {
      if ((i === 0 && j < start) || day > daysInMonth) {
        row.push(null);
      } else {
        row.push(day);
        day++;
      }
    }
    grid.push(row);
    if (day > daysInMonth) break;
  }
  return grid;
}

const MonthPage = () => {
  const { user } = useContext(UserContext);
  const { year, month } = useParams();
  const navigate = useNavigate();
  const monthIndex = parseInt(month, 10) - 1;
  const monthName = new Date(year, monthIndex).toLocaleString('default', { month: 'long' });
  const daysInMonth = new Date(year, month, 0).getDate();

  // Aggregate P&L by day
  const dayData = useMemo(() => {
    const entries = getAllJournalEntries(user);
    const data = Array(daysInMonth).fill(null).map(() => ({ pnl: 0, count: 0 }));
    entries.forEach(entry => {
      if (entry.year == year && entry.month == month) {
        const idx = parseInt(entry.day, 10) - 1;
        data[idx].pnl += Number(entry.pnl) || 0;
        data[idx].count += 1;
      }
    });
    return data;
  }, [user, year, month, daysInMonth]);

  const calendarGrid = useMemo(() => getCalendarGrid(year, month), [year, month]);

  return (
    <div className="w-full min-h-screen bg-black pt-20 px-8">
      <button className="mb-6 text-neutral-500 hover:text-[#e5e5e5] text-lg" onClick={() => navigate(-1)}>&larr; Back</button>
      <h2 className="text-3xl font-bold mb-8 text-[#e5e5e5]">{monthName} {year}</h2>
      <div className="w-full">
        <div className="grid grid-cols-7 mb-2">
          {weekdays.map(w => (
            <div key={w} className="text-center text-[#e5e5e5] font-bold pb-2 text-base tracking-wide">{w}</div>
          ))}
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-8 w-full"
        >
          {calendarGrid.flat().map((day, idx) => {
            if (!day) return <div key={idx} />;
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
                onClick={() => navigate(`/day/${month}/${day}`)}
                delay={idx * 0.02}
              />
            );
          })}
        </motion.div>
      </div>
    </div>
  );
};

export default MonthPage; 