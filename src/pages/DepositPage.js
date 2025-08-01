import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../App";

export default function DepositPage() {
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
      const newBal = lastBal + Number(amount);
      await addDoc(entriesCol, {
        pnl: Number(amount), // Store deposit amount in pnl field for consistency
        notes,
        created: new Date().toISOString(),
        isDeposit: true,
        accountBalance: newBal,
      });
      navigate('/summary');
    } catch (err) { console.error('Deposit save error', err); }
    setSubmitting(false);
  };

  return (
    <div className="w-screen h-dvh min-h-screen bg-gradient-to-br from-black via-blue-950 to-blue-900 flex flex-col items-center justify-center pt-20">
      <div className="bg-gradient-to-br from-blue-900/90 via-black/90 to-blue-950/90 border border-blue-700 rounded-3xl p-10 w-full max-w-2xl shadow-2xl flex flex-col gap-8 z-20 relative animate-fadeIn">
        <div className="flex flex-row gap-4 items-center mb-2 justify-center">
          <label htmlFor="entryType" className="text-lg font-bold text-blue-200 drop-shadow">Type:</label>
          <select
            id="entryType"
            name="entryType"
            value="deposit"
            onChange={e => {
              const value = e.target.value;
              if (value === 'trade') navigate('/day');
              else if (value === 'payout') navigate('/payout');
              else if (value === 'taperead') navigate('/taperead');
              else if (value === 'deposit') navigate('/deposit');
            }}
            className="bg-blue-950/80 text-blue-100 rounded px-3 py-2 border border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 text-lg font-bold shadow-lg"
          >
            <option value="trade">Trade</option>
            <option value="payout">Payout</option>
            <option value="taperead">Tape Read</option>
            <option value="deposit">Deposit</option>
          </select>
        </div>
        <h2 className="text-3xl font-extrabold text-blue-300 mb-2 text-center drop-shadow-glow">Deposit</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          <input
            type="number"
            className="w-full bg-blue-950/80 text-blue-100 rounded-xl p-5 border-2 border-blue-700 text-3xl font-extrabold shadow-lg focus:ring-2 focus:ring-blue-400 transition-all duration-200"
            placeholder="Deposit amount"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            min="0"
            step="0.01"
            required
          />
          <textarea
            className="w-full min-h-[100px] bg-blue-950/80 text-blue-100 rounded-xl p-4 border-2 border-blue-700 text-lg shadow-lg focus:ring-2 focus:ring-blue-400"
            placeholder="Notes (optional)"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
          <button type="submit" className="bg-gradient-to-r from-blue-500 via-blue-400 to-blue-600 hover:from-blue-600 hover:to-blue-400 text-white px-12 py-5 rounded-2xl text-3xl font-extrabold shadow-2xl border-none outline-none transition-all duration-200" disabled={submitting}>{submitting ? 'Saving...' : 'Save Deposit'}</button>
        </form>
        <button onClick={()=>navigate(-1)} className="mt-2 text-blue-300 hover:underline text-center text-lg font-bold">Back</button>
      </div>
    </div>
  );
} 