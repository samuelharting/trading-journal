import React, { useState, useContext, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import JournalEntryForm from "../components/JournalEntryForm";
import JournalEntryList from "../components/JournalEntryList";
import { UserContext } from "../App";
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, orderBy } from 'firebase/firestore';
import Spinner from '../components/MatrixLoader';
import GlitchTitle from '../components/GlitchTitle';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

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

const DayPage = () => {
  const { currentUser, selectedAccount } = useContext(UserContext);
  const { month, day } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const year = useParams().year || new Date().getFullYear();
  const [entries, setEntries] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser || !selectedAccount || !month || !day) return;
    const fetchEntries = async () => {
      setLoading(true);
      const { db } = await import('../firebase');
      const { collection, query, where, getDocs, orderBy } = await import('firebase/firestore');
      const entriesCol = collection(db, 'users', currentUser.uid, 'accounts', selectedAccount.id, 'entries');
      const q = query(entriesCol, where('month', '==', month), where('day', '==', day), orderBy('created', 'asc'));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setEntries(data);
      setLoading(false);
    };
    fetchEntries();
  }, [currentUser, selectedAccount, month, day]);

  useEffect(() => {
    console.log('DayPage user:', currentUser, 'entries:', entries, 'loading:', loading);
  }, [currentUser, entries, loading]);

  if (!month || !day) {
    console.warn("DayPage: missing month or day param", { month, day });
    return <div className="text-red-400 p-8">Invalid day URL. (Missing month or day param)</div>;
  }

  // Calculate initialAccountBalance for the next entry
  let initialAccountBalance = "";
  if (entries.length > 0) {
    const last = entries[entries.length - 1];
    const prevBalance = Number(last.accountBalance) || 0;
    const prevPnl = Number(last.pnl) || 0;
    const sum = (Math.round(prevBalance * 100) + Math.round(prevPnl * 100)) / 100;
    initialAccountBalance = sum.toFixed(2);
  }

  const handleAddEntry = async (entry) => {
    if (!currentUser || !selectedAccount) return;
    const { db } = await import('../firebase');
    const { collection, addDoc, getDocs, query, where, orderBy } = await import('firebase/firestore');
    const entriesCol = collection(db, 'users', currentUser.uid, 'accounts', selectedAccount.id, 'entries');
    // Ensure year, month, day fields are set
    const now = new Date();
    const entryYear = entry.year || String(now.getFullYear());
    const entryMonth = entry.month || String(now.getMonth() + 1);
    const entryDay = entry.day || String(now.getDate());
    const trimmedEntry = trimFirestoreDoc({ ...entry, year: entryYear, month: entryMonth, day: entryDay });
    if (trimmedEntry) {
      await addDoc(entriesCol, trimmedEntry);
      // Refetch entries from Firestore
      const q = query(entriesCol, where('month', '==', month), where('day', '==', day), orderBy('created', 'asc'));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setEntries(data);
    } else {
      console.warn("Entry trimmed to undefined, not saving.");
    }
  };

  return (
    <div className="flex flex-col items-center w-full relative">
      <div className="absolute left-0 top-4 z-30">
        <button
          className="flex items-center gap-2 ml-6 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-[#e5e5e5] rounded shadow"
          onClick={() => navigate(`/month/${year}/${month}`)}
        >
          <ArrowLeftIcon className="w-5 h-5" />
          Back
        </button>
      </div>
      
      {/* Big Bold Date Display */}
      <div className="w-full text-center mb-8 mt-4">
        <div className="text-4xl md:text-6xl font-bold text-[#e5e5e5] mb-2">
          {new Date(year, month - 1, day).toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </div>
      </div>
      
      <div className="sticky top-4 z-30 w-full flex justify-center mb-6">
        {!showForm && (
          <button
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded shadow"
            onClick={() => setShowForm(true)}
          >
            Add Entry
          </button>
        )}
      </div>
      {loading ? <div className="flex justify-center items-center py-24"><Spinner size={48} /></div> : <JournalEntryList entries={entries} />}
      {showForm && (
        <JournalEntryForm onSave={() => setShowForm(false)} onCancel={() => setShowForm(false)} initialAccountBalance={initialAccountBalance} />
      )}
    </div>
  );
};

export default DayPage; 