import React, { useState } from "react";
import { motion } from "framer-motion";
import { InformationCircleIcon } from "@heroicons/react/24/outline";

export default function Gauge({ 
  value, 
  label, 
  min = 0, 
  max = 100, 
  unit = "", 
  color = "#10B981", 
  tooltip = "",
  ariaLabel,
  formatValue 
}) {

  const [showTooltip, setShowTooltip] = useState(false);
  
  // Ensure value is within bounds
  const clampedValue = Math.max(min, Math.min(max, value));
  
  // Calculate angle for needle (180 degrees arc, -90 to +90)
  const normalizedValue = (clampedValue - min) / (max - min);
  const targetAngle = -90 + (normalizedValue * 180);
  
  // Create arc path for gauge background
  const createArcPath = (startAngle, endAngle, radius) => {
    const start = polarToCartesian(50, 50, radius, endAngle);
    const end = polarToCartesian(50, 50, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
  };
  
  function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  }
  
  // Calculate needle end point
  const needleLength = 32;
  const needleEnd = polarToCartesian(50, 50, needleLength, targetAngle);
  
  // Determine color based on value
  const getColor = () => {
    if (value === null || value === undefined) return "#6B7280";
    if (unit === "%" && value >= 50) return "#10B981"; // Good win rate
    if (unit === "%" && value < 50) return "#EF4444"; // Poor win rate
    if (unit === "$" && value > 0) return "#10B981"; // Positive money
    if (unit === "$" && value < 0) return "#EF4444"; // Negative money
    return color;
  };
  
  const gaugeColor = getColor();
  
  // Format the display value
  const displayValue = formatValue ? formatValue(value) : `${unit}${value?.toFixed(2) || "--"}`;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="relative flex flex-col items-center backdrop-blur-sm bg-black/20 border border-white/10 rounded-2xl shadow-2xl p-6"
      style={{
        background: 'linear-gradient(135deg, rgba(31, 41, 55, 0.8) 0%, rgba(17, 24, 39, 0.8) 100%)',
        boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)`
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      aria-label={ariaLabel}
      tabIndex={0}
    >
      {/* Gradient border effect */}
      <div 
        className="absolute inset-0 rounded-2xl opacity-20"
        style={{
          background: `linear-gradient(135deg, ${gaugeColor}40, transparent)`,
          mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          maskComposite: 'exclude',
          padding: '1px'
        }}
      />
      
      {/* Header with label and info icon */}
      <div className="flex items-center gap-2 mb-4 relative">
        <span className="text-sm font-light text-neutral-400 uppercase tracking-wider">
          {label}
        </span>
        {tooltip && (
          <div className="relative">
            <InformationCircleIcon className="w-4 h-4 text-neutral-400 hover:text-neutral-200 cursor-help" />
            {showTooltip && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg z-50 whitespace-nowrap max-w-xs"
                style={{ border: '1px solid rgba(255, 255, 255, 0.1)' }}
              >
                {tooltip}
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
              </motion.div>
            )}
          </div>
        )}
      </div>
      
      {/* SVG Gauge */}
      <div className="relative">
        <svg width="220" height="160" viewBox="0 0 100 100" className="overflow-visible">
          <defs>
            <linearGradient id={`gaugeGradient-${label}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#EF4444" stopOpacity="0.3" />
              <stop offset="50%" stopColor="#F59E0B" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.3" />
            </linearGradient>
            <linearGradient id={`needleGradient-${label}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={gaugeColor} stopOpacity="1" />
              <stop offset="100%" stopColor={gaugeColor} stopOpacity="0.8" />
            </linearGradient>
          </defs>
          
          {/* Background arc */}
          <path
            d={createArcPath(-90, 90, 37)}
            fill="none"
            stroke="rgba(255, 255, 255, 0.1)"
            strokeWidth="7"
            strokeLinecap="round"
          />
          
          {/* Animated progress arc that follows the needle */}
          <motion.path
            d={createArcPath(-90, targetAngle, 37)}
            fill="none"
            stroke={gaugeColor}
            strokeWidth="5"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.8 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
          
          {/* Tick marks */}
          {[...Array(9)].map((_, i) => {
            const tickAngle = -90 + (i * 22.5);
            const isMainTick = i % 2 === 0;
            const tickRadius = isMainTick ? 37 : 35;
            const tickStart = polarToCartesian(50, 50, tickRadius, tickAngle);
            const tickEnd = polarToCartesian(50, 50, tickRadius - (isMainTick ? 4 : 2), tickAngle);
            
            return (
              <line
                key={i}
                x1={tickStart.x}
                y1={tickStart.y}
                x2={tickEnd.x}
                y2={tickEnd.y}
                stroke="rgba(255, 255, 255, 0.2)"
                strokeWidth={isMainTick ? "1.5" : "1"}
                strokeLinecap="round"
              />
            );
          })}
          
          {/* Needle - using calculated coordinates */}
          <motion.line
            x1="50"
            y1="50"
            x2={needleEnd.x}
            y2={needleEnd.y}
            stroke={gaugeColor}
            strokeWidth="3"
            strokeLinecap="round"
            initial={{ x2: 50, y2: 20 }}
            animate={{ x2: needleEnd.x, y2: needleEnd.y }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
          {/* Needle tip */}
          <motion.circle
            cx={needleEnd.x}
            cy={needleEnd.y}
            r="2"
            fill={gaugeColor}
            initial={{ cx: 50, cy: 20 }}
            animate={{ cx: needleEnd.x, cy: needleEnd.y }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
          
          {/* Center dot */}
          <motion.circle
            cx="50"
            cy="50"
            r="4"
            fill={gaugeColor}
            stroke="rgba(255, 255, 255, 0.3)"
            strokeWidth="1"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.6, duration: 0.4, ease: "easeOut" }}
          />
          {/* Center dot highlight */}
          <circle
            cx="50"
            cy="50"
            r="2"
            fill="rgba(255, 255, 255, 0.3)"
          />
        </svg>
      </div>
      
      {/* Value display */}
      <motion.div 
        className="text-center mt-2"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.4 }}
      >
        <span 
          className="text-2xl font-bold tracking-tight"
          style={{ color: gaugeColor }}
        >
          {displayValue}
        </span>
      </motion.div>
      
      {/* Min/Max labels */}
      <div className="flex justify-between w-full mt-2 px-2">
        <span className="text-xs text-neutral-500">
          {unit}{min}
        </span>
        <span className="text-xs text-neutral-500">
          {unit}{max}
        </span>
      </div>
    </motion.div>
  );
}