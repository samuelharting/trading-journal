import React, { useMemo, useContext } from "react";
import { useNavigate } from "react-router-dom";
import CalendarBox from "../components/CalendarBox";
import { motion } from "framer-motion";
import { UserContext } from "../App";

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

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

const HomePage = () => {
  const { user } = useContext(UserContext);
  const navigate = useNavigate();
  const year = new Date().getFullYear();

  // Aggregate P&L by month
  const monthData = useMemo(() => {
    const entries = getAllJournalEntries(user);
    const data = Array(12).fill(null).map(() => ({ pnl: 0, count: 0 }));
    entries.forEach(entry => {
      if (entry.year == year) {
        const idx = parseInt(entry.month, 10) - 1;
        data[idx].pnl += Number(entry.pnl) || 0;
        data[idx].count += 1;
      }
    });
    return data;
  }, [user, year]);

  return (
    <div className="w-full min-h-screen bg-black pt-20 px-8">
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
              className="flex flex-col items-center justify-center h-48 w-full bg-neutral-900 rounded-2xl shadow-lg cursor-pointer select-none"
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
    </div>
  );
};

export default HomePage; 