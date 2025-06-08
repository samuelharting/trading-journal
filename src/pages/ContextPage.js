import React, { useEffect, useState, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserContext } from "../App";
import { CheckIcon } from '@heroicons/react/24/solid';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import Spinner from '../components/MatrixLoader';

const CONTEXT_CLEARED_KEY = "contextCleared";

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

  useEffect(() => {
    let text = "";
    const sortedEntries = [...entries].sort((a, b) => new Date(b.created) - new Date(a.created));
    sortedEntries.forEach(entry => {
      const date = new Date(entry.created);
      const dateStr = date.toLocaleDateString();
      text += `=== ${dateStr} ===\n`;
      text += entryToText(entry) + "\n\n";
    });
    setCombinedText(text.trim());
  }, [entries]);

  const handleCopy = () => {
    navigator.clipboard.writeText(combinedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const handleClear = () => {
    setCombinedText("");
    sessionStorage.removeItem(CONTEXT_CLEARED_KEY);
  };

  return (
    <div className="w-full min-h-screen bg-black pt-20 px-8">
      <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto">
        <div className="flex gap-4 mb-4">
          <button onClick={handleCopy} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded shadow flex items-center gap-2">
            {copied ? <CheckIcon className="w-5 h-5 text-green-300" /> : null}
            {copied ? "Copied!" : "Copy All"}
          </button>
          <button onClick={handleClear} className="bg-neutral-800 hover:bg-neutral-700 text-white px-6 py-2 rounded shadow">Clear Context</button>
        </div>
        {loading ? <div className="flex justify-center items-center py-24"><Spinner size={48} /></div> : (
        <textarea
          className="w-full h-[60vh] bg-neutral-900 text-[#e5e5e5] p-6 rounded-lg border-none shadow-lg text-lg font-mono"
          value={combinedText}
          readOnly
        />
        )}
      </div>
    </div>
  );
};

export default ContextPage; 