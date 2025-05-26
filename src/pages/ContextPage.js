import React, { useEffect, useState, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserContext } from "../App";
import { CheckIcon } from '@heroicons/react/24/solid';

function getAllJournalEntries(user) {
  const entries = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(`journal-${user}-`)) {
      try {
        const dayEntries = JSON.parse(localStorage.getItem(key));
        if (Array.isArray(dayEntries)) {
          dayEntries.forEach(entry => {
            entries.push(entry);
          });
        }
      } catch {}
    }
  }
  // Sort by created date ascending
  return entries.sort((a, b) => new Date(a.created) - new Date(b.created));
}

function entryToText(entry) {
  return [
    `Ticker: ${entry.tickerTraded}`,
    `P&L: ${entry.pnl}`,
    `R:R: ${entry.rr}`,
    `Grade: ${entry.grade}`,
    `Session: ${entry.session}`,
    `Liquidity Sweep: ${entry.liquiditySweep}`,
    `Account Balance: ${entry.accountBalance}`,
    `Duration: ${entry.duration}`,
    `Entry Time: ${entry.entryTime}`,
    `Exit Time: ${entry.exitTime}`,
    `How I Felt Before: ${entry.howFeltBefore}`,
    `Premarket Analysis: ${entry.premarketAnalysis}`,
    `How I Felt During: ${entry.howFeltDuring}`,
    `How I Felt After: ${entry.howFeltAfter}`,
    `Notes: ${entry.notes}`
  ].join("\n");
}

const ContextPage = () => {
  const { user } = useContext(UserContext);
  const [combinedText, setCombinedText] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    const allEntries = getAllJournalEntries(user);
    let text = "";
    // Show newest entries first
    allEntries.slice().reverse().forEach(entry => {
      const date = new Date(entry.created);
      const dateStr = date.toLocaleDateString();
      text += `=== ${dateStr} ===\n`;
      text += entryToText(entry) + "\n\n";
    });
    setCombinedText(text.trim());
  }, [user]);

  const handleCopy = () => {
    navigator.clipboard.writeText(combinedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const handleClear = () => {
    setCombinedText("");
  };

  return (
    <div className="w-full min-h-screen bg-black pt-20 px-0">
      <h2 className="text-3xl font-bold mb-8 text-[#e5e5e5]">All Context</h2>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-6xl mx-auto bg-neutral-900 rounded-md p-10 gap-8 text-[#e5e5e5] border-none shadow-none"
      >
        <div className="flex gap-4 mb-4 justify-end items-center">
          <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.98 }} onClick={handleCopy} className="bg-neutral-800 hover:bg-neutral-700 text-[#e5e5e5] px-6 py-3 rounded-md text-lg font-bold transition-all border-none outline-none shadow-none flex items-center gap-2">
            Copy All
            <AnimatePresence>
              {copied && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center gap-1 ml-2 text-green-400"
                >
                  <CheckIcon className="w-5 h-5" />
                  <span className="text-base font-semibold">Copied!</span>
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.98 }} onClick={handleClear} className="bg-neutral-900 hover:bg-neutral-800 text-[#e5e5e5] px-6 py-3 rounded-md text-lg transition-all border-none outline-none shadow-none">Clear Context</motion.button>
        </div>
        <textarea
          className="w-full h-[70vh] bg-black text-[#e5e5e5] rounded-md p-6 text-base font-mono resize-none focus:outline-none focus:ring-2 focus:ring-neutral-700 border-none shadow-none"
          value={combinedText}
          readOnly
          spellCheck={false}
        />
      </motion.div>
    </div>
  );
};

export default ContextPage; 