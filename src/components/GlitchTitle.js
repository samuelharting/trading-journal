import React, { useEffect, useRef, useState } from "react";

const matrixChars = "アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズヅブプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポヴッンABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export default function GlitchTitle({ children, className = "", style = {} }) {
  const [glitchIdx, setGlitchIdx] = useState(null);
  const [glitchChar, setGlitchChar] = useState("");
  const timeoutRef = useRef();

  useEffect(() => {
    function triggerGlitch() {
      if (typeof children !== "string" || children.length === 0) return;
      const idx = Math.floor(Math.random() * children.length);
      setGlitchIdx(idx);
      setGlitchChar(matrixChars[Math.floor(Math.random() * matrixChars.length)]);
      setTimeout(() => setGlitchIdx(null), 180); // glitch lasts 180ms
      // Schedule next glitch
      timeoutRef.current = setTimeout(triggerGlitch, 10000 + Math.random() * 20000); // 10-30s
    }
    timeoutRef.current = setTimeout(triggerGlitch, 3000 + Math.random() * 4000); // first glitch sooner
    return () => clearTimeout(timeoutRef.current);
  }, [children]);

  return (
    <span
      className={className}
      style={{ marginTop: 32, display: "inline-block", ...style }}
    >
      {typeof children === "string"
        ? children.split("").map((char, i) =>
            glitchIdx === i ? (
              <span
                key={i}
                style={{ color: "#00ff41", textShadow: "0 0 8px #00ff41", fontFamily: "monospace", transition: "color 0.1s" }}
              >
                {glitchChar}
              </span>
            ) : (
              <span key={i}>{char}</span>
            )
          )
        : children}
    </span>
  );
} 