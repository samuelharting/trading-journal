import React, { useEffect, useState, useContext, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserContext } from "../App";
import { CheckIcon } from '@heroicons/react/24/solid';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import Spinner from '../components/MatrixLoader';

const CONTEXT_CLEARED_KEY = "contextCleared";

function entryToText(entry) {
  // Handle tape reading entries
  if (entry.tapeReading) {
    return `Tape Reading: ${entry.notes || '(blank)'}`;
  }
  // Handle deposit entries
  if (entry.isDeposit) {
    return `Account Balance: $${entry.accountBalance || 0} - ${entry.notes || '(blank)'}`;
  }
  // Handle payout entries
  if (entry.isPayout) {
    return `Payout: $${Math.abs(entry.pnl || 0)} - Account Balance: $${entry.accountBalance || 0} - ${entry.notes || '(blank)'}`;
  }
  // Modern trade entry fields only
  let lines = [];
  lines.push(`Ticker: ${entry.tickerTraded || '(blank)'}`);
  lines.push(`Entry Time: ${entry.entryTime || '(blank)'}`);
  lines.push(`Exit Time: ${entry.exitTime || '(blank)'}`);
  lines.push(`P&L: ${entry.pnl !== undefined && entry.pnl !== '' ? entry.pnl : '(blank)'}`);
  lines.push(`R:R: ${entry.rr !== undefined && entry.rr !== '' ? entry.rr : '(blank)'}`);
  lines.push(`Premarket Expectations: ${entry.premarketAnalysis || '(blank)'}`);
  lines.push(`Economic Release: ${entry.economicRelease || '(blank)'}`);
  lines.push(`Day of the Week: ${entry.dayOfWeek || '(blank)'}`);
  lines.push(`Daily High/Low Taken: ${entry.dailyHighLowTaken === true || entry.dailyHighLowTaken === 'true' ? 'Yes' : 'No'}`);
  lines.push(`00:00 Open: ${entry.aboveBelow0000 === 'above' ? 'Above' : 'Below'}`);
  lines.push(`8:30 Open: ${entry.aboveBelow0830 === 'above' ? 'Above' : 'Below'}`);
  lines.push(`9:30 Open: ${entry.aboveBelow0930 === 'above' ? 'Above' : 'Below'}`);
  lines.push(`Macro Range: ${entry.macroRange === true || entry.macroRange === 'true' ? 'Yes' : 'No'}`);
  lines.push(`Judas Swing: ${entry.judasSwing === true || entry.judasSwing === 'true' ? 'Yes' : 'No'}`);
  lines.push(`Silver Bullet: ${entry.silverBullet === true || entry.silverBullet === 'true' ? 'Yes' : 'No'}`);
  lines.push(`Clear Manipulation: ${entry.manipulation === true || entry.manipulation === 'true' ? 'Yes' : 'No'}`);
  lines.push(`SMT: ${entry.smt === true || entry.smt === 'true' ? 'Yes' : 'No'}`);
  lines.push(`POI: ${entry.poi || '(blank)'}`);
  lines.push(`Account Balance: ${entry.accountBalance !== undefined && entry.accountBalance !== '' ? entry.accountBalance : '(blank)'}`);
  lines.push(`Notes: ${entry.notes || '(blank)'}`);
  return lines.join("\n");
}

const ContextPage = () => {
  const { currentUser, selectedAccount } = useContext(UserContext);
  const [combinedText, setCombinedText] = useState("");
  const [copied, setCopied] = useState(false);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser || !selectedAccount) return;
    // Clear cached context on account switch
    sessionStorage.removeItem(CONTEXT_CLEARED_KEY);
    const fetchEntries = async () => {
      setLoading(true);
      const { db } = await import('../firebase');
      const { collection, getDocs, query, orderBy } = await import('firebase/firestore');
      const entriesCol = collection(db, 'users', currentUser.uid, 'accounts', selectedAccount.id, 'entries');
      const q = query(entriesCol, orderBy('created', 'desc'));
      // Force server fetch
      const snap = await getDocs(q, { source: 'server' });
      const data = snap.docs.map(doc => doc.data());
      setEntries(data);
      setLoading(false);
    };
    fetchEntries();
  }, [currentUser, selectedAccount]);

  const sortedEntries = useMemo(() => {
    const arr = [...entries].sort((a, b) => new Date(b.created) - new Date(a.created));
    console.log('ContextPage sortedEntries:', arr.map(e => e.created));
    return arr;
  }, [entries]);

  useEffect(() => {
    let text = "";
    sortedEntries.forEach(entry => {
      const date = new Date(entry.created);
      const dateStr = date.toLocaleDateString();
      text += `=== ${dateStr} ===\n`;
      text += entryToText(entry) + "\n\n";
    });
    setCombinedText(text.trim());
  }, [sortedEntries]);

  const handleCopy = () => {
    navigator.clipboard.writeText(combinedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const handleClear = () => {
    setCombinedText("");
    sessionStorage.removeItem(CONTEXT_CLEARED_KEY);
  };

  // Manual refresh handler
  const handleManualRefresh = async () => {
    if (!currentUser || !selectedAccount) return;
    setLoading(true);
    const { db } = await import('../firebase');
    const { collection, getDocs, query, orderBy } = await import('firebase/firestore');
    const entriesCol = collection(db, 'users', currentUser.uid, 'accounts', selectedAccount.id, 'entries');
    const q = query(entriesCol, orderBy('created', 'desc'));
    const snap = await getDocs(q, { source: 'server' });
    const data = snap.docs.map(doc => doc.data());
    setEntries(data);
    setLoading(false);
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
          <button onClick={handleManualRefresh} className="bg-blue-900 hover:bg-blue-800 text-white px-6 py-2 rounded shadow">Refresh</button>
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