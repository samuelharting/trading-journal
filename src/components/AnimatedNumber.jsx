import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const AnimatedNumber = ({ 
  value, 
  decimals = 2, 
  prefix = '', 
  suffix = '', 
  duration = 1.5,
  className = '',
  delay = 0 
}) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    // Reset to 0 when value changes
    setDisplayValue(0);
    
    const startTime = Date.now() + delay;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / (duration * 1000), 1);
      
      // Smooth easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      const currentValue = value * easeOut;
      setDisplayValue(currentValue);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(value); // Ensure we end exactly at the target value
      }
    };
    
    if (delay > 0) {
      setTimeout(animate, delay);
    } else {
      animate();
    }
  }, [value, duration, delay]);

  const formatValue = (num) => {
    if (decimals === 0) {
      return Math.round(num).toLocaleString();
    }
    return num.toLocaleString(undefined, { 
      minimumFractionDigits: decimals, 
      maximumFractionDigits: decimals 
    });
  };

  return (
    <motion.span 
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: delay / 1000 }}
    >
      {prefix}{formatValue(displayValue)}{suffix}
    </motion.span>
  );
};

export default AnimatedNumber;
