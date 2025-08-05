import React, { useState } from "react";
import { motion } from "framer-motion";
import { XMarkIcon, DocumentTextIcon } from "@heroicons/react/24/solid";

const fieldLabel = {
  tickerTraded: "Ticker",
  pnl: "P&L",
  rr: "R:R",
  accountBalance: "Account Balance",
  duration: "Duration",
  entryTime: "Entry Time",
  exitTime: "Exit Time",
  grade: "Grade",
  session: "Session",
  liquiditySweep: "Liquidity Sweep",
  howFeltBefore: "How I Felt Before",
  premarketAnalysis: "Premarket Analysis",
  howFeltDuring: "How I Felt During",
  howFeltAfter: "How I Felt After",
  notes: "Notes",
};

const JournalEntryList = ({ entries, loading }) => {
  const [modal, setModal] = useState({ open: false, src: null });
  if (loading) {
    return (
      <div className="flex flex-col gap-6 w-full max-w-3xl mx-auto py-12">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl h-12 w-1/3 animate-pulse mb-4 shadow-2xl" />
        {[...Array(3)].map((_,i) => <div key={i} className="bg-white/10 backdrop-blur-md rounded-xl h-40 animate-pulse shadow-2xl" />)}
      </div>
    );
  }
  if (!entries.length) {
    return <div className="text-gray-400 mb-4">No entries for this day yet.</div>;
  }
  return (
    <>
      {modal.open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-lg"
          onClick={() => setModal({ open: false, src: null })}
        >
          <motion.img
            src={modal.src}
            alt="Screenshot Fullscreen"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl border-4 border-white/10 object-contain bg-black/80"
            onClick={e => e.stopPropagation()}
          />
          <button
            className="absolute top-8 right-8 text-white bg-black/60 hover:bg-black/80 rounded-full p-3 z-50"
            onClick={() => setModal({ open: false, src: null })}
            aria-label="Close fullscreen"
          >
            <XMarkIcon className="w-8 h-8" />
          </button>
        </motion.div>
      )}
      <div className="flex items-center gap-3 mb-6 mt-2">
        <DocumentTextIcon className="w-7 h-7 text-blue-400" />
        <span className="text-2xl font-bold text-[#e5e5e5]">Journal Entries</span>
        <div className="flex-1 border-b border-white/10 ml-4" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6 w-full max-w-full mb-12 px-4">
        {entries.map((entry, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.01, backgroundColor: '#18181b', boxShadow: '0 4px 32px #38bdf8aa' }}
            transition={{ duration: 0.3, delay: idx * 0.05 }}
            className="bg-white/10 backdrop-blur-md rounded-xl p-4 flex flex-col gap-3 border border-white/10 shadow-2xl text-[#e5e5e5] min-h-[220px] transition-all duration-200 relative"
          >
            <div className="text-sm font-bold mb-2 text-center">
              {entry.isDeposit ? 'DEPOSIT' : entry.isPayout ? 'PAYOUT' : entry.isTapeReading ? 'TAPE READ' : 'TRADE'}
            </div>
            {(entry.tickerTraded || (!entry.isDeposit && !entry.isPayout)) && (
              <div className="text-base font-semibold mb-2">
                <span className="text-gray-400">{fieldLabel.tickerTraded}:</span> <span>{entry.tickerTraded || 'N/A'}</span>
              </div>
            )}
            <div className="text-lg font-bold mb-2">
              <span className="text-gray-400">{fieldLabel.pnl}:</span> <span className={entry.pnl > 0 ? "text-green-400" : entry.pnl < 0 ? "text-red-400" : "text-gray-100"}>{entry.pnl > 0 ? "+" : ""}{entry.pnl}</span>
            </div>
            {entry.screenshots && entry.screenshots.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-1">
                {entry.screenshots.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt="Screenshot"
                    className="w-16 h-16 object-cover rounded border-none cursor-pointer transition-transform duration-200 hover:scale-105 hover:shadow-xl"
                    onClick={() => setModal({ open: true, src })}
                  />
                ))}
              </div>
            )}
            {entry.notes && <div className="text-xs text-gray-300 line-clamp-2">{entry.notes}</div>}
          </motion.div>
        ))}
      </div>
    </>
  );
};

export default JournalEntryList; 