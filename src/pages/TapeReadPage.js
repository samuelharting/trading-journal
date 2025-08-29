import React, { useState, useContext, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../App";
import { storage } from '../firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';

export default function TapeReadPage() {
  const { currentUser, selectedAccount } = useContext(UserContext);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [screenshots, setScreenshots] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef();
  const navigate = useNavigate();

  const handleFiles = (files) => {
    Promise.all(files.map(file => {
      return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target.result);
        reader.readAsDataURL(file);
      });
    })).then(images => {
      setScreenshots(prev => [...prev, ...images]);
    });
  };
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    handleFiles(files);
    e.target.value = null;
  };
  const handleRemoveScreenshot = (idx) => {
    setScreenshots(prev => prev.filter((_, i) => i !== idx));
  };
  const handleDragOver = (e) => { e.preventDefault(); setDragActive(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setDragActive(false); };
  const handleDrop = (e) => {
    e.preventDefault(); setDragActive(false);
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser || !selectedAccount) return;
    setUploading(true);
    let urls = [];
    try {
      urls = await Promise.all(
        screenshots.map(async (src, idx) => {
          if (src.startsWith('http')) return src;
          const imageRef = ref(storage, `screenshots/${currentUser.uid}/${selectedAccount.id}/${Date.now()}-${idx}.jpg`);
          await uploadString(imageRef, src, 'data_url');
          return await getDownloadURL(imageRef);
        })
      );
      const { db } = await import('../firebase');
      const { collection, addDoc } = await import('firebase/firestore');
      const now = new Date();
      const createdTimestamp = now.toISOString() + '-' + Math.random().toString(36).slice(2, 8);
      const entriesCol = collection(db, 'users', currentUser.uid, 'accounts', selectedAccount.id, 'entries');
      await addDoc(entriesCol, {
        title,
        notes,
        screenshots: urls,
        created: createdTimestamp,
        tapeReading: true,
        year: now.getFullYear().toString(),
        month: (now.getMonth() + 1).toString(),
        day: now.getDate().toString(),
      });
      navigate('/');
    } catch (err) { console.error('TapeRead save error', err); }
    setUploading(false);
  };

  return (
    <div className="w-screen h-dvh min-h-screen bg-gradient-to-br from-black via-blue-950 to-blue-900 flex flex-col items-center justify-center pt-20">
      <div className="bg-gradient-to-br from-blue-900/90 via-black/90 to-blue-950/90 border border-blue-700 rounded-3xl p-10 w-full max-w-2xl shadow-2xl flex flex-col gap-8 z-20 relative animate-fadeIn">
        <div className="flex flex-row gap-4 items-center mb-2 justify-center">
          <label htmlFor="entryType" className="text-lg font-bold text-blue-200 drop-shadow">Type:</label>
          <select
            id="entryType"
            name="entryType"
            value="taperead"
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
        <h2 className="text-3xl font-extrabold text-blue-300 mb-2 text-center drop-shadow-glow">Tape Reading Entry</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          <div>
            <label className="block text-base text-blue-200 mb-2 font-semibold">Title (Optional)</label>
            <input
              type="text"
              className="w-full bg-blue-950/80 text-blue-100 rounded-xl p-4 border-2 border-blue-700 text-lg shadow-lg focus:ring-2 focus:ring-blue-400"
              placeholder="Short title for this entry..."
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>
          <textarea
            className="w-full min-h-[120px] bg-blue-950/80 text-blue-100 rounded-xl p-4 border-2 border-blue-700 text-lg shadow-lg focus:ring-2 focus:ring-blue-400"
            placeholder="Tape reading notes..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
          <div>
            <label className="block text-base text-blue-200 mb-2 font-semibold">Screenshots</label>
            <div
              className={`w-full h-32 rounded-xl border-2 flex flex-col items-center justify-center mb-2 relative transition-all duration-200 ${dragActive ? 'border-blue-500 bg-blue-500/10' : 'border-blue-700 bg-blue-950/80'}`}
              style={{ minHeight: 120 }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <svg className="w-8 h-8 text-blue-400 mb-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5V19a2 2 0 002 2h14a2 2 0 002-2v-2.5M16 10l-4-4m0 0l-4 4m4-4v12" /></svg>
              <div className="text-xs text-blue-400 mb-1">Drag & drop or select images</div>
              <button type="button" onClick={()=>fileInputRef.current.click()} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-lg mb-1">Select Images</button>
              <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />
              {screenshots.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2 w-full justify-center">
                  {screenshots.map((src, idx) => (
                    <div key={idx} className="relative group">
                      <img src={src} alt="Screenshot" className="w-16 h-16 object-cover rounded-lg border-2 border-white/10 shadow-md" />
                      <button type="button" onClick={()=>handleRemoveScreenshot(idx)} className="absolute top-1 right-1 bg-black/70 text-[#e5e5e5] rounded-full px-1 py-0.5 text-xs opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button type="submit" className="bg-gradient-to-r from-blue-500 via-blue-400 to-blue-600 hover:from-blue-600 hover:to-blue-400 text-white px-12 py-5 rounded-2xl text-3xl font-extrabold shadow-2xl border-none outline-none transition-all duration-200" disabled={uploading}>{uploading ? 'Saving...' : 'Save Tape Read'}</button>
        </form>
        <button onClick={()=>navigate(-1)} className="mt-2 text-blue-300 hover:underline text-center text-lg font-bold">Back</button>
      </div>
    </div>
  );
} 