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
  const year = new Date().getFullYear();
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

  // Aggregate P&L by month
  const monthData = useMemo(() => {
    const data = Array(12).fill(null).map(() => ({ pnl: 0, count: 0 }));
    entries.forEach(entry => {
      if (entry.year == year || String(entry.year) === String(year) || entry.month) {
        const idx = parseInt(entry.month, 10) - 1;
        if (idx >= 0 && idx < 12) {
          data[idx].pnl += Number(entry.pnl) || 0;
          data[idx].count += 1;
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
            <span className="text-3xl font-bold text-[#e5e5e5]">{year} Overview</span>
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
                <motion.div
                  key={month}
                  whileHover={{ scale: 1.06, boxShadow: "0 0 0 4px #38bdf8" }}
                  transition={{ type: "spring", stiffness: 300 }}
                  className="flex flex-col items-center justify-center h-48 w-full bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl cursor-pointer select-none"
                  onClick={() => navigate(`/month/${year}/${idx + 1}`)}
                >
                  <span className="text-2xl font-bold mb-2">{month}</span>
                  <span className="text-lg text-neutral-500 mb-2">{idx + 1}</span>
                  <span className={
                    color === "green"
                      ? "text-green-400 text-xl font-bold"
                      : color === "red"
                      ? "text-red-400 text-xl font-bold"
                      : "text-neutral-400 text-xl font-bold"
                  }>
                    {pnl > 0 ? "+" : ""}{pnl.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </motion.div>
              );
            })}
          </motion.div>
        </>
      )}
    </div>
  );
};

export default HomePage; 