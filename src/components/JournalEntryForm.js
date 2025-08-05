import React, { useState, useRef, useContext } from "react";
import { motion } from "framer-motion";
import {
  CameraIcon,
  DocumentTextIcon
} from "@heroicons/react/24/outline";
import { storage } from '../firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { UserContext } from '../App';

const tickerOptions = ["MES", "MNQ", "BTC", "GL", "SL"];
const poiOptions = ["REHs", "RELs", "ORG", "HTF PD Array", "HTF Liquidity", "EQ"];

const initialState = {
  ticker: "",
  pnl: "",
  rr: "",
  notes: "",
  accountBalance: "",
  duration: "",
  entryTime: "",
  exitTime: "",
  tickerTraded: "MES",
};



const entryTypeOptions = [
  { value: 'trade', label: 'Trade' },
  { value: 'tape', label: 'Tape Reading' },
  { value: 'deposit', label: 'Deposit/Paycheck' },
  { value: 'payout', label: 'Payout' },
];



function Toggle({ value, onChange, label }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-blue-300 text-sm font-semibold">{label}</span>
      <button type="button" onClick={() => onChange(!value)} className={`ml-2 w-8 h-5 rounded-full transition-colors duration-200 ${value ? 'bg-green-500' : 'bg-neutral-700'}`}> 
        <span className={`block w-4 h-4 rounded-full bg-white shadow transform transition-transform duration-200 ${value ? 'translate-x-4' : ''}`}></span>
      </button>
      <span className="text-xs text-blue-200 ml-1">{value ? 'Yes' : 'No'}</span>
    </div>
  );
}

function trimFirestoreDoc(doc) {
  const MAX_STRING = 1000000;
  const MAX_ARRAY = 1000;
  const MAX_FIELD_BYTES = 1048487;
  function trim(obj) {
    if (Array.isArray(obj)) {
      let arr = obj.slice(0, MAX_ARRAY);
      arr = arr.map(trim);
      if (JSON.stringify(arr).length > MAX_FIELD_BYTES) return undefined;
      return arr;
    } else if (typeof obj === 'string') {
      let s = obj.slice(0, MAX_STRING);
      if (s.length > MAX_FIELD_BYTES) return undefined;
      return s;
    } else if (typeof obj === 'object' && obj !== null) {
      const out = {};
      for (const k in obj) {
        const trimmed = trim(obj[k]);
        if (trimmed !== undefined) out[k] = trimmed;
      }
      if (JSON.stringify(out).length > MAX_FIELD_BYTES) return undefined;
      return out;
    } else {
      return obj;
    }
  }
  const trimmed = trim(doc);
  const size = JSON.stringify(trimmed).length;
  console.log('Firestore doc size:', size);
  return trimmed;
}

// Helper function to calculate account balance
function calculateAccountBalance(previousBalance, pnl) {
  const prev = Number(previousBalance) || 0;
  const pnlValue = Number(pnl) || 0;
  return (Math.round((prev + pnlValue) * 100) / 100).toFixed(2);
}

