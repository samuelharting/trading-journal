import React, { useState, useRef, useContext } from "react";
import { motion } from "framer-motion";
import {
  CameraIcon,
  DocumentTextIcon,
  ClockIcon,
  ChartBarIcon,
  PresentationChartLineIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  TagIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";
import { storage } from '../firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { UserContext } from '../App';

const tickerOptions = ["MES", "MNQ", "BTC", "GL", "SL"];
const sessionOptions = ["pre-market", "NY-AM", "NY-Lch", "NY-PM", "Asia", "London"];

const initialState = {
  title: "",
  ticker: "",
  pnl: "",
  rr: "",
  notes: "",
  accountBalance: "",
  duration: "",
  entryTime: "",
  exitTime: "",
  tickerTraded: "MNQ",
  tradeSession: "NY-AM",
};



const entryTypeOptions = [
  { value: 'trade', label: 'Trade' },
  { value: 'tape', label: 'Tape Reading' },
  { value: 'deposit', label: 'Deposit/Paycheck' },
  { value: 'payout', label: 'Payout' },
];



function Toggle({ value, onChange, label }) {
  // Handle three states: true, false, null (N/A)
  const getNextState = (currentValue) => {
    if (currentValue === true) return false;
    if (currentValue === false) return null;
    return true; // null -> true
  };

  const getDisplayText = (val) => {
    if (val === true) return 'Yes';
    if (val === false) return 'No';
    return 'N/A';
  };

  const getToggleColor = (val) => {
    if (val === true) return 'bg-green-500';
    if (val === false) return 'bg-red-500';
    return 'bg-neutral-600';
  };

  const getTogglePosition = (val) => {
    if (val === true) return 'translate-x-4';
    if (val === false) return 'translate-x-0';
    return 'translate-x-2'; // N/A position (middle)
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-blue-300 text-sm font-semibold">{label}</span>
      <button 
        type="button" 
        onClick={() => onChange(getNextState(value))} 
        className={`ml-2 w-8 h-5 rounded-full transition-colors duration-200 ${getToggleColor(value)}`}
      > 
        <span className={`block w-4 h-4 rounded-full bg-white shadow transform transition-transform duration-200 ${getTogglePosition(value)}`}></span>
      </button>
      <span className="text-xs text-blue-200 ml-1">{getDisplayText(value)}</span>
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

const JournalEntryForm = ({ onSave, onCancel, initialAccountBalance, forceEntryType }) => {
  const { currentUser, selectedAccount } = useContext(UserContext);
  const [form, setForm] = useState({ ...initialState, accountBalance: initialAccountBalance ?? "" });
  const [screenshots, setScreenshots] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [entryType, setEntryType] = useState(forceEntryType || 'trade');
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const fileInputRef = useRef();

  // Add new state for all toggles and POI - default to null (N/A)
  const [sessionContext, setSessionContext] = useState({
    dailyHighLowTaken: null,
    aboveBelow0000: null, // null = N/A, false = below, true = above
    aboveBelow0830: null,
    macroRange: null,
  });
  const [tradeEnv, setTradeEnv] = useState({
    judasSwing: null,
    silverBullet: null,
    manipulation: null,
    smt: null,
  });
  const [poi, setPoi] = useState("");

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
        console.error('Storage error details:', err);
        console.error('Error code:', err.code);
        console.error('Error message:', err.message);
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
      poi: poi || "",
      economicRelease,
      tradeSession: form.tradeSession,
      title: entryType === 'deposit' ? `$${Number(form.pnl).toFixed(2)} Deposit` : form.title, // Auto-generate title for deposits
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
      aboveBelow0000: sessionContext.aboveBelow0000 === null ? null : (sessionContext.aboveBelow0000 ? 'above' : 'below'),
      aboveBelow0830: sessionContext.aboveBelow0830 === null ? null : (sessionContext.aboveBelow0830 ? 'above' : 'below'),
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
      setPoi("");
      // Reset toggle states to N/A
      setSessionContext({
        dailyHighLowTaken: null,
        aboveBelow0000: null,
        aboveBelow0830: null,
        macroRange: null,
      });
      setTradeEnv({
        judasSwing: null,
        silverBullet: null,
        manipulation: null,
        smt: null,
      });
      setEconomicRelease("");
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
            disabled={!!forceEntryType}
            className={`bg-neutral-900 text-[#e5e5e5] p-2 rounded-md border-none focus:ring-2 focus:ring-blue-700 transition-all text-sm ${forceEntryType ? 'opacity-60 cursor-not-allowed' : ''}`}
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
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.95 }} 
            animate={{ opacity: 1, y: 0, scale: 1 }} 
            transition={{ duration: 0.8, type: "spring" }}
            className="relative bg-gradient-to-br from-emerald-900/60 via-green-900/40 to-black/60 backdrop-blur-xl rounded-3xl mx-2 my-4 p-8 shadow-2xl border-2 border-emerald-400/30 flex flex-col items-center gap-8 min-h-[500px] overflow-hidden"
          >
            {/* Animated background elements */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute top-10 right-10 w-20 h-20 bg-emerald-400/10 rounded-full animate-pulse"></div>
              <div className="absolute bottom-20 left-10 w-16 h-16 bg-green-400/10 rounded-full animate-ping" style={{animationDelay: '1s'}}></div>
              <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-emerald-300/5 rounded-full animate-pulse" style={{animationDelay: '0.5s'}}></div>
            </div>

            {/* Header Section */}
            <div className="flex flex-col items-center mb-6 z-10">
              <div className="mb-4">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-2xl animate-bounce">
                  <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                  </svg>
                </div>
              </div>
              <span className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-green-400 mb-3 animate-pulse">💰 DEPOSIT</span>
              <span className="text-2xl font-bold text-emerald-200 mb-2 text-center">Adding funds to your trading account</span>
              <span className="text-lg text-emerald-300/80 italic text-center">Keep building your capital for bigger opportunities!</span>
            </div>


            
            {/* Amount Input Section */}
            <div className="flex justify-center w-full z-10">
              <div className="flex flex-col gap-6 w-full max-w-lg">
                <label className="text-2xl font-bold text-emerald-300 text-center">Deposit Amount</label>
                <div className="relative">
                  <div className="absolute left-6 top-1/2 transform -translate-y-1/2 text-4xl font-black text-emerald-400">$</div>
                  <input 
                    name="pnl" 
                    type="number" 
                    step="0.01" 
                    value={form.pnl} 
                    onChange={handleChange} 
                    onWheel={(e) => e.target.blur()} 
                    className="w-full bg-emerald-950/60 text-emerald-100 rounded-2xl pl-16 pr-8 py-6 border-3 border-emerald-600/50 text-4xl font-black text-center shadow-2xl focus:ring-4 focus:ring-emerald-400/50 focus:border-emerald-400 transition-all duration-300 placeholder-emerald-400/50" 
                    placeholder="0.00" 
                  />
                </div>
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 bg-emerald-900/40 px-4 py-2 rounded-full border border-emerald-600/30">
                    <span className="text-emerald-300 text-sm font-semibold">💪 Building Capital</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : entryType === 'payout' ? (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.95 }} 
            animate={{ opacity: 1, y: 0, scale: 1 }} 
            transition={{ duration: 0.8, type: "spring" }}
            className="relative bg-gradient-to-br from-orange-900/60 via-red-900/40 to-black/60 backdrop-blur-xl rounded-3xl mx-2 my-4 p-8 shadow-2xl border-2 border-orange-400/30 flex flex-col items-center gap-8 min-h-[500px] overflow-hidden"
          >
            {/* Celebration animation elements */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute top-8 left-8 w-6 h-6 bg-yellow-400 rounded-full animate-ping"></div>
              <div className="absolute top-20 right-12 w-4 h-4 bg-orange-400 rounded-full animate-ping" style={{animationDelay: '1s'}}></div>
              <div className="absolute bottom-16 left-16 w-8 h-8 bg-red-400 rounded-full animate-ping" style={{animationDelay: '2s'}}></div>
              <div className="absolute top-32 right-20 w-3 h-3 bg-yellow-300 rounded-full animate-ping" style={{animationDelay: '0.5s'}}></div>
              <div className="absolute bottom-32 right-8 w-5 h-5 bg-orange-300 rounded-full animate-ping" style={{animationDelay: '1.5s'}}></div>
            </div>

            {/* Header Section */}
            <div className="flex flex-col items-center mb-6 z-10">
              <div className="mb-4 relative">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 flex items-center justify-center shadow-2xl animate-bounce">
                  <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"/>
                  </svg>
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full animate-pulse flex items-center justify-center">
                  <span className="text-xl">🎉</span>
                </div>
              </div>
              <span className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-400 to-red-400 mb-3 animate-pulse">🎉 PAYOUT!</span>
              <span className="text-2xl font-bold text-orange-200 mb-2 text-center">Congratulations on your success!</span>
              <span className="text-lg text-orange-300/80 italic text-center">Time to reward yourself for your discipline and skill!</span>
            </div>

            {/* Title Input Section */}
            <div className="flex justify-center w-full z-10 mb-6">
              <div className="flex flex-col gap-2 w-full max-w-lg">
                <label className="text-xl font-bold text-orange-300 text-center">Title (Optional)</label>
                <input 
                  name="title" 
                  type="text" 
                  value={form.title} 
                  onChange={handleChange} 
                  className="w-full bg-orange-950/60 text-orange-100 rounded-xl p-3 border-2 border-orange-600/50 text-lg shadow-xl focus:ring-2 focus:ring-orange-400/50 transition-all" 
                  placeholder="Short title for this payout..." 
                />
              </div>
            </div>
            
            {/* Amount Input Section */}
            <div className="flex justify-center w-full z-10">
              <div className="flex flex-col gap-6 w-full max-w-lg">
                <label className="text-2xl font-bold text-orange-300 text-center">Payout Amount</label>
                <div className="relative">
                  <div className="absolute left-6 top-1/2 transform -translate-y-1/2 text-4xl font-black text-orange-400">$</div>
                  <input 
                    name="pnl" 
                    type="number" 
                    step="0.01" 
                    value={form.pnl} 
                    onChange={handleChange} 
                    onWheel={(e) => e.target.blur()} 
                    className="w-full bg-orange-950/60 text-orange-100 rounded-2xl pl-16 pr-8 py-6 border-3 border-orange-600/50 text-4xl font-black text-center shadow-2xl focus:ring-4 focus:ring-orange-400/50 focus:border-orange-400 transition-all duration-300 placeholder-orange-400/50 animate-pulse" 
                    placeholder="0.00" 
                  />
                </div>
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 bg-orange-900/40 px-4 py-2 rounded-full border border-orange-600/30 animate-bounce">
                    <span className="text-orange-300 text-sm font-semibold">🏆 Well Earned!</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Screenshot Uploader - Dedicated Header Area */}
            {(entryType === 'trade' || entryType === 'tape') && (
              <div className="bg-gradient-to-br from-neutral-900/95 to-neutral-800/95 rounded-2xl mx-4 mb-6 border border-neutral-600/50 overflow-hidden shadow-xl backdrop-blur-sm">
                <div className="p-5 border-b border-neutral-600/30 bg-gradient-to-r from-neutral-800/80 to-neutral-700/80">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/20 rounded-lg">
                        <CameraIcon className="w-5 h-5 text-blue-400" />
                      </div>
                      <span className="text-lg font-bold text-[#e5e5e5]">Screenshots</span>
                      {screenshots.length > 0 && (
                        <span className="bg-gradient-to-r from-blue-600 to-blue-500 text-white text-xs px-3 py-1 rounded-full font-bold shadow-lg">
                          {screenshots.length}
                        </span>
                      )}
                    </div>
                    {/* Title field inline */}
                    <div className="flex items-center gap-3 flex-1 max-w-md">
                      <div className="p-2 bg-purple-500/20 rounded-lg">
                        <TagIcon className="w-4 h-4 text-purple-400" />
                      </div>
                      <label className="text-sm font-semibold text-neutral-300 whitespace-nowrap">Title:</label>
                      <input 
                        name="title" 
                        type="text" 
                        value={form.title} 
                        onChange={handleChange} 
                        className="flex-1 bg-neutral-900/80 text-[#e5e5e5] p-3 rounded-lg border border-neutral-600/50 focus:ring-2 focus:ring-blue-500 focus:border-blue-400 transition-all text-sm font-medium" 
                        placeholder={entryType === 'tape' ? "Title for tape reading..." : "Title for trade..."} 
                      />
                    </div>
                  </div>
                </div>
                
                <div 
                  className="p-4 min-h-[80px] border-2 border-dashed border-neutral-600 hover:border-blue-500 transition-colors cursor-pointer"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current.click()}
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
                        <div className="text-neutral-400 text-sm mb-2 font-medium">Click here to add images</div>
                        <div className="text-neutral-500 text-xs">or drag & drop images</div>
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
                              className="w-20 h-20 object-cover rounded-lg border-2 border-neutral-600 shadow-lg hover:border-blue-400 transition-all duration-300 cursor-pointer hover:scale-105" 
                              onClick={() => {
                                setSelectedImageIndex(idx);
                                setShowImageViewer(true);
                              }}
                            />
                            <button 
                              type="button" 
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent triggering the image picker
                                handleRemoveScreenshot(idx);
                              }} 
                              className="absolute top-0 right-0 bg-red-600 hover:bg-red-700 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs font-bold shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-6 pb-6 flex-1 min-h-0">
            {/* Left Column */}
            <div className="flex flex-col gap-6">
              {/* Session Context Card */}
              <motion.div className="bg-gradient-to-br from-blue-900/30 to-indigo-900/30 rounded-2xl p-6 border border-blue-500/20 shadow-xl backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <ClockIcon className="w-5 h-5 text-blue-400" />
                  </div>
                  <span className="text-lg font-bold text-blue-300">Session Context</span>
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
                                     <Toggle value={sessionContext.macroRange} onChange={v => setSessionContext(sc => ({ ...sc, macroRange: v }))} label="Macro" />
                </div>
              </motion.div>

              {/* Trade Environment Card */}
              <motion.div className="bg-gradient-to-br from-purple-900/30 to-violet-900/30 rounded-2xl p-6 border border-purple-500/20 shadow-xl backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <PresentationChartLineIcon className="w-5 h-5 text-purple-400" />
                  </div>
                  <span className="text-lg font-bold text-purple-300">Trade Environment</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Toggle value={tradeEnv.judasSwing} onChange={v => setTradeEnv(te => ({ ...te, judasSwing: v }))} label="9:30 Judas swing?" />
                  <Toggle value={tradeEnv.silverBullet} onChange={v => setTradeEnv(te => ({ ...te, silverBullet: v }))} label="Silver Bullet?" />
                  <Toggle value={tradeEnv.manipulation} onChange={v => setTradeEnv(te => ({ ...te, manipulation: v }))} label="Clear manipulation in opposite direction?" />
                  <Toggle value={tradeEnv.smt} onChange={v => setTradeEnv(te => ({ ...te, smt: v }))} label="SMT?" />
                </div>
              </motion.div>

              {/* POI Card */}
              <motion.div className="bg-gradient-to-br from-emerald-900/30 to-green-900/30 rounded-2xl p-6 border border-emerald-500/20 shadow-xl backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-emerald-500/20 rounded-lg">
                    <TagIcon className="w-5 h-5 text-emerald-400" />
                  </div>
                  <span className="text-lg font-bold text-emerald-300">POI</span>
                </div>
                <div className="flex flex-col">
                  <label className="text-sm font-semibold text-emerald-300 mb-2">Point of Interest:</label>
                  <input
                    type="text"
                    value={poi}
                    onChange={(e) => setPoi(e.target.value)}
                    className="w-full bg-neutral-900/80 text-[#e5e5e5] p-3 rounded-lg border border-neutral-600/50 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 transition-all text-sm font-medium"
                    placeholder="Enter POI (e.g. REHs, RELs, ORG, HTF PD Array...)"
                  />
                </div>
              </motion.div>
            </div>

            {/* Right Column */}
            <div className="flex flex-col gap-6">
              {/* Trade Session Card */}
              <motion.div className="bg-gradient-to-br from-amber-900/30 to-orange-900/30 rounded-2xl p-6 border border-amber-500/20 shadow-xl backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-amber-500/20 rounded-lg">
                    <CalendarIcon className="w-5 h-5 text-amber-400" />
                  </div>
                  <span className="text-lg font-bold text-amber-300">Trade Session</span>
                </div>
                <div className="flex flex-col gap-3">
                  <label className="text-sm font-semibold text-amber-300">Session:</label>
                  <select 
                    name="tradeSession" 
                    value={form.tradeSession} 
                    onChange={handleChange} 
                    className="w-full bg-neutral-900/80 text-[#e5e5e5] p-3 rounded-lg border border-neutral-600/50 focus:ring-2 focus:ring-amber-500 focus:border-amber-400 transition-all text-sm font-medium" 
                  >
                    {sessionOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </motion.div>

              {/* Core Trade Inputs - 3 Column Grid */}
              <motion.div className="bg-gradient-to-br from-slate-900/30 to-gray-900/30 rounded-2xl p-6 border border-slate-500/20 shadow-xl backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-slate-500/20 rounded-lg">
                    <ChartBarIcon className="w-5 h-5 text-slate-400" />
                  </div>
                  <span className="text-lg font-bold text-slate-300">Trade Details</span>
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
                    <div className="relative">
                      <CurrencyDollarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
                      <input 
                        name="pnl" 
                        type="number" 
                        step="0.01" 
                        value={form.pnl} 
                        onChange={handleChange} 
                        onWheel={(e) => e.target.blur()} 
                        className={`w-full bg-neutral-900 text-[#e5e5e5] pl-10 pr-3 py-2 rounded-lg border focus:ring-2 transition-all text-sm font-medium ${
                          form.pnl && Number(form.pnl) > 0 
                            ? 'border-green-500/50 focus:ring-green-500 text-green-300' 
                            : form.pnl && Number(form.pnl) < 0 
                            ? 'border-red-500/50 focus:ring-red-500 text-red-300'
                            : 'border-neutral-600/50 focus:ring-slate-500'
                        }`} 
                        placeholder="$" 
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-neutral-400 mb-1">R:R</label>
                    <input name="rr" type="number" step="0.01" value={form.rr} onChange={handleChange} onWheel={(e) => e.target.blur()} className="w-full bg-neutral-900 text-[#e5e5e5] p-2 rounded-md border-none focus:ring-2 focus:ring-purple-700 transition-all text-sm" placeholder="e.g. 2.5" />
                  </div>
                  {/* Row 2: Entry Time, Exit Time, Duration */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-neutral-400 mb-1">Entry Time</label>
                    <div className="relative">
                      <ClockIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
                      <input name="entryTime" type="text" value={form.entryTime} onChange={handleChange} className="w-full bg-neutral-900 text-[#e5e5e5] pl-10 pr-3 py-2 rounded-lg border border-neutral-600/50 focus:ring-2 focus:ring-slate-500 focus:border-slate-400 transition-all text-sm font-medium" placeholder="e.g. 09:30" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-neutral-400 mb-1">Exit Time</label>
                    <div className="relative">
                      <ClockIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
                      <input name="exitTime" type="text" value={form.exitTime} onChange={handleChange} className="w-full bg-neutral-900 text-[#e5e5e5] pl-10 pr-3 py-2 rounded-lg border border-neutral-600/50 focus:ring-2 focus:ring-slate-500 focus:border-slate-400 transition-all text-sm font-medium" placeholder="e.g. 10:15" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-neutral-400 mb-1">Duration</label>
                    <input name="duration" type="text" value={form.duration} readOnly className="w-full bg-neutral-700/80 text-neutral-400 p-2 rounded-lg border border-neutral-600/30 text-sm font-medium" placeholder="Auto-calculated" />
                  </div>
                </div>
              </motion.div>

              {/* Notes Panel */}
              <motion.div className="bg-gradient-to-br from-teal-900/30 to-cyan-900/30 rounded-2xl p-6 border border-teal-500/20 shadow-xl backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-teal-500/20 rounded-lg">
                    <DocumentTextIcon className="w-5 h-5 text-teal-400" />
                  </div>
                  <div className="text-lg font-bold text-teal-300">{entryType === 'tape' ? 'Tape Reading Notes' : 'Trade Notes'}</div>
                </div>
                <div className="flex flex-col">
                  <label className="text-sm font-semibold text-teal-300 mb-3">Notes:</label>
                  <textarea 
                    name="notes" 
                    value={form.notes} 
                    onChange={handleChange} 
                    className="w-full bg-neutral-900/80 text-[#e5e5e5] p-4 rounded-lg border border-neutral-600/50 focus:ring-2 focus:ring-teal-500 focus:border-teal-400 transition-all resize-none h-36 text-sm font-medium" 
                    placeholder={entryType === 'tape' ? "Enter your tape reading notes here..." : "Enter your trade notes here..."}
                  />
                </div>
              </motion.div>
            </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Full-Screen Image Viewer */}
      {showImageViewer && screenshots.length > 0 && (
        <div className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-sm flex items-center justify-center">
          <div className="relative w-full h-full flex items-center justify-center p-4">
            {/* Close Button */}
            <button
              onClick={() => setShowImageViewer(false)}
              className="absolute top-4 right-4 z-50 bg-red-600 hover:bg-red-700 text-white rounded-full p-3 hover:scale-110 transition-all duration-200 shadow-lg"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>

            {/* Navigation Arrows */}
            {screenshots.length > 1 && (
              <>
                <button
                  onClick={() => setSelectedImageIndex(prev => prev > 0 ? prev - 1 : screenshots.length - 1)}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 z-50 bg-neutral-800 hover:bg-neutral-700 text-white rounded-full p-3 hover:scale-110 transition-all duration-200 shadow-lg"
                >
                  ←
                </button>
                <button
                  onClick={() => setSelectedImageIndex(prev => prev < screenshots.length - 1 ? prev + 1 : 0)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 z-50 bg-neutral-800 hover:bg-neutral-700 text-white rounded-full p-3 hover:scale-110 transition-all duration-200 shadow-lg"
                >
                  →
                </button>
              </>
            )}

            {/* Image */}
            <img
              src={screenshots[selectedImageIndex]}
              alt={`Screenshot ${selectedImageIndex + 1}`}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={() => setShowImageViewer(false)}
            />

            {/* Image Counter */}
            {screenshots.length > 1 && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-neutral-800/90 text-white px-4 py-2 rounded-full text-sm font-medium">
                {selectedImageIndex + 1} / {screenshots.length}
              </div>
            )}
          </div>
        </div>
      )}
    </form>
  );
};

export default JournalEntryForm; 