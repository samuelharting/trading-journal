import React, { useEffect, useState, useContext, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserContext } from "../App";
import { 
  CheckIcon, 
  ClipboardDocumentIcon, 
  TrashIcon, 
  ArrowPathIcon,
  DocumentTextIcon
} from '@heroicons/react/24/solid';
import { DocumentTextIcon as DocumentTextOutline } from '@heroicons/react/24/outline';
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
  lines.push(`Economic Release: ${entry.economicRelease || '(blank)'}`);
  
  // Auto-calculate day of the week from the date
  let dayOfWeek = '(blank)';
  
  // Try to use month/day fields first (more reliable)
  if (entry.month && entry.day) {
    const year = entry.year || new Date().getFullYear();
    const month = parseInt(entry.month) - 1; // JS months are 0-indexed
    const day = parseInt(entry.day);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      dayOfWeek = days[date.getDay()];
    }
  }
  
  // Fallback to parsing created timestamp
  if (dayOfWeek === '(blank)' && entry.created) {
    try {
      // Handle the timestamp format that includes random suffix
      const timestamp = entry.created.split('-')[0]; // Remove the random suffix
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        dayOfWeek = days[date.getDay()];
      }
    } catch (e) {
      console.error('Error parsing date:', e);
    }
  }
  lines.push(`Day of the Week: ${dayOfWeek}`);
  
  lines.push(`Daily High/Low Taken: ${entry.dailyHighLowTaken === true || entry.dailyHighLowTaken === 'true' ? 'Yes' : 'No'}`);
  lines.push(`00:00 Open: ${entry.aboveBelow0000 === 'above' ? 'Aligned' : 'Not Aligned'}`);
  lines.push(`8:30 Open: ${entry.aboveBelow0830 === 'above' ? 'Aligned' : 'Not Aligned'}`);
  lines.push(`9:30 Open: ${entry.aboveBelow0930 === 'above' ? 'Aligned' : 'Not Aligned'}`);
  lines.push(`Macro: ${entry.macroRange === true || entry.macroRange === 'true' ? 'Yes' : 'No'}`);
  lines.push(`Judas Swing: ${entry.judasSwing === true || entry.judasSwing === 'true' ? 'Yes' : 'No'}`);
  lines.push(`Silver Bullet: ${entry.silverBullet === true || entry.silverBullet === 'true' ? 'Yes' : 'No'}`);
  lines.push(`Clear Manipulation: ${entry.manipulation === true || entry.manipulation === 'true' ? 'Yes' : 'No'}`);
  lines.push(`SMT: ${entry.smt === true || entry.smt === 'true' ? 'Yes' : 'No'}`);
  lines.push(`POI: ${entry.poi || '(blank)'}`);
  lines.push(`Notes: ${entry.notes || '(blank)'}`);
  return lines.join("\n");
}

const ContextPage = () => {
  const { currentUser, selectedAccount } = useContext(UserContext);
  const [combinedText, setCombinedText] = useState("");
  const [copied, setCopied] = useState(false);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [entryCount, setEntryCount] = useState(0);
  const [characterCount, setCharacterCount] = useState(0);

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
      let dateStr = 'Invalid Date';
      
      // Try to use month/day fields first (more reliable)
      if (entry.month && entry.day) {
        const year = entry.year || new Date().getFullYear();
        const month = parseInt(entry.month) - 1; // JS months are 0-indexed
        const day = parseInt(entry.day);
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) {
          dateStr = date.toLocaleDateString();
        }
      }
      
      // Fallback to parsing created timestamp
      if (dateStr === 'Invalid Date' && entry.created) {
        try {
          // Handle the timestamp format that includes random suffix
          const timestamp = entry.created.split('-')[0]; // Remove the random suffix
          const date = new Date(timestamp);
          if (!isNaN(date.getTime())) {
            dateStr = date.toLocaleDateString();
          }
        } catch (e) {
          console.error('Error parsing date:', e);
        }
      }
      
      text += `=== ${dateStr} ===\n`;
      text += entryToText(entry) + "\n\n";
    });
    setCombinedText(text.trim());
    setEntryCount(sortedEntries.length);
    setCharacterCount(text.trim().length);
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

  const stats = useMemo(() => {
    const tradeEntries = sortedEntries.filter(e => !e.isDeposit && !e.isPayout && !e.tapeReading);
    const totalPnL = tradeEntries.reduce((sum, e) => sum + (parseFloat(e.pnl) || 0), 0);
    const winningTrades = tradeEntries.filter(e => (parseFloat(e.pnl) || 0) > 0).length;
    const losingTrades = tradeEntries.filter(e => (parseFloat(e.pnl) || 0) < 0).length;
    
    return {
      trades: tradeEntries.length,
      totalPnL,
      winningTrades,
      losingTrades,
      winRate: tradeEntries.length > 0 ? (winningTrades / tradeEntries.length * 100).toFixed(1) : 0
    };
  }, [sortedEntries]);

  return (
    <div className="w-full min-h-screen bg-black pt-20 px-4 sm:px-8">
      <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto">
        
        {/* Simple Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DocumentTextIcon className="w-8 h-8 text-blue-400" />
            <h1 className="text-2xl font-bold text-white">Trading Context</h1>
          </div>
          
          {/* Simple Stats */}
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <span>Trades: {stats.trades}</span>
            <span>Total P&L: <span className={stats.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}>${stats.totalPnL.toFixed(2)}</span></span>
            <span>Win Rate: {stats.winRate}%</span>
            <span>Wins: {stats.winningTrades}</span>
            <span>Losses: {stats.losingTrades}</span>
            <span>Entries: {entryCount}</span>
            <span>Characters: {characterCount.toLocaleString()}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-4">
          <button 
            onClick={handleCopy} 
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors duration-200"
          >
            <AnimatePresence mode="wait">
              {copied ? (
                <motion.div
                  key="check"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                >
                  <CheckIcon className="w-5 h-5 text-green-300" />
                </motion.div>
              ) : (
                <motion.div
                  key="clipboard"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                >
                  <ClipboardDocumentIcon className="w-5 h-5" />
                </motion.div>
              )}
            </AnimatePresence>
            {copied ? "Copied!" : "Copy to Clipboard"}
          </button>
          
          <button 
            onClick={handleManualRefresh} 
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors duration-200"
          >
            <ArrowPathIcon className="w-5 h-5" />
            Refresh
          </button>
          
          <button 
            onClick={handleClear} 
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors duration-200"
          >
            <TrashIcon className="w-5 h-5" />
            Clear
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <Spinner size={48} />
              <p className="text-gray-400 mt-4">Loading trading data...</p>
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
              <textarea
                className="w-full h-[70vh] bg-transparent text-gray-200 p-6 border-none outline-none text-base font-mono leading-relaxed resize-none"
                value={combinedText}
                readOnly
                placeholder="No trading data available..."
              />
              
              {combinedText.length === 0 && !loading && (
                <div className="flex items-center justify-center py-24">
                  <div className="text-center text-gray-500">
                    <DocumentTextOutline className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">No trading data available</p>
                    <p className="text-sm">Add some trades to see your context here</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContextPage; 