import React, { useMemo, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import CalendarBox from "../components/CalendarBox";
import { motion } from "framer-motion";
import { UserContext } from "../App";
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import Spinner from '../components/MatrixLoader';
import GlitchTitle from '../components/GlitchTitle';
import { CalendarIcon } from '@heroicons/react/24/outline';

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const HomePage = () => {
  const { user } = useContext(UserContext);
  const navigate = useNavigate();
  // Year dropdown logic: always start at 2025, go up to max(current year + 1, selected year, 2026)
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const maxYear = Math.max(currentYear + 1, year, 2026); // always show at least 2026 and next year
  const yearOptions = [];
  for (let y = 2025; y <= maxYear; y++) yearOptions.push(y);
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

  // Aggregate P&L and trade counts by month
  const monthData = useMemo(() => {
    const data = Array(12).fill(null).map(() => ({ pnl: 0, count: 0 }));
    entries.forEach(entry => {
      if (String(entry.year) === String(year)) {
        const idx = parseInt(entry.month, 10) - 1;
        if (idx >= 0 && idx < 12) {
          data[idx].pnl += Number(entry.pnl) || 0;
          
          // Only count actual trades (not deposits, payouts, or tape reading)
          const isActualTrade = !entry.isDeposit && !entry.isPayout && !entry.isTapeReading && entry.pnl !== undefined;
          if (isActualTrade) {
            data[idx].count += 1;
          }
        }
      }
    });
    return data;
  }, [entries, year]);

  return (
    <div className="w-full min-h-screen bg-black pt-20 px-8">
      {loading ? (
        <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto py-24">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl h-16 w-1/3 animate-pulse mb-4 shadow-2xl" />
          <div className="grid grid-cols-6 gap-10">
            {[...Array(12)].map((_,i) => <div key={i} className="bg-white/10 backdrop-blur-md rounded-xl h-48 animate-pulse shadow-2xl" />)}
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-6 mt-2">
            <CalendarIcon className="w-7 h-7 text-blue-400" />
            {/* Year dropdown */}
            <select
              className="ml-2 bg-neutral-900 text-[#e5e5e5] border border-neutral-700 rounded px-2 py-1 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              style={{ width: 80 }}
            >
              {yearOptions.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <span className="text-3xl font-bold text-[#e5e5e5]"> Overview</span>
            <div className="flex-1 border-b border-white/10 ml-4" />
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7 }}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-10 w-full"
          >
            {months.map((month, idx) => {
              const { pnl, count } = monthData[idx];
              let color = "gray", status = "no-trades";
              if (count > 0) {
                if (pnl > 0) { color = "green"; status = "trades"; }
                else if (pnl < 0) { color = "red"; status = "trades"; }
                else { color = "gray"; status = "trades"; }
              }
              return (
                <CalendarBox
                  key={month}
                  label={<span className="text-2xl font-bold flex items-center justify-center h-full w-full">{month}</span>}
                  color={color}
                  pnl={pnl}
                  status={status}
                  tradeCount={count}
                  onClick={() => navigate(`/month/${year}/${idx + 1}`)}
                  delay={idx * 0.03}
                />
              );
            })}
          </motion.div>
        </>
      )}
    </div>
  );
};

export default HomePage; 