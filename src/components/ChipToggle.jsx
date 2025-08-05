import React from "react";

export default function ChipToggle({ selected, label, onClick }) {
  return (
    <button
      type="button"
      className={`h-8 px-3 rounded-full text-sm font-semibold focus:outline-none transition-colors duration-150
        ${selected
          ? 'bg-blue-600/20 text-blue-400 ring-1 ring-blue-500/40'
          : 'bg-neutral-700 text-neutral-300 ring-1 ring-neutral-600'}
      `}
      aria-pressed={selected}
      tabIndex={0}
      onClick={onClick}
    >
      {label}
    </button>
  );
} 