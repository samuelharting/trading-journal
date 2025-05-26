import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  CurrencyDollarIcon,
  ClockIcon,
  ChartBarIcon,
  CameraIcon,
  DocumentTextIcon,
  FaceSmileIcon,
  ScaleIcon
} from "@heroicons/react/24/outline";

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

const JournalEntryForm = ({ onSave, onCancel, initialAccountBalance }) => {
  const [form, setForm] = useState({ ...initialState, accountBalance: initialAccountBalance ?? "" });
  const [screenshots, setScreenshots] = useState([]);
  const [accountManuallyEdited, setAccountManuallyEdited] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === "accountBalance") setAccountManuallyEdited(true);
    if (name === "pnl" && !accountManuallyEdited && form.accountBalance !== "") {
      // Update account balance live if not manually edited
      const prevBalance = parseFloat(initialAccountBalance ?? form.accountBalance) || 0;
      const pnl = parseFloat(value) || 0;
      setForm((prev) => ({ ...prev, accountBalance: (prevBalance + pnl).toFixed(2) }));
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    Promise.all(files.map(file => {
      return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target.result);
        reader.readAsDataURL(file);
      });
    })).then(images => {
      setScreenshots(prev => [...prev, ...images]);
    });
    e.target.value = null;
  };

  const handleRemoveScreenshot = (idx) => {
    setScreenshots(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      pnl: parseFloat(form.pnl) || 0,
      rr: parseFloat(form.rr) || 0,
      accountBalance: parseFloat(form.accountBalance) || 0,
      screenshots,
      created: new Date().toISOString(),
    });
    setForm(initialState);
    setScreenshots([]);
  };

  return (
    <form onSubmit={handleSubmit} className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-95">
      <motion.div initial="hidden" animate="visible" variants={{}} className="w-full max-w-6xl bg-black p-0 rounded-lg shadow-2xl flex flex-col gap-12 h-[98vh] overflow-y-auto border-none">
        {/* Section 1: Trade Setup */}
        <motion.div custom={0} variants={sectionVariants} className="mb-2 w-full">
          <div className="text-2xl font-bold mb-8 px-8 pt-12 pb-2 text-[#e5e5e5]">Trade Setup</div>
          <div className="flex flex-wrap gap-8 w-full px-8">
            {/* Dropdowns group */}
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
        {/* Section 2: P&L & Risk/Reward */}
        <motion.div custom={1} variants={sectionVariants} className="mb-2 w-full">
          <div className="text-2xl font-bold mb-8 px-8 pt-8 pb-2 text-[#e5e5e5]">P&L & Risk/Reward</div>
          <div className="flex flex-wrap gap-8 w-full px-8">
            <div className="flex flex-col gap-2 flex-1 min-w-[220px]">
              <label className="text-xs font-semibold text-neutral-400 mb-1">P&L</label>
              <input name="pnl" type="number" step="0.01" value={form.pnl} onChange={handleChange} className="w-full bg-neutral-900 text-[#e5e5e5] p-3 rounded-md border-none focus:ring-2 focus:ring-green-700 transition-all" placeholder="$" />
            </div>
            <div className="flex flex-col gap-2 flex-1 min-w-[220px]">
              <label className="text-xs font-semibold text-neutral-400 mb-1">R:R <span className="ml-1 text-neutral-500">(Risk to Reward Ratio)</span></label>
              <input name="rr" type="number" step="0.01" value={form.rr} onChange={handleChange} className="w-full bg-neutral-900 text-[#e5e5e5] p-3 rounded-md border-none focus:ring-2 focus:ring-purple-700 transition-all" placeholder="e.g. 2.5" />
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
        {/* Section 3: Trade Times */}
        <motion.div custom={2} variants={sectionVariants} className="mb-2 w-full">
          <div className="text-2xl font-bold mb-8 px-8 pt-8 pb-2 text-[#e5e5e5]">Trade Times</div>
          <div className="flex flex-wrap gap-8 w-full px-8">
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
        {/* Section 4: Emotional Review */}
        <motion.div custom={3} variants={sectionVariants} className="mb-2 w-full">
          <div className="text-2xl font-bold mb-8 px-8 pt-8 pb-2 text-[#e5e5e5]">Emotional Review</div>
          <div className="flex flex-wrap gap-8 w-full px-8">
            <div className="flex flex-col gap-2 flex-1 min-w-[220px]">
              <label className="text-xs font-semibold text-neutral-400 mb-1">How I Felt Before the Trade</label>
              <textarea name="howFeltBefore" value={form.howFeltBefore} onChange={handleChange} className="w-full bg-neutral-900 text-[#e5e5e5] p-3 rounded-md border-none focus:ring-2 focus:ring-neutral-700 transition-all min-h-[60px]" />
            </div>
            <div className="flex flex-col gap-2 flex-1 min-w-[220px]">
              <label className="text-xs font-semibold text-neutral-400 mb-1">How I Felt During the Trade</label>
              <textarea name="howFeltDuring" value={form.howFeltDuring} onChange={handleChange} className="w-full bg-neutral-900 text-[#e5e5e5] p-3 rounded-md border-none focus:ring-2 focus:ring-neutral-700 transition-all min-h-[60px]" />
            </div>
            <div className="flex flex-col gap-2 flex-1 min-w-[220px]">
              <label className="text-xs font-semibold text-neutral-400 mb-1">How I Felt After the Trade</label>
              <textarea name="howFeltAfter" value={form.howFeltAfter} onChange={handleChange} className="w-full bg-neutral-900 text-[#e5e5e5] p-3 rounded-md border-none focus:ring-2 focus:ring-neutral-700 transition-all min-h-[60px]" />
            </div>
          </div>
        </motion.div>
        {/* Section 5: Trade Plan & Notes */}
        <motion.div custom={4} variants={sectionVariants} className="mb-2 w-full">
          <div className="text-2xl font-bold mb-8 px-8 pt-8 pb-2 text-[#e5e5e5]">Trade Plan & Notes</div>
          <div className="w-full px-8 flex flex-col gap-8">
            <div className="flex flex-col gap-2 w-full">
              <label className="text-xs font-semibold text-neutral-400 mb-1">Premarket Analysis</label>
              <textarea name="premarketAnalysis" value={form.premarketAnalysis} onChange={handleChange} className="w-full bg-neutral-900 text-[#e5e5e5] p-3 rounded-md border-none focus:ring-2 focus:ring-neutral-700 transition-all min-h-[60px]" />
            </div>
            <div className="flex flex-col gap-2 w-full">
              <label className="text-xs font-semibold text-neutral-400 mb-1">Notes</label>
              <textarea name="notes" value={form.notes} onChange={handleChange} className="w-full bg-neutral-900 text-[#e5e5e5] p-3 rounded-md border-none focus:ring-2 focus:ring-neutral-700 transition-all min-h-[100px] text-lg" />
            </div>
          </div>
        </motion.div>
        {/* Section 6: Screenshots */}
        <motion.div custom={5} variants={sectionVariants} className="mb-2 w-full">
          <div className="text-2xl font-bold mb-8 px-8 pt-8 pb-2 text-[#e5e5e5]">Screenshots</div>
          <div className="w-full px-8">
            <input type="file" accept="image/*" multiple onChange={handleFileChange} className="mb-4 text-[#e5e5e5] bg-neutral-900 p-3 rounded-md border-none focus:ring-2 focus:ring-neutral-700 transition-all" />
            <div className="flex gap-4 flex-wrap mb-2">
              {screenshots.map((src, idx) => (
                <div key={idx} className="relative group">
                  <img src={src} alt="Screenshot" className="w-32 h-32 object-cover rounded-md border-none" />
                  <button type="button" onClick={() => handleRemoveScreenshot(idx)} className="absolute top-1 right-1 bg-black bg-opacity-70 text-[#e5e5e5] rounded-full px-2 py-0.5 text-xs opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
        {/* Actions */}
        <div className="flex gap-6 mt-8 justify-end w-full px-8 pb-8">
          <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.98 }} type="submit" className="bg-neutral-800 hover:bg-neutral-700 text-[#e5e5e5] px-10 py-4 rounded-md text-xl font-bold transition-all border-none outline-none shadow-none">Save</motion.button>
          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.98 }} type="button" className="bg-neutral-900 hover:bg-neutral-800 text-[#e5e5e5] px-10 py-4 rounded-md text-xl transition-all border-none outline-none shadow-none" onClick={onCancel}>Cancel</motion.button>
        </div>
      </motion.div>
    </form>
  );
};

export default JournalEntryForm; 