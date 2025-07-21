import React, { useState, useRef, useContext } from "react";
import { motion } from "framer-motion";
import {
  CurrencyDollarIcon,
  ClockIcon,
  ChartBarIcon,
  CameraIcon,
  DocumentTextIcon,
  FaceSmileIcon,
  ScaleIcon,
  BanknotesIcon,
  QuestionMarkCircleIcon
} from "@heroicons/react/24/outline";
import { storage } from '../firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { UserContext } from '../App';

const gradeOptions = ["A+", "A", "B", "C", "D"];
const tickerOptions = ["MES", "MNQ", "BTC", "GL", "SL"];
const sessionOptions = ["AM", "PM"];
const liquidityOptions = ["Yes", "No"];
const macroOptions = ["Yes", "No"];
const oteOptions = ["Yes", "No"];
const targetOptions = ["HTF Liquidity", "REH", "REL", "EQ", "NDOG", "inefficiency"];

const initialState = {
  ticker: "",
  pnl: "",
  rr: "",
  notes: "",
  accountBalance: "",
  duration: "",
  entryTime: "",
  exitTime: "",
  howFeltBefore: "",
  premarketAnalysis: "",
  howFeltDuring: "",
  howFeltAfter: "",
  grade: "A",
  tickerTraded: "MES",
  session: "AM",
  liquiditySweep: "No",
  screenshots: [],
  macro: "No",
  ote: "No",
  target: "HTF Liquidity",
};

const iconClass = "w-5 h-5 inline-block mr-2 text-blue-400 align-middle";

const sectionVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.10, duration: 0.4 } })
};

const entryTypeOptions = [
  { value: 'trade', label: 'Trade' },
  { value: 'tape', label: 'Tape Reading' },
  { value: 'deposit', label: 'Deposit/Paycheck' },
  { value: 'payout', label: 'Payout' },
];

function Tooltip({ text }) {
  return (
    <span className="relative group cursor-pointer">
      <QuestionMarkCircleIcon className="w-4 h-4 text-blue-400 inline ml-1 align-text-top" />
      <span className="absolute left-1/2 -translate-x-1/2 mt-2 w-48 bg-neutral-800 text-xs text-blue-200 rounded-lg shadow-lg p-2 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
        {text}
      </span>
    </span>
  );
}

