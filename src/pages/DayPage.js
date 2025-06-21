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

const DayPage = () => {
  const { user } = useContext(UserContext);
  const { month, day } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const year = useParams().year || new Date().getFullYear();
  const [entries, setEntries] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !month || !day) return;
    const fetchEntries = async () => {
      setLoading(true);
      const entriesCol = collection(db, 'journalEntries', user, 'entries');
      const q = query(entriesCol, where('month', '==', month), where('day', '==', day), orderBy('created', 'asc'));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setEntries(data);
      setLoading(false);
    };
    fetchEntries();
  }, [user, month, day]);

  if (!month || !day) {
    console.warn("DayPage: missing month or day param", { month, day });
    return <div className="text-red-400 p-8">Invalid day URL. (Missing month or day param)</div>;
  }

  // Calculate initialAccountBalance for the next entry
  let initialAccountBalance = "";
  if (entries.length > 0) {
    const last = entries[entries.length - 1];
    const prevBalance = parseFloat(last.accountBalance) || 0;
    const prevPnl = parseFloat(last.pnl) || 0;
    initialAccountBalance = (prevBalance + prevPnl).toFixed(2);
  }

  const handleAddEntry = async (entry) => {
    if (!user) return;
    const entriesCol = collection(db, 'journalEntries', user, 'entries');
    await addDoc(entriesCol, { ...entry, year: String(year), month: String(month), day: String(day) });
    setEntries(prev => [...prev, { ...entry, year: String(year), month: String(month), day: String(day) }]);
    setShowForm(false);
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
        <JournalEntryForm onSave={handleAddEntry} onCancel={() => setShowForm(false)} initialAccountBalance={initialAccountBalance} />
      )}
    </div>
  );
};

export default DayPage; 