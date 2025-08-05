import React from "react";
import { motion } from "framer-motion";

export default function StatCard({ value, label, ariaLabel, isPositive, isNegative }) {
  // Determine colors based on value type
  const getValueColor = () => {
    if (isPositive) return '#10B981'; // vibrant green
    if (isNegative) return '#EF4444'; // vibrant red
    return '#F5F5F5'; // neutral white
  };

  const valueColor = getValueColor();
  
  return (
    <motion.div
      whileHover={{ 
        scale: 1.05,
        boxShadow: `0 25px 50px -12px ${valueColor}20`
      }}
      transition={{ 
        type: "spring", 
        stiffness: 300, 
        damping: 20 
      }}
      className="w-[150px] h-[150px] rounded-2xl backdrop-blur-sm bg-black/20 border border-white/10 shadow-2xl flex flex-col items-center justify-center relative overflow-hidden"
      aria-label={ariaLabel}
      tabIndex={0}
      style={{
        background: 'linear-gradient(135deg, rgba(31, 41, 55, 0.8) 0%, rgba(17, 24, 39, 0.8) 100%)',
        boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)`
      }}
    >
      {/* Gradient border effect */}
      <div 
        className="absolute inset-0 rounded-2xl opacity-20"
        style={{
          background: `linear-gradient(135deg, ${valueColor}40, transparent)`,
          mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          maskComposite: 'exclude',
          padding: '1px'
        }}
      />
      
      <span 
        className="text-[28px] font-bold leading-tight tracking-tight"
        style={{ color: valueColor }}
      >
        {value}
      </span>
      <span className="text-[12px] font-light text-neutral-400 mt-3 uppercase tracking-wider leading-relaxed">
        {label}
      </span>
    </motion.div>
  );
} 