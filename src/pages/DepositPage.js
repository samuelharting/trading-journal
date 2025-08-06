import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../App";

export default function DepositPage() {
  const { currentUser, selectedAccount } = useContext(UserContext);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser || !selectedAccount || !amount) return;
    setSubmitting(true);
    try {
      const { db } = await import('../firebase');
      const { collection, addDoc, getDocs, query, orderBy } = await import('firebase/firestore');
      const entriesCol = collection(db, 'users', currentUser.uid, 'accounts', selectedAccount.id, 'entries');
      // Get latest account balance
      const snap = await getDocs(query(entriesCol, orderBy('created', 'desc')));
      let lastBal = 0;
      for (const doc of snap.docs) {
        const d = doc.data();
        if (d.accountBalance && !isNaN(Number(d.accountBalance))) {
          lastBal = Number(d.accountBalance);
          break;
        }
      }
      const now = new Date();
      const newBal = lastBal + Number(amount);
      await addDoc(entriesCol, {
        title,
        pnl: Number(amount), // Store deposit amount in pnl field for consistency
        notes,
        created: now.toISOString(),
        isDeposit: true,
        accountBalance: newBal,
        year: now.getFullYear().toString(),
        month: (now.getMonth() + 1).toString(),
        day: now.getDate().toString(),
      });
      navigate('/summary');
    } catch (err) { console.error('Deposit save error', err); }
    setSubmitting(false);
  };

  return (
    <div className="w-screen h-screen bg-gradient-to-br from-black via-emerald-950 to-green-900 flex flex-col pt-20">
      {/* Header Section */}
      <div className="flex-shrink-0 text-center py-8">
        <div className="inline-flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-2xl">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
            </svg>
          </div>
          <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-green-400 drop-shadow-2xl">
            DEPOSIT
          </h1>
        </div>
        <p className="text-2xl text-emerald-200 font-semibold">Adding funds to your trading account</p>
        <p className="text-lg text-emerald-300/80 mt-2">Keep building your capital 💰</p>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-4xl">
          <div className="bg-gradient-to-br from-emerald-900/40 via-black/60 to-green-950/40 backdrop-blur-xl border border-emerald-500/30 rounded-3xl shadow-2xl overflow-hidden">
            
            {/* Type Selector */}
            <div className="bg-gradient-to-r from-emerald-900/50 to-green-900/50 p-6 border-b border-emerald-500/20">
              <div className="flex items-center justify-center gap-4">
                <label className="text-xl font-bold text-emerald-200">Entry Type:</label>
                <select
                  value="deposit"
                  onChange={e => {
                    const value = e.target.value;
                    if (value === 'trade') navigate('/day');
                    else if (value === 'payout') navigate('/payout');
                    else if (value === 'taperead') navigate('/taperead');
                    else if (value === 'deposit') navigate('/deposit');
                  }}
                  className="bg-emerald-950/80 text-emerald-100 rounded-xl px-6 py-3 border-2 border-emerald-600 focus:outline-none focus:ring-4 focus:ring-emerald-400/50 text-xl font-bold shadow-lg min-w-[180px]"
                >
                  <option value="trade">Trade</option>
                  <option value="payout">Payout</option>
                  <option value="taperead">Tape Read</option>
                  <option value="deposit">Deposit</option>
                </select>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-12 space-y-10">
              {/* Title Input */}
              <div className="space-y-4">
                <label className="block text-xl font-bold text-emerald-300 text-center">Title (Optional)</label>
                <input
                  type="text"
                  className="w-full bg-emerald-950/60 text-emerald-100 rounded-2xl p-6 border-2 border-emerald-600/50 text-lg shadow-xl focus:ring-4 focus:ring-emerald-400/50 focus:border-emerald-400 transition-all duration-300 placeholder-emerald-400/50"
                  placeholder="Short title for this deposit..."
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
              </div>
              
              {/* Amount Input */}
              <div className="space-y-4">
                <label className="block text-2xl font-bold text-emerald-300 text-center">Deposit Amount</label>
                <div className="relative">
                  <div className="absolute left-6 top-1/2 transform -translate-y-1/2 text-4xl font-black text-emerald-400">$</div>
                  <input
                    type="number"
                    className="w-full bg-emerald-950/60 text-emerald-100 rounded-2xl pl-16 pr-8 py-8 border-3 border-emerald-600/50 text-5xl font-black text-center shadow-2xl focus:ring-4 focus:ring-emerald-400/50 focus:border-emerald-400 transition-all duration-300 placeholder-emerald-400/50"
                    placeholder="0.00"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
              </div>

              {/* Notes Input */}
              <div className="space-y-4">
                <label className="block text-xl font-bold text-emerald-300 text-center">Notes (Optional)</label>
                <textarea
                  className="w-full bg-emerald-950/60 text-emerald-100 rounded-2xl p-6 border-2 border-emerald-600/50 text-lg shadow-xl focus:ring-4 focus:ring-emerald-400/50 focus:border-emerald-400 transition-all duration-300 placeholder-emerald-400/50 resize-none"
                  placeholder="Add any notes about this deposit..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows="4"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-6">
                <button 
                  type="submit" 
                  className="w-full bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600 hover:from-emerald-600 hover:via-green-600 hover:to-emerald-700 text-white px-12 py-8 rounded-2xl text-4xl font-black shadow-2xl border-none outline-none transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed" 
                  disabled={submitting}
                >
                  {submitting ? (
                    <div className="flex items-center justify-center gap-4">
                      <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Processing...
                    </div>
                  ) : (
                    '💰 Complete Deposit'
                  )}
                </button>
              </div>
            </form>

            {/* Back Button */}
            <div className="px-12 pb-8">
              <button 
                onClick={() => navigate(-1)} 
                className="w-full text-emerald-300 hover:text-emerald-200 hover:bg-emerald-900/30 text-xl font-bold py-4 rounded-xl transition-all duration-200"
              >
                ← Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 