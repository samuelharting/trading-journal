import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../App";

export default function PayoutPage() {
  const { currentUser, selectedAccount } = useContext(UserContext);
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
      const newBal = lastBal - Number(amount);
      await addDoc(entriesCol, {
        pnl: -Number(amount), // Store payout amount as negative in pnl field for consistency
        notes,
        created: now.toISOString(),
        isPayout: true,
        accountBalance: newBal,
        year: now.getFullYear().toString(),
        month: (now.getMonth() + 1).toString(),
        day: now.getDate().toString(),
      });
      navigate('/summary');
    } catch (err) { console.error('Payout save error', err); }
    setSubmitting(false);
  };

  return (
    <div className="w-screen h-screen bg-gradient-to-br from-black via-orange-950 to-red-900 flex flex-col pt-20 relative overflow-hidden">
      {/* Animated celebration elements */}
      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="absolute top-20 left-10 w-4 h-4 bg-yellow-400 rounded-full animate-ping" style={{animationDelay: '0s'}}></div>
        <div className="absolute top-40 right-20 w-3 h-3 bg-orange-400 rounded-full animate-ping" style={{animationDelay: '1s'}}></div>
        <div className="absolute bottom-40 left-20 w-5 h-5 bg-red-400 rounded-full animate-ping" style={{animationDelay: '2s'}}></div>
        <div className="absolute top-32 right-40 w-2 h-2 bg-yellow-300 rounded-full animate-ping" style={{animationDelay: '0.5s'}}></div>
        <div className="absolute bottom-60 right-10 w-4 h-4 bg-orange-300 rounded-full animate-ping" style={{animationDelay: '1.5s'}}></div>
      </div>

      {/* Header Section */}
      <div className="flex-shrink-0 text-center py-8 z-20 relative">
        <div className="inline-flex items-center gap-6 mb-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 flex items-center justify-center shadow-2xl animate-bounce">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"/>
              </svg>
            </div>
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full animate-pulse"></div>
          </div>
          <h1 className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-400 to-red-400 drop-shadow-2xl animate-pulse">
            PAYOUT!
          </h1>
          <div className="text-4xl animate-bounce">🎉</div>
        </div>
        <p className="text-3xl text-orange-200 font-bold mb-2">Congratulations on your success!</p>
        <p className="text-xl text-orange-300/90">Time to reward yourself for your discipline and skill 💰</p>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex items-center justify-center px-4 z-20 relative">
        <div className="w-full max-w-4xl">
          <div className="bg-gradient-to-br from-orange-900/40 via-black/60 to-red-950/40 backdrop-blur-xl border border-orange-500/30 rounded-3xl shadow-2xl overflow-hidden">
            
            {/* Type Selector */}
            <div className="bg-gradient-to-r from-orange-900/50 to-red-900/50 p-6 border-b border-orange-500/20">
              <div className="flex items-center justify-center gap-4">
                <label className="text-xl font-bold text-orange-200">Entry Type:</label>
                <select
                  value="payout"
                  onChange={e => {
                    const value = e.target.value;
                    if (value === 'trade') navigate('/day');
                    else if (value === 'payout') navigate('/payout');
                    else if (value === 'taperead') navigate('/taperead');
                    else if (value === 'deposit') navigate('/deposit');
                  }}
                  className="bg-orange-950/80 text-orange-100 rounded-xl px-6 py-3 border-2 border-orange-600 focus:outline-none focus:ring-4 focus:ring-orange-400/50 text-xl font-bold shadow-lg min-w-[180px]"
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
              {/* Amount Input */}
              <div className="space-y-4">
                <label className="block text-2xl font-bold text-orange-300 text-center">Payout Amount</label>
                <div className="relative">
                  <div className="absolute left-6 top-1/2 transform -translate-y-1/2 text-4xl font-black text-orange-400">$</div>
                  <input
                    type="number"
                    className="w-full bg-orange-950/60 text-orange-100 rounded-2xl pl-16 pr-8 py-8 border-3 border-orange-600/50 text-5xl font-black text-center shadow-2xl focus:ring-4 focus:ring-orange-400/50 focus:border-orange-400 transition-all duration-300 placeholder-orange-400/50"
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
                <label className="block text-xl font-bold text-orange-300 text-center">Notes (Optional)</label>
                <textarea
                  className="w-full bg-orange-950/60 text-orange-100 rounded-2xl p-6 border-2 border-orange-600/50 text-lg shadow-xl focus:ring-4 focus:ring-orange-400/50 focus:border-orange-400 transition-all duration-300 placeholder-orange-400/50 resize-none"
                  placeholder="What will you do with your profits? 🎯"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows="4"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-6">
                <button 
                  type="submit" 
                  className="w-full bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 hover:from-yellow-600 hover:via-orange-600 hover:to-red-600 text-white px-12 py-8 rounded-2xl text-4xl font-black shadow-2xl border-none outline-none transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed animate-pulse" 
                  disabled={submitting}
                >
                  {submitting ? (
                    <div className="flex items-center justify-center gap-4">
                      <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Processing...
                    </div>
                  ) : (
                    '🎉 Complete Payout 🎉'
                  )}
                </button>
              </div>
            </form>

            {/* Back Button */}
            <div className="px-12 pb-8">
              <button 
                onClick={() => navigate(-1)} 
                className="w-full text-orange-300 hover:text-orange-200 hover:bg-orange-900/30 text-xl font-bold py-4 rounded-xl transition-all duration-200"
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