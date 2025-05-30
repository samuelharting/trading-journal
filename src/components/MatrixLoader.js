import React from "react";

export default function Spinner({ size = 48, color = "#fff" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: size, width: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ display: "block" }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 6}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={Math.PI * (size - 12)}
          strokeDashoffset={Math.PI * (size - 12) * 0.25}
          strokeLinecap="round"
          style={{
            transformOrigin: "center",
            animation: "spinner-rotate 1s linear infinite"
          }}
        />
        <style>{`
          @keyframes spinner-rotate {
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </svg>
    </div>
  );
} 