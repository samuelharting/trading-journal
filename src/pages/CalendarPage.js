import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../App";

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const HomePage = () => {
  const { currentUser, selectedAccount } = useContext(UserContext);
  const navigate = useNavigate();
  const year = new Date().getFullYear();
  const [entries, setEntries] = useState([]);
  const [monthlyGoalProgress, setMonthlyGoalProgress] = useState({});

  useEffect(() => {
    if (!currentUser || !selectedAccount) return;
    
    const fetchEntries = async () => {
      try {
        const { db } = await import('../firebase');
        const { collection, getDocs } = await import('firebase/firestore');
        const entriesCol = collection(db, 'users', currentUser.uid, 'accounts', selectedAccount.id, 'entries');
        const snap = await getDocs(entriesCol);
        const data = snap.docs.map(doc => doc.data());
        setEntries(data);
        
        // Calculate monthly goal progress for each month
        const progress = {};
        months.forEach((_, monthIdx) => {
          const monthNum = monthIdx + 1;
          
          // Get entries for this month
          const monthEntries = data.filter(e => 
            String(e.year) === String(year) && 
            String(e.month) === String(monthNum) &&
            !e.isDeposit && 
            !e.isPayout && 
            !e.isTapeReading &&
            e.pnl !== undefined &&
            e.pnl !== null &&
            e.pnl !== ""
          );
          
          const monthlyPnl = monthEntries.reduce((sum, e) => sum + (Number(e.pnl) || 0), 0);
          
          // Calculate starting balance for this month
          const monthStart = new Date(year, monthIdx, 1);
          const entriesBeforeMonth = data.filter(e => {
            if (e.year && e.month && e.day) {
              const entryDate = new Date(e.year, e.month - 1, e.day);
              return entryDate < monthStart;
            } else if (e.created) {
              const entryDate = new Date(e.created.split('-')[0]);
              return entryDate < monthStart;
            }
            return false;
          });
          
          let startingBalance = 0;
          entriesBeforeMonth.forEach(e => {
            if (e.isDeposit) {
              startingBalance += Number(e.pnl) || 0;
            } else if (e.isPayout) {
              startingBalance += Number(e.pnl) || 0;
            } else if (!e.isTapeReading) {
              startingBalance += Number(e.pnl) || 0;
            }
          });
          
          const baseBalance = Math.max(startingBalance, 100);
          const monthlyPercentage = baseBalance > 0 ? (monthlyPnl / baseBalance) * 100 : 0;
          const progressPercentage = Math.min(100, Math.max(0, (monthlyPercentage / 20) * 100));
          
          progress[monthNum] = {
            pnl: monthlyPnl,
            percentage: monthlyPercentage,
            progress: progressPercentage,
            hasData: monthEntries.length > 0
          };
        });
        
        setMonthlyGoalProgress(progress);
      } catch (error) {
        console.error('Error fetching entries:', error);
      }
    };
    
    fetchEntries();
  }, [currentUser, selectedAccount, year]);

  return (
    <div className="flex flex-col items-center">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 w-full max-w-2xl mt-4">
        {months.map((month, idx) => {
          const monthNum = idx + 1;
          const goalData = monthlyGoalProgress[monthNum];
          
          return (
            <button
              key={month}
              className="bg-gray-800 hover:bg-gray-700 rounded-lg p-6 shadow text-lg font-semibold transition-all duration-300 hover:scale-105 relative overflow-hidden"
              onClick={() => navigate(`/month/${year}/${monthNum}`)}
            >
              <div className="relative z-10">
                <div className="text-lg font-semibold">{month}</div>
                
                {/* Goal Progress Indicator */}
                {goalData && goalData.hasData && (
                  <div className="mt-2">
                    <div className="flex justify-between items-center text-xs text-gray-300 mb-1">
                      <span>Goal: 20%</span>
                      <span>{goalData.progress.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-gray-600 rounded-full h-1.5">
                      <div 
                        className={`h-full transition-all duration-500 ease-out rounded-full ${
                          goalData.percentage >= 20 ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 
                          goalData.percentage >= 10 ? 'bg-gradient-to-r from-yellow-400 to-orange-500' : 
                          'bg-gradient-to-r from-blue-400 to-blue-500'
                        }`}
                        style={{ width: `${goalData.progress}%` }}
                      />
                    </div>
                    <div className={`text-xs mt-1 ${
                      goalData.pnl > 0 ? 'text-green-400' : 
                      goalData.pnl < 0 ? 'text-red-400' : 'text-gray-400'
                    }`}>
                      {goalData.pnl > 0 ? '+' : ''}{goalData.pnl.toFixed(2)}
                    </div>
                  </div>
                )}
                
                {/* No Data State */}
                {goalData && !goalData.hasData && (
                  <div className="mt-2 text-xs text-gray-500">
                    No trades yet
                  </div>
                )}
              </div>
              
              {/* Subtle Background Gradient */}
              {goalData && goalData.hasData && (
                <div 
                  className={`absolute inset-0 opacity-10 ${
                    goalData.percentage >= 20 ? 'bg-gradient-to-br from-green-400 to-emerald-500' : 
                    goalData.percentage >= 10 ? 'bg-gradient-to-br from-yellow-400 to-orange-500' : 
                    'bg-gradient-to-br from-blue-400 to-blue-500'
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default HomePage; 