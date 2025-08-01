import React from "react";
import { motion } from "framer-motion";

export default function CircleCard({ value, label, color = '#10B981', ringColor = '#10B981', ariaLabel }) {
  // Clamp value for ring (for demo, assume max 100k)
  const percent = Math.min(Math.abs(Number(value)) / 100000, 1);
  const size = 200;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent);
  
  // Determine colors based on value
  const isPositive = Number(value) > 0;
  const isNegative = Number(value) < 0;
  
  const getColors = () => {
    if (isPositive) return { color: '#10B981', ringColor: '#059669' };
    if (isNegative) return { color: '#EF4444', ringColor: '#DC2626' };
    return { color: '#3B82F6', ringColor: '#2563EB' };
  };
  
  const colors = getColors();
  
  return (
    <motion.div
      whileHover={{ 
        scale: 1.05,
        boxShadow: `0 25px 50px -12px ${colors.color}20`
      }}
      transition={{ 
        type: "spring", 
        stiffness: 300, 
        damping: 20 
      }}
      className="relative flex items-center justify-center backdrop-blur-sm bg-black/20 border border-white/10 rounded-3xl shadow-2xl"
      style={{ 
        width: size, 
        height: size,
        background: 'linear-gradient(135deg, rgba(31, 41, 55, 0.8) 0%, rgba(17, 24, 39, 0.8) 100%)',
        boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)`
      }}
      aria-label={ariaLabel}
      tabIndex={0}
    >
      {/* Gradient border effect */}
      <div 
        className="absolute inset-0 rounded-3xl opacity-20"
        style={{
          background: `linear-gradient(135deg, ${colors.color}40, transparent)`,
          mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          maskComposite: 'exclude',
          padding: '1px'
        }}
      />
      
      <svg width={size} height={size} className="absolute top-0 left-0">
        <defs>
          <linearGradient id={`ringGradient-${label}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors.ringColor} stopOpacity="0.8" />
            <stop offset="100%" stopColor={colors.color} stopOpacity="1" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="rgba(35, 35, 35, 0.8)"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#ringGradient-${label})`}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(.4,2,.3,1)' }}
        />
      </svg>
      <div className="flex flex-col items-center justify-center w-full h-full relative z-10" style={{ padding: 20 }}>
        <span 
          className="text-[28px] sm:text-[36px] font-bold leading-tight tracking-tight" 
          style={{ color: colors.color }}
        >
          {value > 0 ? '+' : ''}{value}
        </span>
        <span className="text-[12px] font-light text-neutral-400 uppercase mt-3 tracking-wider leading-relaxed">
          {label}
        </span>
      </div>
    </motion.div>
  );
} 