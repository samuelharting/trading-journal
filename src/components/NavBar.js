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
    
    // Delete all journal entries (trades, deposits, payouts) but preserve notebook data
    const entriesCol = collection(db, 'journalEntries', currentUser.uid, 'entries');
    const snap = await getDocs(entriesCol);
    await Promise.all(snap.docs.map(docSnap => deleteDoc(doc(db, 'journalEntries', currentUser.uid, 'entries', docSnap.id))));
    
    // Note: Notebook data is stored in localStorage and is already user-specific (not account-specific)
    // So it will automatically be preserved across all accounts for this user
    
    setResetting(false);
    setShowReset(false);
    window.location.reload();
  };

  // Helper function to determine if a button should be active
  const isButtonActive = (btn) => {
    if (!btn.path) return false;
    
    // Exact match
    if (location.pathname === btn.path) return true;
    
    // Special cases for nested routes
    if (btn.path === "/" && location.pathname === "/") return true;
    if (btn.path === "/trades" && location.pathname.startsWith("/trades")) return true;
    if (btn.path === "/notebook" && location.pathname.startsWith("/notebook")) return true;
    if (btn.path === "/summary" && location.pathname.startsWith("/summary")) return true;
    if (btn.path === "/context" && location.pathname.startsWith("/context")) return true;
    
    return false;
  };

  return (
    <nav className="fixed top-0 left-0 w-full z-40 backdrop-blur-sm bg-black/80 border-b border-white/10 flex items-center h-16 px-2 sm:px-4">
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
              className="backdrop-blur-sm bg-black/20 text-[#3B82F6] font-medium px-4 py-2 rounded-xl border border-white/10 focus:ring-2 focus:ring-[#3B82F6]/50 text-sm mr-2 shadow-lg"
              style={{ 
                minWidth: 120,
                background: 'linear-gradient(135deg, rgba(31, 41, 55, 0.8) 0%, rgba(17, 24, 39, 0.8) 100%)'
              }}
            >
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name || 'Account'}</option>
              ))}
            </select>
            {accountDropdownOpen && (
              <button
                className="backdrop-blur-sm bg-[#3B82F6] hover:bg-[#2563EB] text-white font-medium px-3 py-1 rounded-lg text-xs absolute left-full ml-2 top-1/2 -translate-y-1/2 shadow-lg border border-white/10"
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
        {navButtonsWithQuickAdd.map((btn, idx) => {
          const isActive = isButtonActive(btn);
          return (
            <motion.button
              whileHover={{ 
                scale: 1.05,
                boxShadow: btn.label === 'Quick Add' ? '0 25px 50px -12px rgba(59, 130, 246, 0.3)' : '0 25px 50px -12px rgba(255, 255, 255, 0.1)'
              }}
              whileTap={{ scale: 0.98 }}
              key={btn.path || btn.label}
              className={`px-3 sm:px-6 py-3 rounded-xl backdrop-blur-sm border border-white/10 focus:ring-2 focus:ring-[#3B82F6]/50 transition-all duration-200 flex items-center justify-center ${btn.label === 'Quick Add' ? 'bg-[#3B82F6] hover:bg-[#2563EB] text-white font-bold shadow-lg' : 'bg-black/20 hover:bg-black/40'} ${isActive ? 'text-[#10B981] ring-2 ring-[#10B981]/50' : 'text-[#e5e5e5]'} min-w-[48px] min-h-[48px]`}
              style={{
                background: btn.label === 'Quick Add' ? 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)' : 'linear-gradient(135deg, rgba(31, 41, 55, 0.8) 0%, rgba(17, 24, 39, 0.8) 100%)'
              }}
              onClick={btn.onClick ? btn.onClick : () => navigate(btn.path)}
              title={btn.label}
            >
              {btn.icon}
            </motion.button>
          );
        })}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center">
          {(() => {
            const isActive = isButtonActive(contextBtn);
            return (
              <motion.button
                whileHover={{ 
                  scale: 1.05,
                  boxShadow: '0 25px 50px -12px rgba(255, 255, 255, 0.1)'
                }}
                whileTap={{ scale: 0.98 }}
                key={contextBtn.path}
                className={`px-3 sm:px-6 py-3 rounded-xl backdrop-blur-sm bg-black/20 hover:bg-black/40 border border-white/10 focus:ring-2 focus:ring-[#3B82F6]/50 transition-all duration-200 flex items-center justify-center ${isActive ? 'text-[#10B981] ring-2 ring-[#10B981]/50' : 'text-[#e5e5e5]'} min-w-[48px] min-h-[48px]`}
                style={{
                  background: 'linear-gradient(135deg, rgba(31, 41, 55, 0.8) 0%, rgba(17, 24, 39, 0.8) 100%)'
                }}
                onClick={() => navigate(contextBtn.path)}
                title={contextBtn.label}
              >
                {contextBtn.icon}
              </motion.button>
            );
          })()}
        </div>
      </div>
    </nav>
  );
};

export default NavBar; 