import React, { useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  CurrencyDollarIcon,
  ClockIcon,
  ChartBarIcon,
  CameraIcon,
  DocumentTextIcon,
  FaceSmileIcon,
  ScaleIcon,
  BanknotesIcon
} from "@heroicons/react/24/outline";
import { storage } from '../firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';

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
];

const JournalEntryForm = ({ onSave, onCancel, initialAccountBalance }) => {
  const [form, setForm] = useState({ ...initialState, accountBalance: initialAccountBalance ?? "" });
  const [screenshots, setScreenshots] = useState([]);
  const [accountManuallyEdited, setAccountManuallyEdited] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [entryType, setEntryType] = useState('trade');
  const fileInputRef = useRef();
  const [dragActive, setDragActive] = useState(false);

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
    if (name === "pnl" && !accountManuallyEdited && form.accountBalance !== "") {
      const prevBalance = parseFloat(initialAccountBalance ?? form.accountBalance) || 0;
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
    // Upload screenshots to Firebase Storage and get URLs
    const urls = await Promise.all(
      screenshots.map(async (src, idx) => {
        if (src.startsWith('http')) return src; // already a URL
        const imageRef = ref(storage, `screenshots/${Date.now()}-${idx}.jpg`);
        await uploadString(imageRef, src, 'data_url');
        return await getDownloadURL(imageRef);
      })
    );
    setUploading(false);
    onSave({
      ...form,
      pnl: entryType === 'trade' ? parseFloat(form.pnl) || 0 : 0,
      rr: entryType === 'trade' ? parseFloat(form.rr) || 0 : 0,
      accountBalance: parseFloat(form.accountBalance) || 0,
      screenshots: urls,
      created: new Date().toISOString(),
      tapeReading: entryType === 'tape',
      isDeposit: entryType === 'deposit',
    });
    setForm(initialState);
    setScreenshots([]);
  };

  return (
    <form onSubmit={handleSubmit} className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-95">
      <motion.div initial="hidden" animate="visible" variants={{}} className="w-full h-full bg-black p-0 flex flex-col gap-10 overflow-y-auto border-none px-2 sm:px-8">
        {/* Entry Type Dropdown */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="flex items-center gap-4 px-8 pt-2 pb-2">
          <label className="text-lg font-semibold text-[#e5e5e5]">Entry Type</label>
          <select
            value={entryType}
            onChange={handleEntryTypeChange}
            className="bg-neutral-900 text-[#e5e5e5] p-2 rounded-md border-none focus:ring-2 focus:ring-blue-700 transition-all"
          >
            {entryTypeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </motion.div>
        {/* Render fields based on entryType */}
        {entryType === 'deposit' ? (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="bg-blue-900/40 rounded-xl px-8 py-6 mb-2 shadow-md flex flex-col gap-8">
            <div className="flex flex-col gap-2 flex-1 min-w-[220px]">
              <label className="text-xs font-semibold text-blue-300 mb-1">Account Balance After Deposit</label>
              <input name="accountBalance" type="number" step="0.01" value={form.accountBalance} onChange={handleChange} className="w-full bg-neutral-900 text-[#e5e5e5] p-3 rounded-md border-none focus:ring-2 focus:ring-blue-700 transition-all" />
            </div>
            <div className="flex flex-col gap-2 w-full">
              <label className="text-xl font-extrabold text-blue-400 mb-1">Notes (optional)</label>
              <textarea name="notes" value={form.notes} onChange={handleChange} className="w-full bg-neutral-900 text-[#e5e5e5] p-6 rounded-xl border-none focus:ring-2 focus:ring-blue-700 transition-all min-h-[120px] text-2xl font-bold" />
            </div>
          </motion.div>
        ) : entryType === 'tape' ? (
          <>
            {/* Tape Reading: Only screenshots and notes */}
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              className={`relative flex flex-col items-center justify-center px-8 pt-10 pb-6 rounded-2xl border-2 border-neutral-800 bg-neutral-900/80 shadow-lg mb-2`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="flex flex-col items-center w-full">
                <CameraIcon className="w-10 h-10 text-blue-400 mb-2" />
                <div className="text-xl font-bold text-[#e5e5e5] mb-2">Upload Screenshots</div>
                <div className="text-sm text-neutral-400 mb-4">Drag & drop images here, or</div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current.click()}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-lg text-lg font-bold shadow-lg mb-4"
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
                  <div className="flex flex-wrap gap-4 mt-4 w-full justify-center">
                    {screenshots.map((src, idx) => (
                      <div key={idx} className="relative group">
                        <img src={src} alt="Screenshot" className="w-32 h-32 object-cover rounded-lg border-2 border-white/10 shadow-md" />
                        <button type="button" onClick={() => handleRemoveScreenshot(idx)} className="absolute top-1 right-1 bg-black/70 text-[#e5e5e5] rounded-full px-2 py-0.5 text-xs opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              className="bg-neutral-900/80 rounded-xl px-8 py-6 mb-2 shadow-md">
              <div className="flex items-center gap-3 mb-6">
                <DocumentTextIcon className="w-7 h-7 text-blue-300" />
                <div className="text-2xl font-bold text-[#e5e5e5]">Notes</div>
              </div>
              <div className="flex flex-col gap-2 w-full">
                <label className="text-xl font-extrabold text-blue-400 mb-1">Notes</label>
                <textarea name="notes" value={form.notes} onChange={handleChange} className="w-full bg-neutral-900 text-[#e5e5e5] p-6 rounded-xl border-none focus:ring-2 focus:ring-blue-700 transition-all min-h-[120px] text-2xl font-bold" />
              </div>
            </motion.div>
          </>
        ) : (
          <>
            {/* Screenshots Upload Section */}
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              className={`relative flex flex-col items-center justify-center px-8 pt-10 pb-6 rounded-2xl border-2 ${dragActive ? 'border-green-400 bg-green-900/10' : 'border-neutral-800 bg-neutral-900/80'} shadow-lg mb-2`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="flex flex-col items-center w-full">
                <CameraIcon className="w-10 h-10 text-blue-400 mb-2" />
                <div className="text-xl font-bold text-[#e5e5e5] mb-2">Upload Screenshots</div>
                <div className="text-sm text-neutral-400 mb-4">Drag & drop images here, or</div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current.click()}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-lg text-lg font-bold shadow-lg mb-4"
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
                  <div className="flex flex-wrap gap-4 mt-4 w-full justify-center">
                    {screenshots.map((src, idx) => (
                      <div key={idx} className="relative group">
                        <img src={src} alt="Screenshot" className="w-32 h-32 object-cover rounded-lg border-2 border-white/10 shadow-md" />
                        <button type="button" onClick={() => handleRemoveScreenshot(idx)} className="absolute top-1 right-1 bg-black/70 text-[#e5e5e5] rounded-full px-2 py-0.5 text-xs opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
            {/* Trade Setup Section */}
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              className="bg-neutral-900/80 rounded-xl px-8 py-6 mb-2 shadow-md">
              <div className="flex items-center gap-3 mb-6">
                <ChartBarIcon className="w-7 h-7 text-blue-400" />
                <div className="text-2xl font-bold text-[#e5e5e5]">Trade Setup</div>
              </div>
              <div className="flex flex-wrap gap-8 w-full">
                <div className="flex flex-col gap-4 flex-1 min-w-[220px]">
                  <label className="text-xs font-semibold text-neutral-400 mb-1">Ticker</label>
                  <select name="tickerTraded" value={form.tickerTraded} onChange={handleChange} className="w-full bg-neutral-900 text-[#e5e5e5] p-3 rounded-md border-none focus:ring-2 focus:ring-neutral-700 transition-all" >
                    {tickerOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-4 flex-1 min-w-[220px]">
                  <label className="text-xs font-semibold text-neutral-400 mb-1">Grade</label>
                  <select name="grade" value={form.grade} onChange={handleChange} className="w-full bg-neutral-900 text-[#e5e5e5] p-3 rounded-md border-none focus:ring-2 focus:ring-neutral-700 transition-all" >
                    {gradeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-4 flex-1 min-w-[220px]">
                  <label className="text-xs font-semibold text-neutral-400 mb-1">Session</label>
                  <select name="session" value={form.session} onChange={handleChange} className="w-full bg-neutral-900 text-[#e5e5e5] p-3 rounded-md border-none focus:ring-2 focus:ring-neutral-700 transition-all" >
                    {sessionOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-4 flex-1 min-w-[220px]">
                  <label className="text-xs font-semibold text-neutral-400 mb-1">Liquidity Sweep</label>
                  <select name="liquiditySweep" value={form.liquiditySweep} onChange={handleChange} className="w-full bg-neutral-900 text-[#e5e5e5] p-3 rounded-md border-none focus:ring-2 focus:ring-neutral-700 transition-all" >
                    {liquidityOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-4 flex-1 min-w-[220px]">
                  <label className="text-xs font-semibold text-neutral-400 mb-1">MACRO</label>
                  <select name="macro" value={form.macro} onChange={handleChange} className="w-full bg-neutral-900 text-[#e5e5e5] p-3 rounded-md border-none focus:ring-2 focus:ring-neutral-700 transition-all" >
                    {macroOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-4 flex-1 min-w-[220px]">
                  <label className="text-xs font-semibold text-neutral-400 mb-1">OTE</label>
                  <select name="ote" value={form.ote} onChange={handleChange} className="w-full bg-neutral-900 text-[#e5e5e5] p-3 rounded-md border-none focus:ring-2 focus:ring-neutral-700 transition-all" >
                    {oteOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-4 flex-1 min-w-[220px]">
                  <label className="text-xs font-semibold text-neutral-400 mb-1">Target</label>
                  <select name="target" value={form.target} onChange={handleChange} className="w-full bg-neutral-900 text-[#e5e5e5] p-3 rounded-md border-none focus:ring-2 focus:ring-neutral-700 transition-all" >
                    {targetOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              </div>
            </motion.div>
            {/* P&L & Risk/Reward Section */}
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              className="bg-neutral-900/80 rounded-xl px-8 py-6 mb-2 shadow-md">
              <div className="flex items-center gap-3 mb-6">
                <CurrencyDollarIcon className="w-7 h-7 text-green-400" />
                <div className="text-2xl font-bold text-[#e5e5e5]">P&L & Risk/Reward</div>
              </div>
              <div className="flex flex-wrap gap-8 w-full">
                <div className="flex flex-col gap-2 flex-1 min-w-[220px]">
                  <label className="text-xs font-semibold text-neutral-400 mb-1">P&L</label>
                  <input name="pnl" type="number" step="0.01" value={form.pnl} onChange={handleChange} className="w-full bg-neutral-900 text-[#e5e5e5] p-3 rounded-md border-none focus:ring-2 focus:ring-green-700 transition-all" placeholder="$" disabled={entryType !== 'trade'} />
                </div>
                <div className="flex flex-col gap-2 flex-1 min-w-[220px]">
                  <label className="text-xs font-semibold text-neutral-400 mb-1">R:R <span className="ml-1 text-neutral-500">(Risk to Reward Ratio)</span></label>
                  <input name="rr" type="number" step="0.01" value={form.rr} onChange={handleChange} className="w-full bg-neutral-900 text-[#e5e5e5] p-3 rounded-md border-none focus:ring-2 focus:ring-purple-700 transition-all" placeholder="e.g. 2.5" disabled={entryType !== 'trade'} />
                </div>
                <div className="flex flex-col gap-2 flex-1 min-w-[220px]">
                  <label className="text-xs font-semibold text-neutral-400 mb-1">Account Balance</label>
                  <input name="accountBalance" type="number" step="0.01" value={form.accountBalance} onChange={handleChange} className="w-full bg-neutral-900 text-[#e5e5e5] p-3 rounded-md border-none focus:ring-2 focus:ring-neutral-700 transition-all" />
                </div>
                <div className="flex flex-col gap-2 flex-1 min-w-[220px]">
                  <label className="text-xs font-semibold text-neutral-400 mb-1">Duration</label>
                  <input name="duration" type="text" value={form.duration} onChange={handleChange} className="w-full bg-neutral-900 text-[#e5e5e5] p-3 rounded-md border-none focus:ring-2 focus:ring-neutral-700 transition-all" />
                </div>
              </div>
            </motion.div>
            {/* Trade Times Section */}
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              className="bg-neutral-900/80 rounded-xl px-8 py-6 mb-2 shadow-md">
              <div className="flex items-center gap-3 mb-6">
                <ClockIcon className="w-7 h-7 text-yellow-400" />
                <div className="text-2xl font-bold text-[#e5e5e5]">Trade Times</div>
              </div>
              <div className="flex flex-wrap gap-8 w-full">
                <div className="flex flex-col gap-2 flex-1 min-w-[220px]">
                  <label className="text-xs font-semibold text-neutral-400 mb-1">Entry Time</label>
                  <input name="entryTime" type="text" value={form.entryTime} onChange={handleChange} className="w-full bg-neutral-900 text-[#e5e5e5] p-3 rounded-md border-none focus:ring-2 focus:ring-neutral-700 transition-all" />
                </div>
                <div className="flex flex-col gap-2 flex-1 min-w-[220px]">
                  <label className="text-xs font-semibold text-neutral-400 mb-1">Exit Time</label>
                  <input name="exitTime" type="text" value={form.exitTime} onChange={handleChange} className="w-full bg-neutral-900 text-[#e5e5e5] p-3 rounded-md border-none focus:ring-2 focus:ring-neutral-700 transition-all" />
                </div>
              </div>
            </motion.div>
            {/* Emotional Review Section */}
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              className="bg-neutral-900/80 rounded-xl px-8 py-6 mb-2 shadow-md">
              <div className="flex items-center gap-3 mb-6">
                <FaceSmileIcon className="w-7 h-7 text-pink-400" />
                <div className="text-2xl font-bold text-[#e5e5e5]">Emotional Review</div>
              </div>
              <div className="flex flex-col gap-2 w-full">
                <label className="text-lg font-bold text-pink-300 mb-1">Emotional Review</label>
                <textarea name="howFeltBefore" value={form.howFeltBefore} onChange={handleChange} className="w-full bg-neutral-900 text-[#e5e5e5] p-4 rounded-lg border-none focus:ring-2 focus:ring-pink-700 transition-all min-h-[90px] text-lg" />
              </div>
            </motion.div>
            {/* Premarket Analysis & Notes Section */}
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              className="bg-neutral-900/80 rounded-xl px-8 py-6 mb-2 shadow-md">
              <div className="flex items-center gap-3 mb-6">
                <DocumentTextIcon className="w-7 h-7 text-blue-300" />
                <div className="text-2xl font-bold text-[#e5e5e5]">Premarket Analysis & Notes</div>
              </div>
              <div className="flex flex-col gap-8 w-full">
                <div className="flex flex-col gap-2 w-full">
                  <label className="text-lg font-bold text-blue-200 mb-1">Premarket Analysis</label>
                  <textarea name="premarketAnalysis" value={form.premarketAnalysis} onChange={handleChange} className="w-full bg-neutral-900 text-[#e5e5e5] p-4 rounded-lg border-none focus:ring-2 focus:ring-blue-700 transition-all min-h-[60px] text-lg" />
                </div>
                <div className="flex flex-col gap-2 w-full">
                  <label className="text-xl font-extrabold text-blue-400 mb-1">Notes</label>
                  <textarea name="notes" value={form.notes} onChange={handleChange} className="w-full bg-neutral-900 text-[#e5e5e5] p-6 rounded-xl border-none focus:ring-2 focus:ring-blue-700 transition-all min-h-[120px] text-2xl font-bold" />
                </div>
              </div>
            </motion.div>
          </>
        )}
        {/* Simple Save Button at the bottom */}
        <div className="flex gap-6 mt-8 justify-end w-full px-8 pb-8">
          <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.98 }} type="submit" className="bg-green-600 hover:bg-green-500 text-white px-10 py-4 rounded-md text-xl font-bold transition-all border-none outline-none shadow-lg" disabled={uploading}>{uploading ? 'Uploading...' : 'Save'}</motion.button>
          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.98 }} type="button" className="bg-neutral-900 hover:bg-neutral-800 text-[#e5e5e5] px-10 py-4 rounded-md text-xl transition-all border-none outline-none shadow-none" onClick={onCancel} disabled={uploading}>Cancel</motion.button>
        </div>
      </motion.div>
    </form>
  );
};

export default JournalEntryForm; 