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

export const UserContext = createContext();

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);

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
      const { collection, getDocs } = await import('firebase/firestore');
      const accountsCol = collection(db, 'users', currentUser.uid, 'accounts');
      const snap = await getDocs(accountsCol);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAccounts(data);
      if (data.length > 0 && !selectedAccount) {
        setSelectedAccount(data[0]);
      }
    }
    fetchAccounts();
  }, [currentUser]);

  useEffect(() => {
    console.log('App.js currentUser:', currentUser, 'authReady:', authReady, 'accounts:', accounts, 'selectedAccount:', selectedAccount);
  }, [currentUser, authReady, accounts, selectedAccount]);

  if (!authReady) return null;

  return (
    <UserContext.Provider value={{ currentUser, accounts, selectedAccount, setSelectedAccount, setAccounts }}>
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
    </UserContext.Provider>
  );
}

export default App;
