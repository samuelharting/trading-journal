import React, { useEffect, useState, useContext, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserContext } from "../App";
import { 
  CheckIcon, 
  ClipboardDocumentIcon, 
  TrashIcon, 
  ArrowPathIcon,
  DocumentTextIcon,
  QuestionMarkCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/solid';
import { DocumentTextIcon as DocumentTextOutline } from '@heroicons/react/24/outline';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import Spinner from '../components/MatrixLoader';

const getClearTimestampKey = (userId, accountId) => `contextClearTimestamp_${userId}_${accountId}`;

function entryToText(entry) {
  // Add account information at the top for all entries
  let lines = [];
  if (entry.accountName) {
    lines.push(`Account: ${entry.accountName}`);
  }
  
  // Handle tape reading entries
  if (entry.tapeReading) {
    lines.push(`Title: ${entry.title || '(blank)'}`);
    
    // Auto-calculate day of the week from the date for tape readings too
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
        const lastDashIndex = entry.created.lastIndexOf('-');
        if (lastDashIndex > 10) { // Make sure it's not a date dash
          const isoString = entry.created.substring(0, lastDashIndex);
          const date = new Date(isoString);
          if (!isNaN(date.getTime())) {
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            dayOfWeek = days[date.getDay()];
          }
        }
      } catch (e) {
        console.error('Error parsing date:', e);
      }
    }
    lines.push(`Day of the Week: ${dayOfWeek}`);
    
    // Handle POI for tape readings too
    let poiText = '(blank)';
    if (entry.poi) {
      if (Array.isArray(entry.poi)) {
        poiText = entry.poi.length > 0 ? entry.poi.join(', ') : '(blank)';
      } else {
        poiText = entry.poi;
      }
    }
    lines.push(`POI: ${poiText}`);
    lines.push(`Notes: ${entry.notes || '(blank)'}`);
    return lines.join("\n");
  }
  // Handle deposit entries
  if (entry.isDeposit) {
    lines.push(`Account Balance: $${entry.accountBalance || 0} - ${entry.notes || '(blank)'}`);
    return lines.join("\n");
  }
  // Handle payout entries
  if (entry.isPayout) {
    lines.push(`Payout: $${Math.abs(entry.pnl || 0)} - Account Balance: $${entry.accountBalance || 0} - ${entry.notes || '(blank)'}`);
    return lines.join("\n");
  }
  // Modern trade entry fields - show ALL fields regardless of selection
  lines.push(`Title: ${entry.title || '(blank)'}`);
  lines.push(`Ticker: ${entry.tickerTraded || '(blank)'}`);
  lines.push(`Entry Time: ${entry.entryTime || '(blank)'}`);
  lines.push(`Exit Time: ${entry.exitTime || '(blank)'}`);
  lines.push(`Duration: ${entry.duration || '(blank)'}`);
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
      const lastDashIndex = entry.created.lastIndexOf('-');
      if (lastDashIndex > 10) { // Make sure it's not a date dash
        const isoString = entry.created.substring(0, lastDashIndex);
        const date = new Date(isoString);
        if (!isNaN(date.getTime())) {
          const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          dayOfWeek = days[date.getDay()];
        }
      }
    } catch (e) {
      console.error('Error parsing date:', e);
    }
  }
  lines.push(`Day of the Week: ${dayOfWeek}`);
  
  // Session Context - show ALL fields with their actual values
  lines.push(`Daily High/Low Taken: ${entry.dailyHighLowTaken === true || entry.dailyHighLowTaken === 'true' ? 'Yes' : 'No'}`);
  lines.push(`00:00 Open: ${entry.aboveBelow0000 === 'above' ? 'Aligned' : 'Not Aligned'}`);
  lines.push(`8:30 Open: ${entry.aboveBelow0830 === 'above' ? 'Aligned' : 'Not Aligned'}`);
  lines.push(`Macro: ${entry.macroRange === true || entry.macroRange === 'true' ? 'Yes' : 'No'}`);
  
  // Trade Environment - show ALL fields with their actual values
  lines.push(`Judas Swing: ${entry.judasSwing === true || entry.judasSwing === 'true' ? 'Yes' : 'No'}`);
  lines.push(`Silver Bullet: ${entry.silverBullet === true || entry.silverBullet === 'true' ? 'Yes' : 'No'}`);
  lines.push(`Clear Manipulation: ${entry.manipulation === true || entry.manipulation === 'true' ? 'Yes' : 'No'}`);
  lines.push(`SMT: ${entry.smt === true || entry.smt === 'true' ? 'Yes' : 'No'}`);
  
  // Handle POI as either array or string for backward compatibility
  let poiText = '(blank)';
  if (entry.poi) {
    if (Array.isArray(entry.poi)) {
      poiText = entry.poi.length > 0 ? entry.poi.join(', ') : '(blank)';
    } else {
      poiText = entry.poi;
    }
  }
  lines.push(`POI: ${poiText}`);
  lines.push(`Notes: ${entry.notes || '(blank)'}`);
  return lines.join("\n");
}

