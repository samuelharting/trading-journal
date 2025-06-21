import React from "react";
import { motion } from "framer-motion";

const colorMap = {
  green: "bg-green-900 hover:bg-green-800 border-green-700 border-2",
  red: "bg-red-950 hover:bg-red-800 border-red-700 border-2",
  gray: "bg-neutral-900 hover:bg-neutral-800 border-neutral-700 border-2",
};

const CalendarBox = ({ label, onClick, color = "gray", pnl, status, delay = 0, tradeCount = 0 }) => (
  <motion.button
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ scale: 1.04, opacity: 0.98 }}
    whileTap={{ scale: 0.98 }}
    transition={{ duration: 0.3, delay }}
    className={`${colorMap[color]} rounded-md p-4 w-full aspect-square min-h-[90px] min-w-[90px] max-w-full flex flex-col items-center justify-center font-semibold text-lg transition-all duration-150 border-none outline-none shadow-none text-[#e5e5e5]`}
    onClick={onClick}
  >
    <div>{label}</div>
    <div className="mt-2 text-2xl font-mono font-extrabold select-none">
      <span className={color === "green" ? "text-green-300" : color === "red" ? "text-red-300" : "text-[#e5e5e5]"}>
        {pnl > 0 ? "+" : pnl < 0 ? "" : ""}{pnl.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </span>
    </div>
    {tradeCount > 0 && (
      <div className="mt-1 text-xs opacity-80">
        {tradeCount} trade{tradeCount !== 1 ? 's' : ''}
      </div>
    )}
  </motion.button>
);

export default CalendarBox; 