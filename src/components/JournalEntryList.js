import React from "react";
import { motion } from "framer-motion";

const fieldLabel = {
  tickerTraded: "Ticker",
  pnl: "P&L",
  rr: "R:R",
  accountBalance: "Account Balance",
  duration: "Duration",
  entryTime: "Entry Time",
  exitTime: "Exit Time",
  grade: "Grade",
  session: "Session",
  liquiditySweep: "Liquidity Sweep",
  howFeltBefore: "How I Felt Before",
  premarketAnalysis: "Premarket Analysis",
  howFeltDuring: "How I Felt During",
  howFeltAfter: "How I Felt After",
  notes: "Notes",
};

const JournalEntryList = ({ entries }) => {
  if (!entries.length) {
    return <div className="text-gray-400 mb-4">No entries for this day yet.</div>;
  }
  return (
    <div className="flex flex-col gap-8 w-full max-w-6xl mb-12 px-0 bg-black">
      {entries.map((entry, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.01, backgroundColor: '#18181b' }}
          transition={{ duration: 0.3, delay: idx * 0.05 }}
          className="bg-neutral-900 rounded-md p-10 flex flex-col gap-6 border-none shadow-none text-[#e5e5e5]"
        >
          <div className="flex flex-wrap gap-8 mb-4 text-lg">
            <div>
              <span className="font-semibold text-gray-300">{fieldLabel.tickerTraded}:</span> <span className="text-gray-100">{entry.tickerTraded}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-300">{fieldLabel.grade}:</span> <span className="text-gray-100">{entry.grade}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-300">{fieldLabel.session}:</span> <span className="text-gray-100">{entry.session}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-300">{fieldLabel.liquiditySweep}:</span> <span className="text-gray-100">{entry.liquiditySweep}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-8 mb-4 text-2xl font-bold">
            <div>
              <span className="font-semibold text-gray-300">{fieldLabel.pnl}:</span> <span className={entry.pnl > 0 ? "text-green-400" : entry.pnl < 0 ? "text-red-400" : "text-gray-100"}>{entry.pnl > 0 ? "+" : ""}{entry.pnl}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-300">{fieldLabel.rr}:</span> <span className="text-blue-300">{entry.rr}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-300">{fieldLabel.accountBalance}:</span> <span className="text-gray-100">{entry.accountBalance}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-300">{fieldLabel.duration}:</span> <span className="text-gray-100">{entry.duration}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-300">{fieldLabel.entryTime}:</span> <span className="text-gray-100">{entry.entryTime}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-300">{fieldLabel.exitTime}:</span> <span className="text-gray-100">{entry.exitTime}</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2">
            <div>
              <span className="font-semibold text-gray-300">{fieldLabel.howFeltBefore}:</span>
              <div className="text-gray-100 whitespace-pre-line">{entry.howFeltBefore}</div>
            </div>
            <div>
              <span className="font-semibold text-gray-300">{fieldLabel.premarketAnalysis}:</span>
              <div className="text-gray-100 whitespace-pre-line">{entry.premarketAnalysis}</div>
            </div>
            <div>
              <span className="font-semibold text-gray-300">{fieldLabel.howFeltDuring}:</span>
              <div className="text-gray-100 whitespace-pre-line">{entry.howFeltDuring}</div>
            </div>
            <div>
              <span className="font-semibold text-gray-300">{fieldLabel.howFeltAfter}:</span>
              <div className="text-gray-100 whitespace-pre-line">{entry.howFeltAfter}</div>
            </div>
          </div>
          <div className="mb-2">
            <span className="font-semibold text-gray-300">{fieldLabel.notes}:</span>
            <div className="text-gray-100 whitespace-pre-line">{entry.notes}</div>
          </div>
          {entry.screenshots && entry.screenshots.length > 0 && (
            <div className="flex gap-4 flex-wrap mb-2">
              {entry.screenshots.map((src, i) => (
                <img key={i} src={src} alt="Screenshot" className="w-32 h-32 object-cover rounded-md border-none" />
              ))}
            </div>
          )}
          <div className="text-xs text-neutral-500 mt-2">{new Date(entry.created).toLocaleString()}</div>
        </motion.div>
      ))}
    </div>
  );
};

export default JournalEntryList; 