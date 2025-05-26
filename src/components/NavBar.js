import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { PlusIcon } from '@heroicons/react/24/solid';

const NavBar = () => {
  const navigate = useNavigate();
  const navButtons = [
    { label: "Home", path: "/" },
    { label: "Trades", path: "/trades" },
    { label: "Context", path: "/context" },
    { label: "Summary", path: "/summary" },
  ];
  return (
    <nav className="fixed top-0 left-0 w-full z-40 bg-black flex items-center h-16 px-4">
      <div className="flex gap-2 w-full justify-center items-center">
        {navButtons.map(btn => (
          <motion.button
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.98 }}
            key={btn.path}
            className="px-5 py-2 rounded-md text-[#e5e5e5] bg-neutral-900 hover:bg-neutral-800 focus:bg-neutral-800 font-semibold transition-all duration-150 border-none outline-none shadow-none"
            onClick={() => navigate(btn.path)}
          >
            {btn.label}
          </motion.button>
        ))}
        {/* Quick Add Button */}
        <motion.button
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.95 }}
          className="ml-4 flex items-center justify-center w-10 h-10 rounded-full bg-neutral-900 hover:bg-neutral-700 text-white border-none outline-none shadow-none"
          title="Quick Add Entry"
          onClick={() => {
            const now = new Date();
            const month = now.getMonth() + 1;
            const day = now.getDate();
            navigate(`/month/${now.getFullYear()}/${month}`);
            setTimeout(() => navigate(`/day/${month}/${day}`), 200);
          }}
        >
          <PlusIcon className="w-7 h-7 text-white" />
        </motion.button>
      </div>
    </nav>
  );
};

export default NavBar; 