import React, { useState, useEffect, createContext } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import HomePage from "./pages/HomePage";
import MonthPage from "./pages/MonthPage";
import DayPage from "./pages/DayPage";
import TradesPage from "./pages/TradesPage";
import ContextPage from "./pages/ContextPage";
import SummaryPage from "./pages/SummaryPage";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import NotebookPage from "./pages/NotebookPage";
import EditAccountPage from "./pages/EditAccountPage";
import { XMarkIcon } from '@heroicons/react/24/solid';

export const UserContext = createContext();

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState(null);
  const [dataRefreshTrigger, setDataRefreshTrigger] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Fetch accounts for the current user
  useEffect(() => {
    if (!currentUser) return;
    async function fetchAccounts() {
      const { db } = await import('./firebase');
      const { collection, getDocs, addDoc } = await import('firebase/firestore');
      const accountsCol = collection(db, 'users', currentUser.uid, 'accounts');
      const snap = await getDocs(accountsCol);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // If no accounts exist, create a default account
      if (data.length === 0) {
        try {
          const defaultAccount = {
            name: 'Default Account',
            balance: 0,
            created: new Date().toISOString()
          };
          const docRef = await addDoc(accountsCol, defaultAccount);
          const newAccount = { id: docRef.id, ...defaultAccount };
          setAccounts([newAccount]);
          setSelectedAccount(newAccount);
        } catch (error) {
          console.error('Error creating default account:', error);
        }
      } else {
        setAccounts(data);
        if (!selectedAccount) {
          setSelectedAccount(data[0]);
        }
      }
    }
    fetchAccounts();
  }, [currentUser]);

  useEffect(() => {
    console.log('App.js currentUser:', currentUser, 'authReady:', authReady, 'accounts:', accounts, 'selectedAccount:', selectedAccount);
  }, [currentUser, authReady, accounts, selectedAccount]);

  const handleDeleteAccount = async () => {
    if (!accountToDelete || !currentUser) return;
    
    try {
      // Delete the account document
      const { db } = await import('./firebase');
      const { deleteDoc, doc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'users', currentUser.uid, 'accounts', accountToDelete.id));
      
      // Remove from local state
      setAccounts(prev => prev.filter(acc => acc.id !== accountToDelete.id));
      
      // If this was the selected account, select the first remaining account or null
      if (selectedAccount && selectedAccount.id === accountToDelete.id) {
        const remainingAccounts = accounts.filter(acc => acc.id !== accountToDelete.id);
        setSelectedAccount(remainingAccounts.length > 0 ? remainingAccounts[0] : null);
      }
      
      console.log('Account deleted successfully:', accountToDelete.name);
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Failed to delete account. Please try again.');
    } finally {
      setShowDeleteConfirm(false);
      setAccountToDelete(null);
    }
  };

  if (!authReady) return null;

  return (
    <UserContext.Provider value={{ 
      currentUser, 
      accounts, 
      selectedAccount, 
      setSelectedAccount, 
      setAccounts,
      setShowDeleteConfirm,
      setAccountToDelete,
      dataRefreshTrigger,
      triggerDataRefresh: () => setDataRefreshTrigger(prev => prev + 1)
    }}>
      <Router>
        {currentUser ? (
          <Layout>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/month/:year/:month" element={<MonthPage />} />
              <Route path="/day/:month/:day" element={<DayPage />} />
              <Route path="/trades" element={<TradesPage />} />
              <Route path="/context" element={<ContextPage />} />
              <Route path="/notebook" element={<NotebookPage />} />
              <Route path="/summary" element={<SummaryPage />} />
              <Route path="/edit-account" element={<EditAccountPage />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Layout>
        ) : (
          <LoginPage />
        )}
      </Router>
      
      {/* Delete Account Confirmation Dialog */}
      {showDeleteConfirm && accountToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-white/10 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold text-[#e5e5e5] mb-4">Delete Account</h3>
            <p className="text-neutral-400 mb-6">
              Are you sure you want to delete <span className="text-red-400 font-semibold">"{accountToDelete.name}"</span>? 
              This action cannot be undone and will permanently remove all data associated with this account.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setAccountToDelete(null);
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-[#e5e5e5] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </UserContext.Provider>
  );
}

export default App;
