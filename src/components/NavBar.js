import React, { useContext, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { PlusIcon } from '@heroicons/react/24/solid';
import { UserContext } from "../App";
import { db } from '../firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { CalendarIcon, DocumentTextIcon, ChartBarIcon, BookOpenIcon } from '@heroicons/react/24/outline';

const NavBar = () => {
  const { user } = useContext(UserContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [showReset, setShowReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const navRef = useRef();
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
    if (!user) return;
    const entriesCol = collection(db, 'journalEntries', user, 'entries');
    const snap = await getDocs(entriesCol);
    await Promise.all(snap.docs.map(docSnap => deleteDoc(doc(db, 'journalEntries', user, 'entries', docSnap.id))));
    setResetting(false);
    setShowReset(false);
    window.location.reload();
  };

  const activeIdx = navButtonsWithQuickAdd.findIndex(btn => btn.path && location.pathname === btn.path);

  return (
    <nav className="fixed top-0 left-0 w-full z-40 bg-black flex items-center h-16 px-2 sm:px-4">
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