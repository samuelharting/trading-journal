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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    console.log('App.js currentUser:', currentUser, 'authReady:', authReady);
  }, [currentUser, authReady]);

  if (!authReady) return null;

  return (
    <UserContext.Provider value={{ currentUser }}>
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
