import React, { useMemo, useContext, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import CalendarBox from "../components/CalendarBox";
import { motion } from "framer-motion";
import { UserContext } from "../App";
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import Spinner from '../components/MatrixLoader';
import GlitchTitle from '../components/GlitchTitle';
import { CalendarIcon } from '@heroicons/react/24/outline';

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const MonthPage = () => {
  const { user } = useContext(UserContext);
  const { year, month } = useParams();
  const navigate = useNavigate();
  const monthIndex = parseInt(month, 10) - 1;
  const monthName = new Date(year, monthIndex).toLocaleString('default', { month: 'long' });
  const daysInMonth = new Date(year, month, 0).getDate();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchEntries = async () => {
      setLoading(true);
      const entriesCol = collection(db, 'journalEntries', user, 'entries');
      const snap = await getDocs(entriesCol);
      const data = snap.docs.map(doc => doc.data());
      setEntries(data);
      setLoading(false);
    };
    fetchEntries();
  }, [user]);

  // Aggregate P&L by day
  const dayData = useMemo(() => {
    const data = Array(daysInMonth).fill(null).map(() => ({ pnl: 0, count: 0 }));
    entries.forEach(entry => {
      if ((entry.year == year || String(entry.year) === String(year)) && entry.month == month) {
        const idx = parseInt(entry.day, 10) - 1;
        if (idx >= 0 && idx < daysInMonth) {
          data[idx].pnl += Number(entry.pnl) || 0;
          data[idx].count += 1;
        }
      }
    });
    return data;
  }, [entries, year, month, daysInMonth]);

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
  }, [year, month, daysInMonth]);

  return (
    <div className="w-full min-h-screen bg-black pt-8 px-8">
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
            <span className="text-3xl font-bold text-[#e5e5e5]">{monthName} {year}</span>
            <div className="flex-1 border-b border-white/10 ml-4" />
          </div>
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
        </>
      )}
    </div>
  );
};

export default MonthPage; 