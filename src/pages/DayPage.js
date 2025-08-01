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

// Helper function to extract timestamp from created field
function extractTimestamp(created) {
  // Handle format: "2025-08-01T19:45:18.759Z-tfxutu"
  const parts = created.split('T');
  if (parts.length >= 2) {
    const timePart = parts[1].split('-')[0]; // Get "19:45:18.759Z"
    return parts[0] + 'T' + timePart; // Return "2025-08-01T19:45:18.759Z"
  }
  return created; // Fallback to original if parsing fails
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
      const q = query(entriesCol, where('month', '==', month), where('day', '==', day));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      // Sort by created timestamp in descending order (newest first)
      const sortedData = data.sort((a, b) => {
        const aTimestamp = extractTimestamp(a.created);
        const bTimestamp = extractTimestamp(b.created);
        return new Date(bTimestamp) - new Date(aTimestamp);
      });
      console.log('Sorted entries:', sortedData.map(e => ({ id: e.id, created: e.created, ticker: e.tickerTraded })));
      setEntries(sortedData);
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
    // Use the account balance from the last entry directly
    initialAccountBalance = (Number(last.accountBalance) || 0).toFixed(2);
  }

  const handleAddEntry = async (savedEntry) => {
    if (!currentUser || !selectedAccount) return;
    
    // Add the saved entry to the local state immediately
    if (savedEntry) {
      setEntries(prevEntries => {
        // Add the new entry to the existing entries and sort by created timestamp (newest first)
        const newEntries = [...prevEntries, savedEntry];
        return newEntries.sort((a, b) => {
          const aTimestamp = extractTimestamp(a.created);
          const bTimestamp = extractTimestamp(b.created);
          return new Date(bTimestamp) - new Date(aTimestamp);
        });
      });
    }
  };

  return (
    <div className="w-full min-h-screen bg-black pt-20 px-4 sm:px-8 relative">
      <div className="max-w-full overflow-y-auto" style={{ height: 'calc(100vh - 80px)' }}>
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
        <JournalEntryForm 
          onSave={(savedEntry) => {
            handleAddEntry(savedEntry);
            setShowForm(false);
          }} 
          onCancel={() => setShowForm(false)} 
          initialAccountBalance={initialAccountBalance} 
        />
      )}
      </div>
    </div>
  );
};

export default DayPage; 