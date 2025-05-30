import React, { useState, useContext } from 'react';
import { UserContext } from '../App';
import { db } from '../firebase';
import { collection, doc, getDoc, setDoc, getDocs, addDoc } from 'firebase/firestore';
import sha256 from 'crypto-js/sha256';

const getUserPin = (username) => {
  const users = JSON.parse(localStorage.getItem('journalUsers') || '{}');
  return users[username];
};
const setUserPin = (username, pin) => {
  const users = JSON.parse(localStorage.getItem('journalUsers') || '{}');
  users[username] = pin;
  localStorage.setItem('journalUsers', JSON.stringify(users));
};

const LoginPage = () => {
  const { login } = useContext(UserContext);
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [mode, setMode] = useState('login'); // login or create
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || pin.length !== 4) {
      setError('Enter username and 4-digit PIN');
      return;
    }
    setLoading(true);
    const userRef = doc(collection(db, 'users'), username);
    const userSnap = await getDoc(userRef);
    const hashedPin = sha256(pin).toString();
    if (userSnap.exists()) {
      if (userSnap.data().pin === hashedPin) {
        // Migrate localStorage data if needed
        await migrateLocalDataToFirestore(username);
        login(username);
      } else {
        setError('Incorrect PIN');
      }
    } else {
      // Create new user
      await setDoc(userRef, { pin: hashedPin });
      await migrateLocalDataToFirestore(username);
      login(username);
    }
    setLoading(false);
  };

  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-black">
      <form onSubmit={handleSubmit} className="bg-neutral-900 rounded-2xl shadow-2xl p-10 flex flex-col gap-6 min-w-[320px] max-w-xs">
        <h2 className="text-2xl font-bold text-[#e5e5e5] mb-2">Trading Journal Login</h2>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={e => { setUsername(e.target.value); setError(''); }}
          className="bg-neutral-800 text-[#e5e5e5] p-3 rounded-md border-none focus:ring-2 focus:ring-blue-700 transition-all text-lg"
          autoFocus
        />
        <input
          type="password"
          placeholder="4-digit PIN"
          value={pin}
          onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setError(''); }}
          className="bg-neutral-800 text-[#e5e5e5] p-3 rounded-md border-none focus:ring-2 focus:ring-blue-700 transition-all text-lg tracking-widest"
          maxLength={4}
          inputMode="numeric"
        />
        {error && <div className="text-red-400 text-sm font-semibold">{error}</div>}
        <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white rounded-md p-3 font-bold text-lg transition-all" disabled={loading}>{loading ? 'Loading...' : (mode === 'login' ? 'Login' : 'Create Account')}</button>
      </form>
    </div>
  );
};

// Helper: migrate localStorage data to Firestore
async function migrateLocalDataToFirestore(username) {
  // Migrate journal entries
  const journalEntries = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(`journal-${username}-`)) {
      try {
        const dayEntries = JSON.parse(localStorage.getItem(key));
        if (Array.isArray(dayEntries)) {
          dayEntries.forEach(entry => {
            journalEntries.push(entry);
          });
        }
      } catch {}
    }
  }
  if (journalEntries.length > 0) {
    const entriesCol = collection(db, 'journalEntries', username, 'entries');
    // Clear existing entries in Firestore for this user (optional, for idempotency)
    const existing = await getDocs(entriesCol);
    for (const docSnap of existing.docs) {
      await docSnap.ref.delete();
    }
    // Add all entries
    for (const entry of journalEntries) {
      await addDoc(entriesCol, entry);
    }
  }
  // Migrate favorites
  const favKey = `favoriteTrades-${username}`;
  const favs = localStorage.getItem(favKey);
  if (favs) {
    await setDoc(doc(db, 'favorites', username), { data: JSON.parse(favs) });
  }
  // Optionally, remove migrated data from localStorage
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key.startsWith(`journal-${username}-`) || key === favKey) {
      localStorage.removeItem(key);
    }
  }
}

export default LoginPage; 