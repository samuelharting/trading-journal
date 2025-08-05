import React, { useEffect, useRef, useState } from "react";

const matrixChars = "アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズヅブプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポヴッンABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export default function MatrixCornerRain({ width = 120, height = 180, columns = 8, showDuration = 800 }) {
  const [visible, setVisible] = useState(false);
  const [matrix, setMatrix] = useState(
    Array.from({ length: columns }, () => Array(Math.floor(height / 18)).fill(" "))
  );
  const timeoutRef = useRef();

  useEffect(() => {
    function triggerRain() {
      setVisible(true);
      timeoutRef.current = setTimeout(() => setVisible(false), showDuration);
      // Schedule next rain
      setTimeout(triggerRain, 15000 + Math.random() * 20000); // 15-35s
    }
    // Start first rain after a short delay
    timeoutRef.current = setTimeout(triggerRain, 5000 + Math.random() * 5000);
    return () => clearTimeout(timeoutRef.current);
  }, [showDuration]);

  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      setMatrix((prev) =>
        prev.map((col) => {
          const newCol = [...col];
          newCol.pop();
          newCol.unshift(matrixChars[Math.floor(Math.random() * matrixChars.length)]);
          return newCol;
        })
      );
    }, 60);
    return () => clearInterval(interval);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 12,
        right: 12,
        zIndex: 50,
        pointerEvents: "none",
        opacity: 0.22,
        filter: "blur(0.5px)",
      }}
    >
      <div style={{ display: "flex", gap: 2 }}>
        {matrix.map((col, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column" }}>
            {col.map((char, j) => (
              <span
                key={j}
                style={{
                  color: `#00ff41`,
                  fontFamily: "monospace",
                  fontSize: 16,
                  textShadow: "0 0 8px #00ff41, 0 0 2px #00ff41",
                  userSelect: "none",
                  opacity: 0.85,
                }}
              >
                {char}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
} 