const ContextPage = () => {
  const { currentUser } = useContext(UserContext);
  const [combinedText, setCombinedText] = useState("");
  const [copied, setCopied] = useState(false);
  const [mostRecentCopied, setMostRecentCopied] = useState(false);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [entryCount, setEntryCount] = useState(0);
  const [characterCount, setCharacterCount] = useState(0);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [clearTimestamp, setClearTimestamp] = useState(null);

  useEffect(() => {
    if (!currentUser) return;
    
    // Check if there's a clear timestamp for all accounts
    const timestampKey = getClearTimestampKey(currentUser.uid, 'all');
    const savedTimestamp = sessionStorage.getItem(timestampKey);
    setClearTimestamp(savedTimestamp ? parseInt(savedTimestamp) : null);
    
    // Always fetch entries from database
    const fetchEntries = async () => {
      setLoading(true);
      // Using static imports from the top of the file
      
      // Fetch entries from ALL accounts (not just selected account)
      let allEntries = [];
      
      // Get all accounts for the current user
      const accountsCol = collection(db, 'users', currentUser.uid, 'accounts');
      const accountsSnap = await getDocs(accountsCol);
      const accounts = accountsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Fetch entries from each account
      for (const account of accounts) {
        const entriesCol = collection(db, 'users', currentUser.uid, 'accounts', account.id, 'entries');
        const q = query(entriesCol, orderBy('created', 'desc'));
        // Force server fetch
        const snap = await getDocs(q, { source: 'server' });
        const accountEntries = snap.docs.map(doc => ({ 
          ...doc.data(), 
          accountId: account.id,
          accountName: account.name
        }));
        allEntries.push(...accountEntries);
      }
      
      // Sort all entries by creation date (newest first)
      allEntries.sort((a, b) => new Date(b.created) - new Date(a.created));
      
      setEntries(allEntries);
      setLoading(false);
    };
    fetchEntries();
  }, [currentUser]); // Remove selectedAccount dependency since we're fetching from all accounts

  const sortedEntries = useMemo(() => {
    let filteredEntries = [...entries];
    
    // If there's a clear timestamp, only show entries created after it
    if (clearTimestamp) {
      console.log('ContextPage filtering with clearTimestamp:', clearTimestamp, new Date(clearTimestamp));
      filteredEntries = entries.filter(entry => {
        if (!entry.created) {
          console.log('Entry missing created field:', entry);
          return false;
        }
        // Parse the timestamp from the created field (remove random suffix)
        // Format is like: "2025-08-05T18:36:30.799Z-fj9ugj"
        // Split by the last dash to remove the random suffix
        const lastDashIndex = entry.created.lastIndexOf('-');
        const cleanTimestamp = lastDashIndex > 10 ? entry.created.substring(0, lastDashIndex) : entry.created;
        const entryTime = new Date(cleanTimestamp).getTime();
        const isAfterClear = entryTime > clearTimestamp;
        console.log('Entry:', entry.created, '→', new Date(cleanTimestamp), '→', entryTime, '>', clearTimestamp, '=', isAfterClear);
        return isAfterClear;
      });
      console.log('ContextPage filtered by timestamp:', clearTimestamp, 'showing', filteredEntries.length, 'of', entries.length);
    }
    
    const arr = filteredEntries.sort((a, b) => new Date(b.created) - new Date(a.created));
    console.log('ContextPage sortedEntries:', arr.map(e => e.created));
    return arr;
  }, [entries, clearTimestamp]);



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
          const lastDashIndex = entry.created.lastIndexOf('-');
          const cleanTimestamp = lastDashIndex > 10 ? entry.created.substring(0, lastDashIndex) : entry.created;
          const date = new Date(cleanTimestamp);
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
    try {
      if (!combinedText || combinedText.trim().length === 0) {
        console.log('No text available to copy');
        return;
      }

      // Copy to clipboard with error handling
      navigator.clipboard.writeText(combinedText).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
        console.log('Successfully copied combined text to clipboard');
      }).catch((error) => {
        console.error('Failed to copy to clipboard:', error);
        // Fallback: try to copy using document.execCommand
        const textArea = document.createElement('textarea');
        textArea.value = combinedText;
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
          console.log('Copied using fallback method');
        } catch (fallbackError) {
          console.error('Fallback copy also failed:', fallbackError);
        }
        document.body.removeChild(textArea);
      });
    } catch (error) {
      console.error('Error in handleCopy:', error);
    }
  };

  const handleCopyMostRecent = () => {
    try {
      if (!sortedEntries || sortedEntries.length === 0) {
        console.log('No entries available to copy');
        return;
      }

      const mostRecentEntry = sortedEntries[0]; // First entry is most recent due to sorting
      
      if (!mostRecentEntry) {
        console.error('Most recent entry is undefined');
        return;
      }

      let dateStr = 'Invalid Date';
      
      // Try to use month/day fields first (more reliable) - consistent with main logic
      if (mostRecentEntry.month && mostRecentEntry.day) {
        const year = mostRecentEntry.year || new Date().getFullYear();
        const month = parseInt(mostRecentEntry.month) - 1; // JS months are 0-indexed
        const day = parseInt(mostRecentEntry.day);
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) {
          dateStr = date.toLocaleDateString();
        }
      }
      
      // Fallback to parsing created timestamp - consistent with main logic
      if (dateStr === 'Invalid Date' && mostRecentEntry.created) {
        try {
          // Handle the timestamp format that includes random suffix
          const lastDashIndex = mostRecentEntry.created.lastIndexOf('-');
          const cleanTimestamp = lastDashIndex > 10 ? mostRecentEntry.created.substring(0, lastDashIndex) : mostRecentEntry.created;
          const date = new Date(cleanTimestamp);
          if (!isNaN(date.getTime())) {
            dateStr = date.toLocaleDateString();
          }
        } catch (e) {
          console.error('Error parsing created timestamp:', e);
        }
      }
      
      // Generate the text to copy
      const mostRecentText = `=== ${dateStr} ===\n${entryToText(mostRecentEntry)}`;
      
      // Copy to clipboard with error handling
      navigator.clipboard.writeText(mostRecentText).then(() => {
        setMostRecentCopied(true);
        setTimeout(() => setMostRecentCopied(false), 1200);
        console.log('Successfully copied most recent entry:', mostRecentEntry.created);
      }).catch((error) => {
        console.error('Failed to copy to clipboard:', error);
        // Fallback: try to copy using document.execCommand (deprecated but works in some browsers)
        const textArea = document.createElement('textarea');
        textArea.value = mostRecentText;
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          setMostRecentCopied(true);
          setTimeout(() => setMostRecentCopied(false), 1200);
          console.log('Copied using fallback method');
        } catch (fallbackError) {
          console.error('Fallback copy also failed:', fallbackError);
        }
        document.body.removeChild(textArea);
      });
      
    } catch (error) {
      console.error('Error in handleCopyMostRecent:', error);
    }
  };

  const handleClear = () => {
    if (!currentUser) return;
    const currentTime = Date.now();
    setClearTimestamp(currentTime);
    const timestampKey = getClearTimestampKey(currentUser.uid, 'all');
    sessionStorage.setItem(timestampKey, currentTime.toString());
    console.log('ContextPage cleared for all accounts at timestamp:', currentTime);
  };

  const llmPrompt = `You are a trade stat tracker. Every time I paste a trade, extract and log the values below. Track win rates, average P&L, and patterns for each.

Fields:
=== 8/5/2025 ===
Ticker: MNQ
Entry Time: 9:45
Exit Time: 10:32
P&L: 100
R:R: 4
Economic Release: CPI 830
Day of the Week: Tuesday
Daily High/Low Taken: Yes
00:00 Open: Aligned
8:30 Open: Aligned
Macro: Yes
Judas Swing: Yes
Silver Bullet: No
Clear Manipulation: Yes
SMT: Yes
POI: REHs
Notes: good trade had it planned out premarket

Your job:
- Track frequency, win rate %, and avg P&L for each field/value
- Show patterns like "SMT = Yes: 75% win rate, Avg P&L $82"
- Show trends by weekday, POI, entry time window, etc.
- Update stats every time I paste a new trade
- show me the stats and patterns in my notes

Output format:
✅ Updated Stats:
- SMT = Yes → 9 Wins / 12 Trades (75%) | Avg P&L: $82
- Friday → 5 Wins / 6 Trades (83%)
- Judas Swing = Yes → 70% Win Rate
- POI: HTF Liquidity → Avg R:R 2.4 | Avg P&L: $71
- Notes: you mention taking a trade to early 23% 

track and show stats. you can share opinions or analysis but keep in minimal`;

  const handleCopyPrompt = () => {
    try {
      if (!llmPrompt || llmPrompt.trim().length === 0) {
        console.log('No prompt available to copy');
        return;
      }

      // Copy to clipboard with error handling
      navigator.clipboard.writeText(llmPrompt).then(() => {
        setPromptCopied(true);
        setTimeout(() => setPromptCopied(false), 1200);
        console.log('Successfully copied prompt to clipboard');
      }).catch((error) => {
        console.error('Failed to copy prompt to clipboard:', error);
        // Fallback: try to copy using document.execCommand
        const textArea = document.createElement('textarea');
        textArea.value = llmPrompt;
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          setPromptCopied(true);
          setTimeout(() => setPromptCopied(false), 1200);
          console.log('Copied prompt using fallback method');
        } catch (fallbackError) {
          console.error('Fallback copy also failed:', fallbackError);
        }
        document.body.removeChild(textArea);
      });
    } catch (error) {
      console.error('Error in handleCopyPrompt:', error);
    }
  };

  // Manual refresh handler - fetches fresh data but respects clear timestamp
  const handleManualRefresh = async () => {
    if (!currentUser) return;
    setLoading(true);
    // Using static imports from the top of the file
    
    // Fetch entries from ALL accounts (not just selected account)
    let allEntries = [];
    
    // Get all accounts for the current user
    const accountsCol = collection(db, 'users', currentUser.uid, 'accounts');
    const accountsSnap = await getDocs(accountsCol);
    const accounts = accountsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Fetch entries from each account
    for (const account of accounts) {
      const entriesCol = collection(db, 'users', currentUser.uid, 'accounts', account.id, 'entries');
      const q = query(entriesCol, orderBy('created', 'desc'));
      const snap = await getDocs(q, { source: 'server' });
      const accountEntries = snap.docs.map(doc => ({ 
        ...doc.data(), 
        accountId: account.id,
        accountName: account.name
      }));
      allEntries.push(...accountEntries);
    }
    
    // Sort all entries by creation date (newest first)
    allEntries.sort((a, b) => new Date(b.created) - new Date(a.created));
    
    setEntries(allEntries);
    setLoading(false);
    console.log('ContextPage refreshed, fetched', allEntries.length, 'entries from all accounts');
  };



  return (
    <div className="w-full min-h-screen bg-black pt-20 px-4 sm:px-8">
      <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto">
        
        {/* Simple Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DocumentTextIcon className="w-8 h-8 text-blue-400" />
            <h1 className="text-2xl font-bold text-white">Trading Context</h1>
          </div>
          

        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
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
              onClick={handleCopyMostRecent} 
              disabled={!sortedEntries || sortedEntries.length === 0}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors duration-200 ${
                !sortedEntries || sortedEntries.length === 0 
                  ? 'bg-gray-500 text-gray-300 cursor-not-allowed' 
                  : 'bg-green-600 hover:bg-green-500 text-white'
              }`}
            >
              <AnimatePresence mode="wait">
                {mostRecentCopied ? (
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
              {mostRecentCopied ? "Copied!" : "Copy Most Recent"}
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

          {/* Help Button aligned with other buttons */}
          <button
            onClick={() => setShowHelpModal(true)}
            className="p-3 text-blue-500 hover:text-blue-300 transition-colors duration-200 bg-gray-800/80 hover:bg-gray-700/80 rounded-full shadow-lg backdrop-blur-sm"
            title="How to use with AI"
          >
            <QuestionMarkCircleIcon className="w-16 h-16" />
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

      {/* Help Modal */}
      <AnimatePresence>
        {showHelpModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowHelpModal(false)}
          >
            <div className="relative">
              {/* Fixed X button outside the modal */}
              <button
                onClick={() => setShowHelpModal(false)}
                className="absolute -top-4 -right-4 z-10 w-10 h-10 bg-red-600 hover:bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg transition-colors duration-200"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>

              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-gray-900 border border-gray-700 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="flex items-center gap-3 p-6 border-b border-gray-700">
                  <QuestionMarkCircleIcon className="w-8 h-8 text-blue-400" />
                  <h2 className="text-2xl font-bold text-white">How to Use Trading Context with AI</h2>
                </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-blue-400">What is the Context Page?</h3>
                  <p className="text-gray-300 leading-relaxed">
                    The Context Page exports all your trading data in a structured format that AI models can easily understand and analyze. 
                    This allows you to get deep insights, track patterns, and improve your trading performance using AI assistants.
                  </p>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-blue-400">How to Use with AI</h3>
                  <div className="space-y-3 text-gray-300">
                    <p><strong className="text-white">1.</strong> Copy your trading data using the "Copy to Clipboard" button above</p>
                    <p><strong className="text-white">2.</strong> Open any AI assistant (ChatGPT, Claude, Gemini, Grok, etc.)</p>
                    <p><strong className="text-white">3.</strong> Paste the prompt below to set up the AI as your trading analyst</p>
                    <p><strong className="text-white">4.</strong> Paste your trading data and let the AI analyze your patterns and performance</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-blue-400">AI Trading Analyst Prompt</h3>
                  <p className="text-gray-400 text-sm">Copy this prompt and paste it into your AI assistant:</p>
                  
                  <div className="relative">
                    <textarea
                      className="w-full h-80 bg-gray-800 border border-gray-600 rounded-lg p-4 text-gray-200 text-sm font-mono leading-relaxed resize-none"
                      value={llmPrompt}
                      readOnly
                    />
                    <button
                      onClick={handleCopyPrompt}
                      className="absolute top-3 right-3 flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors duration-200"
                    >
                      <AnimatePresence mode="wait">
                        {promptCopied ? (
                          <motion.div
                            key="check"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          >
                            <CheckIcon className="w-4 h-4 text-green-300" />
                          </motion.div>
                        ) : (
                          <motion.div
                            key="clipboard"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          >
                            <ClipboardDocumentIcon className="w-4 h-4" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                      {promptCopied ? "Copied!" : "Copy Prompt"}
                    </button>
                  </div>
                </div>

                <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-blue-400 mb-2">💡 Pro Tip</h4>
                  <p className="text-gray-300 text-sm">
                    After setting up the AI with this prompt, you can regularly paste your updated trading data to get 
                    ongoing analysis of your performance, identify your best setups, and spot areas for improvement!
                  </p>
                </div>
              </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ContextPage; 