function Toggle({ value, onChange, label, tooltip }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-blue-300 text-sm font-semibold">{label}{tooltip && <Tooltip text={tooltip} />}</span>
      <button type="button" onClick={() => onChange(!value)} className={`ml-2 w-10 h-6 rounded-full transition-colors duration-200 ${value ? 'bg-green-500' : 'bg-neutral-700'}`}> 
        <span className={`block w-5 h-5 rounded-full bg-white shadow transform transition-transform duration-200 ${value ? 'translate-x-4' : ''}`}></span>
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

const JournalEntryForm = ({ onSave, onCancel, initialAccountBalance }) => {
  const { currentUser, selectedAccount } = useContext(UserContext);
  const [form, setForm] = useState({ ...initialState, accountBalance: initialAccountBalance ?? "" });
  const [screenshots, setScreenshots] = useState([]);
  const [accountManuallyEdited, setAccountManuallyEdited] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [entryType, setEntryType] = useState('trade');
  const fileInputRef = useRef();
  const [dragActive, setDragActive] = useState(false);

  // Add new state for all toggles and POI
  const [sessionContext, setSessionContext] = useState({
    dailyHighLowTaken: false,
    aboveBelow0000: '',
    aboveBelow0830: '',
    aboveBelow0930: '',
    macroRange: false,
  });
  const [tradeEnv, setTradeEnv] = useState({
    judasSwing: false,
    silverBullet: false,
    manipulation: false,
    smt: false,
  });
  const [poi, setPoi] = useState('');
  const [poiContext, setPoiContext] = useState({
    poiYesNo: false,
  });
  // Add new state for economic release and day of week
  const [economicRelease, setEconomicRelease] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("");

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
    if (name === "accountBalance") setAccountManuallyEdited(true);
    if (name === "pnl" && !accountManuallyEdited && entryType === 'trade' && initialAccountBalance) {
      const prevBalance = parseFloat(initialAccountBalance) || 0;
      const pnl = parseFloat(value) || 0;
      setForm((prev) => ({ ...prev, accountBalance: (prevBalance + pnl).toFixed(2) }));
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragActive(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
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
    setUploading(true);
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
    const trimmedEntry = trimFirestoreDoc({
      ...form,
      pnl: entryType === 'trade' ? parseFloat(form.pnl) || 0 : 
           entryType === 'payout' ? -(parseFloat(form.pnl) || 0) : 0,
      rr: entryType === 'trade' ? parseFloat(form.rr) || 0 : 0,
      accountBalance: parseFloat(form.accountBalance) || 0,
      screenshots: urls,
      created: new Date().toISOString(),
      tapeReading: entryType === 'tape',
      isDeposit: entryType === 'deposit',
      isPayout: entryType === 'payout',
    });
    if (trimmedEntry && currentUser && selectedAccount) {
      const { db } = await import('../firebase');
      const { collection, addDoc } = await import('firebase/firestore');
      const entriesCol = collection(db, 'users', currentUser.uid, 'accounts', selectedAccount.id, 'entries');
      await addDoc(entriesCol, trimmedEntry);
      onSave(trimmedEntry);
      setForm(initialState);
      setScreenshots([]);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-95">
      <motion.div initial="hidden" animate="visible" variants={{}} className="w-full h-full bg-black p-0 flex flex-col gap-6 sm:gap-10 overflow-y-auto border-none px-2 sm:px-8">
        {/* Entry Type Dropdown */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="flex items-center gap-4 px-4 sm:px-8 pt-2 pb-2">
          <label className="text-base sm:text-lg font-semibold text-[#e5e5e5]">Entry Type</label>
          <select
            value={entryType}
            onChange={handleEntryTypeChange}
            className="bg-neutral-900 text-[#e5e5e5] p-2 rounded-md border-none focus:ring-2 focus:ring-blue-700 transition-all text-sm sm:text-base"
          >
            {entryTypeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </motion.div>
        {/* Render fields based on entryType */}
        {(entryType === 'trade' || entryType === 'tape') && (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className={`relative flex flex-col items-center justify-center px-4 sm:px-8 pt-8 sm:pt-10 pb-4 sm:pb-6 rounded-2xl border-2 border-neutral-800 bg-neutral-900/80 shadow-lg mb-2`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center w-full">
              <CameraIcon className="w-8 h-8 sm:w-10 sm:h-10 text-blue-400 mb-2" />
              <div className="text-lg sm:text-xl font-bold text-[#e5e5e5] mb-2">Upload Screenshots</div>
              <div className="text-sm text-neutral-400 mb-4">Drag & drop images here, or</div>
              <button
                type="button"
                onClick={() => fileInputRef.current.click()}
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 sm:px-8 py-2 sm:py-3 rounded-lg text-base sm:text-lg font-bold shadow-lg mb-4"
              >
                Select Images
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              {screenshots.length > 0 && (
                <div className="flex flex-wrap gap-2 sm:gap-4 mt-4 w-full justify-center">
                  {screenshots.map((src, idx) => (
                    <div key={idx} className="relative group">
                      <img src={src} alt="Screenshot" className="w-24 h-24 sm:w-32 sm:h-32 object-cover rounded-lg border-2 border-white/10 shadow-md" />
                      <button type="button" onClick={() => handleRemoveScreenshot(idx)} className="absolute top-1 right-1 bg-black/70 text-[#e5e5e5] rounded-full px-2 py-0.5 text-xs opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
        {entryType === 'deposit' ? (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="bg-blue-900/40 rounded-xl px-4 sm:px-8 py-4 sm:py-6 mb-2 shadow-md flex flex-col gap-6 sm:gap-8">
            <div className="flex flex-col gap-2 flex-1 min-w-[220px]">
              <label className="text-xs font-semibold text-blue-300 mb-1">Account Balance After Deposit</label>
              <input name="accountBalance" type="number" step="0.01" value={form.accountBalance} onChange={handleChange} className="w-full bg-neutral-900 text-[#e5e5e5] p-3 rounded-md border-none focus:ring-2 focus:ring-blue-700 transition-all" />
            </div>
          </motion.div>
        ) : entryType === 'payout' ? (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="relative bg-neutral-900/90 rounded-2xl px-6 sm:px-12 py-8 mb-2 shadow-xl border border-blue-700/40 flex flex-col items-center gap-6">
            <div className="flex flex-col items-center mb-2">
              <span className="text-3xl font-extrabold text-blue-300 mb-1">Payout</span>
              <span className="text-base font-semibold text-blue-200 mb-2">Congrats on your payout!</span>
              <span className="text-xs text-blue-400 italic">Reward yourself for your discipline.</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
              <div className="flex flex-col gap-2 flex-1 min-w-[180px]">
                <label className="text-xs font-semibold text-blue-300 mb-1">Payout Amount</label>
                <input name="pnl" type="number" step="0.01" value={form.pnl} onChange={handleChange} className="w-full bg-neutral-900 text-blue-200 p-3 rounded-md border-none focus:ring-2 focus:ring-blue-400 transition-all text-xl font-bold" placeholder="Enter payout amount" />
              </div>
              <div className="flex flex-col gap-2 flex-1 min-w-[180px]">
                <label className="text-xs font-semibold text-blue-300 mb-1">Account Balance After Payout</label>
                <input name="accountBalance" type="number" step="0.01" value={form.accountBalance} onChange={handleChange} className="w-full bg-neutral-900 text-blue-200 p-3 rounded-md border-none focus:ring-2 focus:ring-blue-400 transition-all text-xl font-bold" />
              </div>
            </div>
          </motion.div>
        ) : (
          // Modern grouped trade form
          <>
            {/* Grouped Card Sections */}
            <motion.div className="bg-neutral-900/80 rounded-2xl p-6 mb-4 border border-white/10 shadow-md">
              <div className="flex items-center mb-4">
                <span className="text-lg font-bold text-blue-300">Session Context</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Toggle value={sessionContext.dailyHighLowTaken} onChange={v => setSessionContext(sc => ({ ...sc, dailyHighLowTaken: v }))} label="Was a daily high or low taken before the trade?" tooltip="Did price take out a daily high or low before your entry?" />
                <div>
                  <label className="text-blue-300 text-sm font-semibold flex items-center">Economic Release and Time <Tooltip text="E.g. CPI 8:30, FOMC 14:00, NFP, etc." /></label>
                  <input
                    type="text"
                    className="w-full bg-neutral-900 text-[#e5e5e5] p-2 rounded-md mt-1"
                    placeholder="e.g. CPI 8:30, FOMC 14:00"
                    value={economicRelease}
                    onChange={e => setEconomicRelease(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-blue-300 text-sm font-semibold flex items-center">Day of the Week</label>
                  <select
                    className="w-full bg-neutral-900 text-[#e5e5e5] p-2 rounded-md mt-1"
                    value={dayOfWeek}
                    onChange={e => setDayOfWeek(e.target.value)}
                  >
                    <option value="">Select Day</option>
                    <option value="Monday">Monday</option>
                    <option value="Tuesday">Tuesday</option>
                    <option value="Wednesday">Wednesday</option>
                    <option value="Thursday">Thursday</option>
                    <option value="Friday">Friday</option>
                  </select>
                </div>
                <div>
                  <label className="text-blue-300 text-sm font-semibold flex items-center">Was price above or below the 00:00 open? <Tooltip text="Relative to the midnight open price." /></label>
                  <select className="w-full bg-neutral-900 text-[#e5e5e5] p-2 rounded-md mt-1" value={sessionContext.aboveBelow0000} onChange={e => setSessionContext(sc => ({ ...sc, aboveBelow0000: e.target.value }))}>
                    <option value="">Select</option>
                    <option value="above">Above</option>
                    <option value="below">Below</option>
                  </select>
                </div>
                <div>
                  <label className="text-blue-300 text-sm font-semibold flex items-center">Was price above or below the 8:30 open? <Tooltip text="Relative to the 8:30am open price." /></label>
                  <select className="w-full bg-neutral-900 text-[#e5e5e5] p-2 rounded-md mt-1" value={sessionContext.aboveBelow0830} onChange={e => setSessionContext(sc => ({ ...sc, aboveBelow0830: e.target.value }))}>
                    <option value="">Select</option>
                    <option value="above">Above</option>
                    <option value="below">Below</option>
                  </select>
                </div>
                <div>
                  <label className="text-blue-300 text-sm font-semibold flex items-center">Was price above or below the 9:30 open? <Tooltip text="Relative to the 9:30am open price." /></label>
                  <select className="w-full bg-neutral-900 text-[#e5e5e5] p-2 rounded-md mt-1" value={sessionContext.aboveBelow0930} onChange={e => setSessionContext(sc => ({ ...sc, aboveBelow0930: e.target.value }))}>
                    <option value="">Select</option>
                    <option value="above">Above</option>
                    <option value="below">Below</option>
                  </select>
                </div>
                <Toggle value={sessionContext.macroRange} onChange={v => setSessionContext(sc => ({ ...sc, macroRange: v }))} label="Was price in a macro range?" tooltip="Was price consolidating in a higher timeframe range?" />
              </div>
            </motion.div>
            <motion.div className="bg-neutral-900/80 rounded-2xl p-6 mb-4 border border-white/10 shadow-md">
              <div className="flex items-center mb-4">
                <span className="text-lg font-bold text-blue-300">Trade Environment</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Toggle value={tradeEnv.judasSwing} onChange={v => setTradeEnv(te => ({ ...te, judasSwing: v }))} label="Was there a 9:30 Judas swing?" tooltip="Did price make a false move after the 9:30 open?" />
                <Toggle value={tradeEnv.silverBullet} onChange={v => setTradeEnv(te => ({ ...te, silverBullet: v }))} label="Was there a Silver Bullet?" tooltip="Was there a clear Silver Bullet setup?" />
                <Toggle value={tradeEnv.manipulation} onChange={v => setTradeEnv(te => ({ ...te, manipulation: v }))} label="Was there clear manipulation in the opposite direction?" tooltip="Did price move against your bias before your entry?" />
                <Toggle value={tradeEnv.smt} onChange={v => setTradeEnv(te => ({ ...te, smt: v }))} label="Was there SMT?" tooltip="Did you observe Smart Money Technique (SMT) divergence?" />
              </div>
            </motion.div>
            <motion.div className="bg-neutral-900/80 rounded-2xl p-6 mb-4 border border-white/10 shadow-md">
              <div className="flex items-center mb-4">
                <span className="text-lg font-bold text-blue-300">POI / Bias</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-blue-300 text-sm font-semibold flex items-center">POI <Tooltip text="Point of Interest for your trade." /></label>
                  <select className="w-full bg-neutral-900 text-[#e5e5e5] p-2 rounded-md mt-1" value={poi} onChange={e => setPoi(e.target.value)}>
                    <option value="">Select POI</option>
                    <option value="REHs">REHs</option>
                    <option value="RELs">RELs</option>
                    <option value="ORG">ORG</option>
                    <option value="HTF PD Array">HTF PD Array</option>
                    <option value="HTF Liquidity">HTF Liquidity</option>
                    <option value="EQ">EQ</option>
                  </select>
                </div>
              </div>
            </motion.div>
            {/* Trade core fields, unchanged but after new sections */}
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              className="bg-neutral-900/80 rounded-xl px-4 sm:px-8 py-4 sm:py-6 mb-2 shadow-md">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 w-full">
                {/* Row 1: Ticker | P&L */}
                <div className="flex flex-col gap-2 flex-1 min-w-[220px]">
                  <label className="text-xs font-semibold text-neutral-400 mb-1">Ticker</label>
                  <select name="tickerTraded" value={form.tickerTraded} onChange={handleChange} className="w-full bg-neutral-900 text-[#e5e5e5] p-3 rounded-md border-none focus:ring-2 focus:ring-neutral-700 transition-all" >
                    {tickerOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-2 flex-1 min-w-[220px]">
                  <label className="text-xs font-semibold text-neutral-400 mb-1">P&L</label>
                  <input name="pnl" type="number" step="0.01" value={form.pnl} onChange={handleChange} className="w-full bg-neutral-900 text-[#e5e5e5] p-3 rounded-md border-none focus:ring-2 focus:ring-green-700 transition-all" placeholder="$" />
                </div>
                {/* Row 2: R:R | Entry Time */}
                <div className="flex flex-col gap-2 flex-1 min-w-[220px]">
                  <label className="text-xs font-semibold text-neutral-400 mb-1">R:R <span className="ml-1 text-neutral-500">(Risk to Reward Ratio)</span></label>
                  <input name="rr" type="number" step="0.01" value={form.rr} onChange={handleChange} className="w-full bg-neutral-900 text-[#e5e5e5] p-3 rounded-md border-none focus:ring-2 focus:ring-purple-700 transition-all" placeholder="e.g. 2.5" />
                </div>
                <div className="flex flex-col gap-2 flex-1 min-w-[220px]">
                  <label className="text-xs font-semibold text-neutral-400 mb-1">Entry Time</label>
                  <input name="entryTime" type="text" value={form.entryTime} onChange={handleChange} className="w-full bg-neutral-900 text-[#e5e5e5] p-3 rounded-md border-none focus:ring-2 focus:ring-neutral-700 transition-all" placeholder="e.g. 09:30" />
                </div>
                {/* Row 3: Exit Time | (empty for symmetry) */}
                <div className="flex flex-col gap-2 flex-1 min-w-[220px]">
                  <label className="text-xs font-semibold text-neutral-400 mb-1">Exit Time</label>
                  <input name="exitTime" type="text" value={form.exitTime} onChange={handleChange} className="w-full bg-neutral-900 text-[#e5e5e5] p-3 rounded-md border-none focus:ring-2 focus:ring-neutral-700 transition-all" placeholder="e.g. 10:15" />
                </div>
                <div className="flex flex-col gap-2 flex-1 min-w-[220px]" />
              </div>
            </motion.div>
            {/* Current Account Size Field */}
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              className="bg-neutral-900/80 rounded-xl px-4 sm:px-8 py-4 sm:py-6 mb-2 shadow-md">
              <div className="flex flex-col gap-2 w-full">
                <label className="text-base sm:text-lg font-bold text-green-300 mb-1">Current Account Size (optional)</label>
                <input
                  name="accountBalance"
                  type="number"
                  step="0.01"
                  value={form.accountBalance}
                  onChange={handleChange}
                  className="w-full bg-neutral-900 text-green-200 p-3 rounded-md border-none focus:ring-2 focus:ring-green-400 transition-all text-lg font-bold"
                  placeholder="Enter current account size (leave blank to auto-calculate)"
                />
              </div>
            </motion.div>
            {/* Notes box for trade entry */}
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              className="bg-neutral-900/80 rounded-xl px-4 sm:px-8 py-4 sm:py-6 mb-2 shadow-md">
              <div className="flex items-center gap-3 mb-4 sm:mb-6">
                <DocumentTextIcon className="w-6 h-6 sm:w-7 sm:h-7 text-blue-300" />
                <div className="text-xl sm:text-2xl font-bold text-[#e5e5e5]">Notes</div>
              </div>
              <div className="flex flex-col gap-2 w-full">
                <label className="text-lg sm:text-xl font-extrabold text-blue-400 mb-1">Notes</label>
                <textarea name="notes" value={form.notes} onChange={handleChange} className="w-full bg-neutral-900 text-[#e5e5e5] p-4 sm:p-6 rounded-xl border-none focus:ring-2 focus:ring-blue-700 transition-all min-h-[120px] text-lg sm:text-2xl font-bold" />
              </div>
            </motion.div>
          </>
        )}
        {/* Simple Save Button at the bottom */}
        <div className="flex gap-4 sm:gap-6 mt-6 sm:mt-8 justify-end w-full px-4 sm:px-8 pb-4 sm:pb-8">
          <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.98 }} type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-xl text-2xl font-extrabold shadow-lg border-none outline-none mt-4" disabled={uploading}>{uploading ? 'Uploading...' : 'Save'}</motion.button>
          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.98 }} type="button" className="bg-neutral-900 hover:bg-neutral-800 text-[#e5e5e5] px-6 sm:px-10 py-3 sm:py-4 rounded-md text-lg sm:text-xl transition-all border-none outline-none shadow-none" onClick={onCancel} disabled={uploading}>Cancel</motion.button>
        </div>
      </motion.div>
    </form>
  );
};

export default JournalEntryForm; 