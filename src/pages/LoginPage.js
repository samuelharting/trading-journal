import React, { useState, useContext } from 'react';
import { UserContext } from '../App';
import { db } from '../firebase';
import { collection, doc, getDoc, setDoc, getDocs, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import sha256 from 'crypto-js/sha256';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

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
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [mode, setMode] = useState('login'); // login or create
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // More flexible validation - allow both old username format and email format
  const isValidInput = (input) => {
    // Allow old username format (any characters) or valid email
    if (!input) return false;
    
    // If it looks like an email, validate email format
    if (input.includes('@')) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(input);
    }
    
    // Allow old username format (any non-empty string)
    return input.trim().length > 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username) {
      setError('Please enter your username or email address');
      return;
    }
    
    if (!isValidInput(username)) {
      setError('Please enter a valid username or email address');
      return;
    }
    
    if (pin.length !== 6) {
      setError('Please enter a 6-digit PIN');
      return;
    }
    
    setLoading(true);
    
    // Handle both old username format and email format
    let email;
    if (username.includes('@')) {
      // It's already an email
      email = username;
    } else {
      // It's an old username, append @journal.local to make it a valid email for Firebase
      email = username + '@journal.local';
    }
    
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, pin);
      } else {
        await createUserWithEmailAndPassword(auth, email, pin);
        // Optionally, create user doc in Firestore here if needed
      }
      // No need to call login(); onAuthStateChanged will handle redirect
    } catch (err) {
      setError('Login failed: ' + err.message);
    }
    setLoading(false);
  };

  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-black">
      <form onSubmit={handleSubmit} className="bg-neutral-900 rounded-2xl shadow-2xl p-10 flex flex-col gap-6 min-w-[320px] max-w-xs">
        <h2 className="text-2xl font-bold text-[#e5e5e5] mb-2">Trading Journal Login</h2>
        <input
          type="text"
          placeholder="Username or Email Address"
          value={username}
          onChange={e => { setUsername(e.target.value); setError(''); }}
          className="bg-neutral-800 text-[#e5e5e5] p-3 rounded-md border-none focus:ring-2 focus:ring-blue-700 transition-all text-lg"
          autoFocus
        />
        <input
          type="password"
          placeholder="6-digit PIN"
          value={pin}
          onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
          className="bg-neutral-800 text-[#e5e5e5] p-3 rounded-md border-none focus:ring-2 focus:ring-blue-700 transition-all text-lg tracking-widest"
          minLength={6}
          maxLength={6}
          inputMode="numeric"
        />
        {error && <div className="text-red-400 text-sm font-semibold">{error}</div>}
        <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white rounded-md p-3 font-bold text-lg transition-all" disabled={loading}>{loading ? 'Loading...' : (mode === 'login' ? 'Login' : 'Create Account')}</button>
        <div className="text-center mt-2">
          {mode === 'login' ? (
            <span className="text-sm text-neutral-400">Don't have an account?{' '}
              <button type="button" className="text-blue-400 underline" onClick={() => { setMode('create'); setError(''); }}>Create one</button>
            </span>
          ) : (
            <span className="text-sm text-neutral-400">Already have an account?{' '}
              <button type="button" className="text-blue-400 underline" onClick={() => { setMode('login'); setError(''); }}>Log in</button>
            </span>
          )}
        </div>
      </form>
    </div>
  );
};

function trimFirestoreDoc(doc) {
  const MAX_STRING = 1000000;
  const MAX_ARRAY = 1000;
  const MAX_FIELD_BYTES = 1048487;
  function trim(obj) {
    if (Array.isArray(obj)) {
      let arr = obj.slice(0, MAX_ARRAY);
      arr = arr.map(trim);
      // If array is still too large, remove it
      if (JSON.stringify(arr).length > MAX_FIELD_BYTES) return undefined;
      return arr;
    } else if (typeof obj === 'string') {
      let s = obj.slice(0, MAX_STRING);
      // If string is still too large, remove it
      if (s.length > MAX_FIELD_BYTES) return undefined;
      return s;
    } else if (typeof obj === 'object' && obj !== null) {
      const out = {};
      for (const k in obj) {
        // Never save base64 screenshot data
        if (k === 'screenshots' && Array.isArray(obj[k])) continue;
        const trimmed = trim(obj[k]);
        if (trimmed !== undefined) out[k] = trimmed;
      }
      // If object is still too large, remove it
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
      // If any field or array is >1MB, trim, split, or skip the entry. Log a warning if skipping.
      const trimmedEntry = { ...entry };
      const keysToCheck = Object.keys(trimmedEntry);
      for (const key of keysToCheck) {
        if (typeof trimmedEntry[key] === 'string') {
          if (trimmedEntry[key].length > 1024 * 1024) { // 1MB limit
            console.warn(`Skipping entry field "${key}" for user "${username}" due to size limit.`);
            trimmedEntry[key] = trimmedEntry[key].substring(0, 1024 * 1024); // Trim to 1MB
          }
        } else if (Array.isArray(trimmedEntry[key])) {
          if (trimmedEntry[key].length > 1024 * 1024) { // 1MB limit
            console.warn(`Skipping entry array "${key}" for user "${username}" due to size limit.`);
            trimmedEntry[key] = trimmedEntry[key].slice(0, 1024 * 1024); // Trim to 1MB
          }
        }
      }
      // If entry.screenshots is an array of base64/data_url, upload each to Storage, replace with download URLs, and only then addDoc.
      if (trimmedEntry.screenshots && Array.isArray(trimmedEntry.screenshots)) {
        const updatedScreenshots = [];
        for (const screenshot of trimmedEntry.screenshots) {
          if (typeof screenshot === 'string' && (screenshot.startsWith('data:') || screenshot.startsWith('http://') || screenshot.startsWith('https://'))) {
            // This is already a URL, no need to upload
            updatedScreenshots.push(screenshot);
          } else {
            // This is a base64/data_url, upload to Storage
            const storageRef = ref(storage, `screenshots/${Date.now()}-${Math.random().toString(36).substring(2, 15)}.png`);
            const uploadTask = uploadBytes(storageRef, atob(screenshot.split(',')[1])); // atob to decode base64
            await uploadTask;
            const downloadURL = await getDownloadURL(storageRef);
            updatedScreenshots.push(downloadURL);
          }
        }
        trimmedEntry.screenshots = updatedScreenshots;
      }
      const trimmedEntryForFirestore = trimFirestoreDoc(trimmedEntry);
      if (trimmedEntryForFirestore) {
        await addDoc(entriesCol, trimmedEntryForFirestore);
      }
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