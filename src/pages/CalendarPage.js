import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../App";
import { getTradingPerformance } from '../statsUtils';

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
        
        // Calculate monthly goal progress for each month using statsUtils
        const progress = {};
        months.forEach((_, monthIdx) => {
          const monthNum = monthIdx + 1;
          
          // Use the same logic as Summary page
          const monthPerformance = getTradingPerformance(data, year, monthNum);
          
          if (monthPerformance) {
            const tradeCount = data.filter(e => 
              String(e.year) === String(year) && 
              String(e.month) === String(monthNum) &&
              !e.isDeposit && 
              !e.isPayout && 
              !e.isTapeReading &&
              e.pnl !== undefined &&
              e.pnl !== null &&
              e.pnl !== ""
            ).length;
            
            progress[monthNum] = {
              pnl: monthPerformance.pnl,
              percentage: monthPerformance.percentage,
              progress: monthPerformance.progressToward20Percent,
              hasData: monthPerformance.hasTrades, // Map hasTrades to hasData
              tradeCount: tradeCount
            };
            
            // Debug logging for August
            if (monthNum === 8) {
              console.log('📅 CalendarPage August Debug:', {
                monthPerformance,
                hasData: monthPerformance.hasTrades,
                pnl: monthPerformance.pnl,
                percentage: monthPerformance.percentage,
                tradeCount: tradeCount
              });
            }
          } else {
            progress[monthNum] = {
              pnl: 0,
              percentage: 0,
              progress: 0,
              hasData: false,
              tradeCount: 0
            };
          }
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
          
          // Debug logging for August
          if (monthNum === 8 && goalData) {
            console.log('📅 CalendarPage August Display Debug:', {
              monthNum,
              goalData,
              pnl: goalData.pnl,
              percentage: goalData.percentage,
              hasData: goalData.hasData,
              tradeCount: goalData.tradeCount
            });
          }
          
          return (
            <button
              key={month}
              className="bg-gray-800 hover:bg-gray-700 rounded-lg p-6 shadow text-lg font-semibold transition-all duration-300 hover:scale-105 relative overflow-hidden"
              onClick={() => navigate(`/month/${year}/${monthNum}`)}
            >
              <div className="relative z-10">
                <div className="text-lg font-semibold">{month}</div>
                
                {/* Goal Progress Indicator */}
                {goalData && (
                  <div className="mt-2">
                    {/* Always show P&L and percentage if they exist */}
                    <div className={`text-xs mt-1 ${
                      goalData.pnl > 0 ? 'text-green-400' : 
                      goalData.pnl < 0 ? 'text-red-400' : 'text-gray-400'
                    }`}>
                      {goalData.pnl > 0 ? '+' : ''}{goalData.pnl.toFixed(2)}
                    </div>
                    
                    {/* Always show percentage - even if it's 0 */}
                    <div className={`text-xs ${
                      goalData.percentage > 0 ? 'text-green-400' : 
                      goalData.percentage < 0 ? 'text-red-400' : 'text-gray-400'
                    }`}>
                      ({goalData.percentage > 0 ? '+' : ''}{goalData.percentage.toFixed(1)}%)
                      {/* Debug: Raw value = {JSON.stringify(goalData.percentage)} */}
                    </div>
                    
                    {/* Always show trade count if it exists */}
                    {goalData.tradeCount !== undefined && (
                      <div className="text-xs text-gray-400 mt-1">
                        {goalData.tradeCount} trade{goalData.tradeCount !== 1 ? 's' : ''}
                      </div>
                    )}
                    
                    {/* Only show progress bar if hasData is true */}
                    {goalData.hasData && (
                      <>
                        <div className="flex justify-between items-center text-xs text-gray-300 mb-1 mt-2">
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
                      </>
                    )}
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