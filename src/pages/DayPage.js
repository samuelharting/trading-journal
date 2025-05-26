import React, { useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import JournalEntryForm from "../components/JournalEntryForm";
import JournalEntryList from "../components/JournalEntryList";
import { UserContext } from "../App";

const getStorageKey = (user, month, day) => `journal-${user}-${new Date().getFullYear()}-${month}-${day}`;

const DayPage = () => {
  const { user } = useContext(UserContext);
  const { month, day } = useParams();
  const navigate = useNavigate();
  // Always call hooks first!
  const [entries, setEntries] = useState(() => {
    if (!month || !day || !user) return [];
    const saved = localStorage.getItem(getStorageKey(user, month, day));
    return saved ? JSON.parse(saved) : [];
  });
  const [showForm, setShowForm] = useState(false);

  // Now do the conditional check
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

  const handleAddEntry = (entry) => {
    const updated = [...entries, entry];
    setEntries(updated);
    localStorage.setItem(getStorageKey(user, month, day), JSON.stringify(updated));
    setShowForm(false);
  };

  return (
    <div className="flex flex-col items-center">
      <button className="self-start mb-4 text-gray-400 hover:text-gray-200" onClick={() => navigate(-1)}>&larr; Back</button>
      <h2 className="text-2xl font-bold mb-6">Entries for {month}-{day}</h2>
      <JournalEntryList entries={entries} />
      {showForm ? (
        <JournalEntryForm onSave={handleAddEntry} onCancel={() => setShowForm(false)} initialAccountBalance={initialAccountBalance} />
      ) : (
        <button
          className="mt-6 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded shadow"
          onClick={() => setShowForm(true)}
        >
          Add Entry
        </button>
      )}
    </div>
  );
};

export default DayPage; 