const JournalEntryForm = ({ onSave, onCancel, initialAccountBalance }) => {
  const { currentUser, selectedAccount } = useContext(UserContext);
  const [form, setForm] = useState({ ...initialState, accountBalance: initialAccountBalance ?? "" });
  const [screenshots, setScreenshots] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [entryType, setEntryType] = useState('trade');
  const fileInputRef = useRef();

  // Add new state for all toggles and POI
  const [sessionContext, setSessionContext] = useState({
    dailyHighLowTaken: false,
    aboveBelow0000: false, // false = below, true = above
    aboveBelow0830: false,
    aboveBelow0930: false,
    macroRange: false,
  });
  const [tradeEnv, setTradeEnv] = useState({
    judasSwing: false,
    silverBullet: false,
    manipulation: false,
    smt: false,
  });
  const [poi, setPoi] = useState('');

  // Add new state for economic release
  const [economicRelease, setEconomicRelease] = useState("");

  // Helper to auto-format time as HH:MM
  function formatTimeInput(value) {
    // Remove non-digits
    let v = value.replace(/\D/g, '');
    if (v.length <= 2) return v;
    if (v.length === 3) return v[0] + ':' + v.slice(1);
    if (v.length === 4) return v.slice(0, 2) + ':' + v.slice(2);
    return v.slice(0, 2) + ':' + v.slice(2, 4);
  }

  // Helper to calculate duration in minutes and format as 'Xhr Ymin'
  function calcDuration(start, end) {
    if (!/^\d{1,2}:\d{2}$/.test(start) || !/^\d{1,2}:\d{2}$/.test(end)) return '';
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let startMins = sh * 60 + sm;
    let endMins = eh * 60 + em;
    // If exit hour is less than entry hour, assume trade went past noon (not 24hr)
    if (endMins < startMins) endMins += 12 * 60;
    let diff = endMins - startMins;
    if (diff <= 0) return '';
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    if (hours > 0 && mins > 0) return `${hours}hr ${mins}min`;
    if (hours > 0) return `${hours}hr`;
    return `${mins}min`;
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'entryTime' || name === 'exitTime') {
      const formatted = formatTimeInput(value);
      setForm((prev) => {
        const updated = { ...prev, [name]: formatted };
        // Auto-calc duration if both times present
        if (updated.entryTime && updated.exitTime) {
          updated.duration = calcDuration(updated.entryTime, updated.exitTime);
        }
        return updated;
      });
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
  };
  const handleDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };
  const handleFiles = (files) => {
    Promise.all(files.map(file => {
      return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target.result);
        reader.readAsDataURL(file);
      });
    })).then(images => {
      setScreenshots(prev => [...prev, ...images]);
    });
  };
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    handleFiles(files);
    e.target.value = null;
  };

  const handleRemoveScreenshot = (idx) => {
    setScreenshots(prev => prev.filter((_, i) => i !== idx));
  };

  const handleEntryTypeChange = (e) => setEntryType(e.target.value);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (uploading || submitting) return;
    setUploading(true);
    setSubmitting(true);
    let urls = [];
    if (currentUser && selectedAccount) {
      try {
        urls = await Promise.all(
          screenshots.map(async (src, idx) => {
            if (src.startsWith('http')) return src;
            const imageRef = ref(storage, `screenshots/${currentUser.uid}/${selectedAccount.id}/${Date.now()}-${idx}.jpg`);
            await uploadString(imageRef, src, 'data_url');
            return await getDownloadURL(imageRef);
          })
        );
      } catch (err) {
        console.error('Storage error', err);
      }
    }
    setUploading(false);
    const now = new Date();
    const entryYear = String(now.getFullYear());
    const entryMonth = String(now.getMonth() + 1);
    const entryDay = String(now.getDate());
    const createdTimestamp = now.toISOString() + '-' + Math.random().toString(36).slice(2, 8);
    const trimmedEntry = trimFirestoreDoc({
      ...form,
      ...sessionContext,
      ...tradeEnv,
      poi,
      economicRelease,
      pnl: entryType === 'trade' ? Number(form.pnl) : entryType === 'payout' ? -Number(form.pnl) : entryType === 'deposit' ? Number(form.pnl) : 0,
      rr: entryType === 'trade' ? form.rr : '0',
      accountBalance: calculateAccountBalance(initialAccountBalance, entryType === 'trade' ? Number(form.pnl) : entryType === 'payout' ? -Number(form.pnl) : entryType === 'deposit' ? Number(form.pnl) : 0),
      screenshots: urls,
      created: createdTimestamp,
      tapeReading: entryType === 'tape',
      isDeposit: entryType === 'deposit',
      isPayout: entryType === 'payout',
      year: entryYear,
      month: entryMonth,
      day: entryDay,
      aboveBelow0000: sessionContext.aboveBelow0000 ? 'above' : 'below',
      aboveBelow0830: sessionContext.aboveBelow0830 ? 'above' : 'below',
      aboveBelow0930: sessionContext.aboveBelow0930 ? 'above' : 'below',
    });
    if (trimmedEntry && currentUser && selectedAccount) {
      const { db } = await import('../firebase');
      const { collection, addDoc } = await import('firebase/firestore');
      const entriesCol = collection(db, 'users', currentUser.uid, 'accounts', selectedAccount.id, 'entries');
      const docRef = await addDoc(entriesCol, trimmedEntry);
      // Pass the saved entry data to onSave callback
      onSave({ ...trimmedEntry, id: docRef.id });
      setForm(initialState);
      setScreenshots([]);
    }
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="fixed inset-0 z-50 flex flex-col bg-black bg-opacity-95">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-neutral-900/95 backdrop-blur-sm p-3 flex justify-between items-center border-b border-neutral-800">
        {/* Entry Type Dropdown on the left */}
        <div className="flex items-center gap-4">
          <label className="text-base font-semibold text-[#e5e5e5]">Entry Type</label>
          <select
            value={entryType}
            onChange={handleEntryTypeChange}
            className="bg-neutral-900 text-[#e5e5e5] p-2 rounded-md border-none focus:ring-2 focus:ring-blue-700 transition-all text-sm"
          >
            {entryTypeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
        
        {/* Save/Cancel buttons on the right */}
        <div className="flex gap-4">
          <motion.button 
            whileHover={{ scale: 1.06 }} 
            whileTap={{ scale: 0.98 }} 
            type="submit" 
            className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl text-xl font-extrabold shadow-lg border-none outline-none" 
            disabled={uploading || submitting}
          >
            {uploading ? 'Uploading...' : submitting ? 'Saving...' : 'Save'}
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.04 }} 
            whileTap={{ scale: 0.98 }} 
            type="button" 
            className="bg-neutral-900 hover:bg-neutral-800 text-[#e5e5e5] px-6 py-3 rounded-md text-base transition-all border-none outline-none shadow-none" 
            onClick={onCancel} 
            disabled={uploading}
          >
            Cancel
          </motion.button>
        </div>
      </div>

      <motion.div initial="hidden" animate="visible" variants={{}} className="flex-1 bg-black p-0 flex flex-col gap-4 overflow-y-auto border-none px-2">
        {/* Render fields based on entryType */}
        {entryType === 'deposit' ? (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="relative bg-neutral-900/90 rounded-2xl px-4 py-6 mb-2 shadow-xl border border-green-700/40 flex flex-col items-center gap-4">
            <div className="flex flex-col items-center mb-2">
              <span className="text-2xl font-extrabold text-green-300 mb-1">Deposit</span>
              <span className="text-base font-semibold text-green-200 mb-2">Adding funds to your account</span>
              <span className="text-xs text-green-400 italic">Keep building your trading capital.</span>
            </div>
            <div className="flex justify-center w-full">
              <div className="flex flex-col gap-2 max-w-md w-full">
                <label className="text-xs font-semibold text-green-300 mb-1">Deposit Amount</label>
                <input name="pnl" type="number" step="0.01" value={form.pnl} onChange={handleChange} onWheel={(e) => e.target.blur()} className="w-full bg-neutral-900 text-green-200 p-3 rounded-md border-none focus:ring-2 focus:ring-green-400 transition-all text-lg font-bold" placeholder="Enter deposit amount" />
              </div>
            </div>
          </motion.div>
        ) : entryType === 'payout' ? (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="relative bg-neutral-900/90 rounded-2xl px-4 py-6 mb-2 shadow-xl border border-blue-700/40 flex flex-col items-center gap-4">
            <div className="flex flex-col items-center mb-2">
              <span className="text-2xl font-extrabold text-blue-300 mb-1">Payout</span>
              <span className="text-base font-semibold text-blue-200 mb-2">Congrats on your payout!</span>
              <span className="text-xs text-blue-400 italic">Reward yourself for your discipline.</span>
            </div>
            <div className="flex justify-center w-full">
              <div className="flex flex-col gap-2 max-w-md w-full">
                <label className="text-xs font-semibold text-blue-300 mb-1">Payout Amount</label>
                <input name="pnl" type="number" step="0.01" value={form.pnl} onChange={handleChange} onWheel={(e) => e.target.blur()} className="w-full bg-neutral-900 text-blue-200 p-3 rounded-md border-none focus:ring-2 focus:ring-blue-400 transition-all text-lg font-bold" placeholder="Enter payout amount" />
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Screenshot Uploader - Dedicated Header Area */}
            {(entryType === 'trade' || entryType === 'tape') && (
              <div className="bg-neutral-900/90 rounded-xl mx-4 mb-4 border border-neutral-700 overflow-hidden">
                <div className="p-4 border-b border-neutral-700 bg-neutral-800/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CameraIcon className="w-5 h-5 text-blue-400" />
                      <span className="text-base font-bold text-[#e5e5e5]">Screenshots</span>
                      {screenshots.length > 0 && (
                        <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full font-bold">
                          {screenshots.length}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current.click()}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg transition-all"
                    >
                      Add Images
                    </button>
                  </div>
                </div>
                
                <div 
                  className="p-4 min-h-[80px] border-2 border-dashed border-neutral-600 hover:border-blue-500 transition-colors"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  
                  {screenshots.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-center">
                      <div>
                        <div className="text-neutral-400 text-sm mb-2">Drag & drop images here</div>
                        <div className="text-neutral-500 text-xs">or click "Add Images" above</div>
                      </div>
                    </div>
                  ) : (
                    <div className="max-h-32 overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-600 scrollbar-track-transparent">
                      <div className="flex flex-wrap gap-3">
                        {screenshots.map((src, idx) => (
                          <div key={idx} className="relative group flex-shrink-0">
                            <img 
                              src={src} 
                              alt={`Screenshot ${idx + 1}`} 
                              className="w-20 h-20 object-cover rounded-lg border-2 border-neutral-600 shadow-lg hover:border-blue-400 transition-colors cursor-pointer" 
                            />
                            <button 
                              type="button" 
                              onClick={() => handleRemoveScreenshot(idx)} 
                              className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-700 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Remove image"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Two-Column Layout for Trade Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 pb-4 flex-1 min-h-0">
            {/* Left Column */}
            <div className="flex flex-col gap-4">
              {/* Session Context Card */}
              <motion.div className="bg-neutral-900/80 rounded-2xl p-4 border border-white/10 shadow-md">
                <div className="flex items-center mb-3">
                  <span className="text-base font-bold text-blue-300">Session Context</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Toggle value={sessionContext.dailyHighLowTaken} onChange={v => setSessionContext(sc => ({ ...sc, dailyHighLowTaken: v }))} label="Daily high/low taken before trade?" />
                  <div>
                    <label className="text-blue-300 text-sm font-semibold flex items-center">Economic Release and Time</label>
                    <input
                      type="text"
                      className="w-full bg-neutral-900 text-[#e5e5e5] p-2 rounded-md mt-1"
                      placeholder="e.g. CPI 8:30, FOMC 14:00"
                      value={economicRelease}
                      onChange={e => setEconomicRelease(e.target.value)}
                    />
                  </div>

                                     <Toggle
                     value={sessionContext.aboveBelow0000}
                     onChange={v => setSessionContext(sc => ({ ...sc, aboveBelow0000: v }))}
                     label="Aligned with 00:00 open?"
                   />
                   <Toggle
                     value={sessionContext.aboveBelow0830}
                     onChange={v => setSessionContext(sc => ({ ...sc, aboveBelow0830: v }))}
                     label="Aligned with 8:30 open?"
                   />
                   <Toggle
                     value={sessionContext.aboveBelow0930}
                     onChange={v => setSessionContext(sc => ({ ...sc, aboveBelow0930: v }))}
                     label="Aligned with 9:30 open?"
                   />
                                     <Toggle value={sessionContext.macroRange} onChange={v => setSessionContext(sc => ({ ...sc, macroRange: v }))} label="Macro" />
                </div>
              </motion.div>

              {/* Trade Environment Card */}
              <motion.div className="bg-neutral-900/80 rounded-2xl p-4 border border-white/10 shadow-md">
                <div className="flex items-center mb-3">
                  <span className="text-base font-bold text-blue-300">Trade Environment</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Toggle value={tradeEnv.judasSwing} onChange={v => setTradeEnv(te => ({ ...te, judasSwing: v }))} label="9:30 Judas swing?" />
                  <Toggle value={tradeEnv.silverBullet} onChange={v => setTradeEnv(te => ({ ...te, silverBullet: v }))} label="Silver Bullet?" />
                  <Toggle value={tradeEnv.manipulation} onChange={v => setTradeEnv(te => ({ ...te, manipulation: v }))} label="Clear manipulation in opposite direction?" />
                  <Toggle value={tradeEnv.smt} onChange={v => setTradeEnv(te => ({ ...te, smt: v }))} label="SMT?" />
                </div>
              </motion.div>

              {/* POI Card */}
              <motion.div className="bg-neutral-900/80 rounded-2xl p-4 border border-white/10 shadow-md">
                <div className="flex items-center mb-3">
                  <span className="text-base font-bold text-blue-300">POI / Bias</span>
                </div>
                <div>
                  <label className="text-blue-300 text-sm font-semibold mb-2">POI</label>
                  <div className="flex flex-wrap gap-2">
                    {poiOptions.map(option => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setPoi(poi === option ? '' : option)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                          poi === option
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'bg-neutral-800 text-[#e5e5e5] hover:bg-neutral-700 border border-neutral-600'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Right Column */}
            <div className="flex flex-col gap-4">
              {/* Core Trade Inputs - 3 Column Grid */}
              <motion.div className="bg-neutral-900/80 rounded-2xl p-4 border border-white/10 shadow-md">
                <div className="flex items-center mb-3">
                  <span className="text-base font-bold text-blue-300">Trade Details</span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {/* Row 1: Ticker, P&L, R:R */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-neutral-400 mb-1">Ticker</label>
                    <select name="tickerTraded" value={form.tickerTraded} onChange={handleChange} className="w-full bg-neutral-900 text-[#e5e5e5] p-2 rounded-md border-none focus:ring-2 focus:ring-neutral-700 transition-all text-sm" >
                      {tickerOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-neutral-400 mb-1">P&L</label>
                    <input name="pnl" type="number" step="0.01" value={form.pnl} onChange={handleChange} onWheel={(e) => e.target.blur()} className="w-full bg-neutral-900 text-[#e5e5e5] p-2 rounded-md border-none focus:ring-2 focus:ring-green-700 transition-all text-sm" placeholder="$" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-neutral-400 mb-1">R:R</label>
                    <input name="rr" type="number" step="0.01" value={form.rr} onChange={handleChange} onWheel={(e) => e.target.blur()} className="w-full bg-neutral-900 text-[#e5e5e5] p-2 rounded-md border-none focus:ring-2 focus:ring-purple-700 transition-all text-sm" placeholder="e.g. 2.5" />
                  </div>
                  {/* Row 2: Entry Time, Exit Time, Duration */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-neutral-400 mb-1">Entry Time</label>
                    <input name="entryTime" type="text" value={form.entryTime} onChange={handleChange} className="w-full bg-neutral-900 text-[#e5e5e5] p-2 rounded-md border-none focus:ring-2 focus:ring-neutral-700 transition-all text-sm" placeholder="e.g. 09:30" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-neutral-400 mb-1">Exit Time</label>
                    <input name="exitTime" type="text" value={form.exitTime} onChange={handleChange} className="w-full bg-neutral-900 text-[#e5e5e5] p-2 rounded-md border-none focus:ring-2 focus:ring-neutral-700 transition-all text-sm" placeholder="e.g. 10:15" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-neutral-400 mb-1">Duration</label>
                    <input name="duration" type="text" value={form.duration} readOnly className="w-full bg-neutral-700 text-[#e5e5e5] p-2 rounded-md border-none text-sm" placeholder="Auto-calculated" />
                  </div>
                </div>
              </motion.div>

              {/* Notes Panel */}
              <motion.div className="bg-neutral-900/80 rounded-2xl p-4 border border-white/10 shadow-md">
                <div className="flex items-center gap-3 mb-3">
                  <DocumentTextIcon className="w-6 h-6 text-blue-300" />
                  <div className="text-base font-bold text-[#e5e5e5]">Notes</div>
                </div>
                <div className="flex flex-col">
                  <label className="text-sm font-semibold text-blue-400 mb-2">Notes</label>
                  <textarea 
                    name="notes" 
                    value={form.notes} 
                    onChange={handleChange} 
                    className="w-full bg-neutral-900 text-[#e5e5e5] p-3 rounded-xl border-none focus:ring-2 focus:ring-blue-700 transition-all resize-none h-32" 
                    placeholder="Enter your trade notes here..."
                  />
                </div>
              </motion.div>
            </div>
            </div>
          </div>
        )}
      </motion.div>
    </form>
  );
};

export default JournalEntryForm; 