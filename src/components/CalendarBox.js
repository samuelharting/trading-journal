import React from "react";
import { motion } from "framer-motion";

const colorMap = {
  green: "bg-green-800 hover:bg-green-700",
  red: "bg-red-900 hover:bg-red-700",
  gray: "bg-neutral-900 hover:bg-neutral-800",
};

const CalendarBox = ({ label, onClick, color = "gray", pnl, status, delay = 0 }) => (
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
    <div className="mt-2 text-base font-mono">
      {status === "no-trades" ? (
        <span className="text-neutral-500 text-xs">No Trades</span>
      ) : (
        <span className={color === "green" ? "text-green-200" : color === "red" ? "text-red-200" : "text-[#e5e5e5]"}>
          {pnl > 0 ? "+" : ""}{pnl.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </span>
      )}
    </div>
  </motion.button>
);

export default CalendarBox; 