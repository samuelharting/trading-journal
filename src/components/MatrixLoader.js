import React from "react";
import { motion } from "framer-motion";

const SkeletonCard = ({ className = "" }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className={`backdrop-blur-sm bg-black/20 border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden ${className}`}
    style={{
      background: 'linear-gradient(135deg, rgba(31, 41, 55, 0.8) 0%, rgba(17, 24, 39, 0.8) 100%)',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)'
    }}
  >
    <div className="animate-pulse">
      <div className="h-4 bg-white/10 rounded mb-3"></div>
      <div className="h-8 bg-white/10 rounded mb-2"></div>
      <div className="h-3 bg-white/5 rounded"></div>
    </div>
    {/* Shimmer effect */}
    <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>
  </motion.div>
);

const MatrixLoader = () => {
  return (
    <div className="w-full min-h-screen bg-black pt-20 px-4 sm:px-8">
      <div className="flex justify-center items-center py-24 w-full">
        <div className="w-full max-w-6xl flex flex-col gap-6">
          {/* Top priority cards skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 w-full">
            {[...Array(4)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
          
          {/* Equity curve skeleton */}
          <SkeletonCard className="h-80" />
          
          {/* Key stats skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-6 w-full">
            {[...Array(6)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
          
          {/* Streaks and trades skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
            <SkeletonCard className="h-48" />
            <div className="flex flex-col gap-4">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MatrixLoader; 