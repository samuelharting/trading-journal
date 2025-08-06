import React, { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { UserContext } from "../App";
import { db } from '../firebase';
import { collection, getDocs, doc, updateDoc, addDoc } from 'firebase/firestore';
import { ArrowLeftIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';

const EditAccountPage = () => {
  const { currentUser, selectedAccount } = useContext(UserContext);
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentBalance, setCurrentBalance] = useState("");
  const [originalBalance, setOriginalBalance] = useState(0); // Store original calculated balance
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentUser || !selectedAccount) return;
    const fetchEntries = async () => {
      setLoading(true);
      const entriesCol = collection(db, 'users', currentUser.uid, 'accounts', selectedAccount.id, 'entries');
      const snap = await getDocs(entriesCol);
      const data = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setEntries(data);
      
      // Calculate current balance using the same logic as SummaryPage
      if (data.length > 0) {
        const sorted = [...data].sort((a, b) => new Date(a.created) - new Date(b.created));
        let balance = 0;
        
        sorted.forEach(e => {
          if (e.isDeposit) {
            // For deposits, use stored accountBalance directly (don't double-count)
            if (e.accountBalance && !isNaN(Number(e.accountBalance))) {
              balance = Number(e.accountBalance);
            } else {
              // Fallback: use deposit amount
              balance += Number(e.pnl) || 0;
            }
          } else if (e.isPayout) {
            // For payouts, use stored accountBalance directly (don't double-count)
            if (e.accountBalance && !isNaN(Number(e.accountBalance))) {
              balance = Number(e.accountBalance);
            } else {
              // Fallback: use payout amount (already negative)
              balance += Number(e.pnl) || 0;
            }
          } else if (!e.isTapeReading) {
            // For trades, add the P&L
            balance += Number(e.pnl) || 0;
          }
          // Tape reading entries don't affect balance
        });
        setOriginalBalance(balance); // Store the original calculated balance
        setCurrentBalance(balance.toFixed(2));
      }
      setLoading(false);
    };
    fetchEntries();
  }, [currentUser, selectedAccount]);

  const handleSave = async () => {
    if (!currentUser || !selectedAccount || !currentBalance) return;
    setSaving(true);
    
    try {
      const newBalance = parseFloat(currentBalance);
      const correctionAmount = newBalance - originalBalance; // Calculate the difference
      
      // Only create a correction entry if there's actually a difference
      if (Math.abs(correctionAmount) < 0.01) {
        // No significant change, just go back
        navigate('/summary');
        return;
      }
      
      // Add a new deposit/withdrawal entry to correct the balance
      const entriesCol = collection(db, 'users', currentUser.uid, 'accounts', selectedAccount.id, 'entries');
      await addDoc(entriesCol, {
        pnl: correctionAmount, // Store the correction amount (positive for deposit, negative for withdrawal)
        notes: `Account balance correction (${correctionAmount > 0 ? '+' : ''}${correctionAmount.toFixed(2)})`,
        created: new Date().toISOString(),
        isDeposit: correctionAmount > 0, // Deposit if positive correction
        isPayout: correctionAmount < 0,  // Payout if negative correction
        accountBalance: newBalance, // Set the final balance
        year: String(new Date().getFullYear()),
        month: String(new Date().getMonth() + 1),
        day: String(new Date().getDate())
      });
      
      // Small delay to ensure Firestore write is complete before navigating
      await new Promise(resolve => setTimeout(resolve, 500));
      navigate('/summary');
    } catch (error) {
      console.error('Error updating account balance:', error);
      alert('Failed to update account balance. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full min-h-screen bg-black pt-20 px-4 sm:px-8">
        <div className="flex justify-center items-center py-24">
          <div className="text-neutral-400">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-black pt-20 px-4 sm:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate('/summary')}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-[#e5e5e5] rounded shadow"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            Back
          </button>
          <h1 className="text-3xl font-bold text-[#e5e5e5]">Edit Account</h1>
        </div>

        {/* Edit Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/10 backdrop-blur-md rounded-2xl p-6 sm:p-8 border border-white/10 shadow-2xl"
        >
          <div className="flex items-center gap-3 mb-6">
            <CurrencyDollarIcon className="w-7 h-7 text-green-400" />
            <h2 className="text-2xl font-bold text-[#e5e5e5]">Account Balance</h2>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-neutral-400 mb-2">
                Current Account Balance
              </label>
              <input
                type="number"
                step="0.01"
                value={currentBalance}
                onChange={(e) => setCurrentBalance(e.target.value)}
                className="w-full bg-neutral-900 text-[#e5e5e5] p-4 rounded-lg border border-neutral-700 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                placeholder="Enter current account balance"
              />
            </div>

            <div className="bg-neutral-900/50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-[#e5e5e5] mb-2">Balance Correction</h3>
              {currentBalance && (
                <div className="mb-3 space-y-1">
                  <div className="text-sm text-neutral-400">Original calculated balance: <span className="text-[#e5e5e5] font-mono">${originalBalance.toFixed(2)}</span></div>
                  <div className="text-sm text-neutral-400">New balance: <span className="text-[#e5e5e5] font-mono">${parseFloat(currentBalance || 0).toFixed(2)}</span></div>
                  <div className="text-sm font-semibold">
                    Correction: 
                    <span className={`font-mono ml-1 ${(parseFloat(currentBalance || 0) - originalBalance) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {(parseFloat(currentBalance || 0) - originalBalance) >= 0 ? '+' : ''}
                      ${(parseFloat(currentBalance || 0) - originalBalance).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
              <p className="text-sm text-neutral-400">
                This will create a {(parseFloat(currentBalance || 0) - originalBalance) >= 0 ? 'deposit' : 'withdrawal'} entry to match your actual account balance.
              </p>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                onClick={handleSave}
                disabled={saving || !currentBalance || Math.abs(parseFloat(currentBalance || 0) - originalBalance) < 0.01}
                className="flex-1 bg-green-600 hover:bg-green-500 disabled:bg-neutral-700 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-semibold transition-all"
              >
                {saving ? 'Saving...' : 
                 Math.abs(parseFloat(currentBalance || 0) - originalBalance) < 0.01 ? 'No Change Needed' : 
                 'Apply Correction'}
              </button>
              <button
                onClick={() => navigate('/summary')}
                className="flex-1 bg-neutral-700 hover:bg-neutral-600 text-white px-6 py-3 rounded-lg font-semibold transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default EditAccountPage; 