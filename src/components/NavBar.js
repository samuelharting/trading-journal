import React, { useContext, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { PlusIcon } from '@heroicons/react/24/solid';
import { UserContext } from "../App";
import { db } from '../firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { CalendarIcon, DocumentTextIcon, ChartBarIcon, BookOpenIcon } from '@heroicons/react/24/outline';

const RobotIcon = () => (
  <svg className="w-6 h-6 text-[#e5e5e5]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <rect x="4" y="8" width="16" height="8" rx="4" stroke="currentColor" strokeWidth="2" />
    <circle cx="8" cy="12" r="1.5" fill="currentColor" />
    <circle cx="16" cy="12" r="1.5" fill="currentColor" />
    <path d="M12 8V4M12 20v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const NavBar = () => {
  const { accounts, selectedAccount, setSelectedAccount, setAccounts, currentUser } = useContext(UserContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [showReset, setShowReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const navRef = useRef();
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const navButtons = [
    { label: "Home", path: "/", icon: <CalendarIcon className="w-6 h-6 text-[#e5e5e5]" /> },
    { label: "Trades", path: "/trades", icon: (
      <svg className="w-6 h-6 text-[#e5e5e5]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <polyline points="2,18 7,10 11,14 15,6 22,13" />
        <polyline points="19,13 22,13 22,10" />
      </svg>
    ) },
    { label: "Notebook", path: "/notebook", icon: <BookOpenIcon className="w-6 h-6 text-[#e5e5e5]" /> },
    { label: "Summary", path: "/summary", icon: <ChartBarIcon className="w-6 h-6 text-[#e5e5e5]" /> },
  ];

  const contextBtn = { label: "Context", path: "/context", icon: <DocumentTextIcon className="w-6 h-6 text-[#e5e5e5]" /> };
  const quickAddBtn = {
    label: "Quick Add",
    path: null,
    icon: <PlusIcon className="w-7 h-7 text-white" />,
    onClick: () => {
      const now = new Date();
      const month = now.getMonth() + 1;
      const day = now.getDate();
      navigate(`/day/${month}/${day}`, { state: { date: now.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) } });
    },
  };
  const navButtonsWithQuickAdd = [
    navButtons[0],
    navButtons[1],
    quickAddBtn,
    ...navButtons.slice(2).filter(btn => btn.label !== "Context")
  ];

  const handleReset = async () => {
    setResetting(true);
    if (!currentUser) return;
    const entriesCol = collection(db, 'journalEntries', currentUser.uid, 'entries');
    const snap = await getDocs(entriesCol);
    await Promise.all(snap.docs.map(docSnap => deleteDoc(doc(db, 'journalEntries', currentUser.uid, 'entries', docSnap.id))));
    setResetting(false);
    setShowReset(false);
    window.location.reload();
  };

  const activeIdx = navButtonsWithQuickAdd.findIndex(btn => btn.path && location.pathname === btn.path);

  return (
    <nav className="fixed top-0 left-0 w-full z-40 bg-black flex items-center h-16 px-2 sm:px-4">
      {/* Account Dropdown - top left */}
      <div className="flex items-center gap-2">
        {accounts && accounts.length > 0 && (
          <div className="relative">
            <select
              value={selectedAccount ? selectedAccount.id : ''}
              onChange={e => {
                const acc = accounts.find(a => a.id === e.target.value);
                if (acc) setSelectedAccount(acc);
              }}
              onFocus={() => setAccountDropdownOpen(true)}
              onBlur={() => setTimeout(() => setAccountDropdownOpen(false), 150)}
              className="bg-neutral-900 text-blue-300 font-bold px-3 py-2 rounded-md border-none focus:ring-2 focus:ring-blue-700 text-sm mr-2"
              style={{ minWidth: 120 }}
            >
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name || 'Account'}</option>
              ))}
            </select>
            {accountDropdownOpen && (
              <button
                className="bg-blue-700 hover:bg-blue-600 text-white font-bold px-2 py-1 rounded-md text-xs absolute left-full ml-2 top-1/2 -translate-y-1/2"
                onMouseDown={async (e) => {
                  e.preventDefault();
                  const name = window.prompt('Enter new account name:');
                  if (!name || !currentUser) return;
                  const { db } = await import('../firebase');
                  const { collection, addDoc } = await import('firebase/firestore');
                  const accountsCol = collection(db, 'users', currentUser.uid, 'accounts');
                  const docRef = await addDoc(accountsCol, { name, created: new Date().toISOString() });
                  setAccounts(prev => [...prev, { id: docRef.id, name, created: new Date().toISOString() }]);
                  setSelectedAccount({ id: docRef.id, name, created: new Date().toISOString() });
                }}
                title="Add Account"
              >+ Account</button>
            )}
          </div>
        )}
      </div>
      <div className="flex gap-2 sm:gap-6 w-full justify-center items-center relative">
        {navButtonsWithQuickAdd.map((btn, idx) => (
          <motion.button
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.98 }}
            key={btn.path || btn.label}
            className={`px-2 sm:px-5 py-2 rounded-md ${btn.label === 'Quick Add' ? 'bg-blue-700 hover:bg-blue-600 text-white font-bold shadow-lg' : 'bg-neutral-900 hover:bg-neutral-800'} focus:bg-neutral-800 transition-all duration-150 border-none outline-none shadow-none flex items-center justify-center ${location.pathname === btn.path ? 'text-green-400' : 'text-[#e5e5e5]'} min-w-[44px] min-h-[44px]`}
            onClick={btn.onClick ? btn.onClick : () => navigate(btn.path)}
            title={btn.label}
          >
            {btn.icon}
          </motion.button>
        ))}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center">
          <motion.button
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.98 }}
            key={contextBtn.path}
            className={`px-2 sm:px-5 py-2 rounded-md bg-neutral-900 hover:bg-neutral-800 focus:bg-neutral-800 transition-all duration-150 border-none outline-none shadow-none flex items-center justify-center ${location.pathname === contextBtn.path ? 'text-green-400' : 'text-[#e5e5e5]'} min-w-[44px] min-h-[44px]`}
            onClick={() => navigate(contextBtn.path)}
            title={contextBtn.label}
          >
            {contextBtn.icon}
          </motion.button>
        </div>
      </div>
    </nav>
  );
};

export default NavBar; 