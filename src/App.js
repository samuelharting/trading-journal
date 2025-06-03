import React, { useState, useEffect, createContext } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import HomePage from "./pages/HomePage";
import MonthPage from "./pages/MonthPage";
import DayPage from "./pages/DayPage";
import TradesPage from "./pages/TradesPage";
import ContextPage from "./pages/ContextPage";
import SummaryPage from "./pages/SummaryPage";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import NotebookPage from "./pages/NotebookPage";

export const UserContext = createContext();

function App() {
  const [user, setUser] = useState(() => localStorage.getItem('journalUser') || null);

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  const login = (username) => {
    setUser(username);
    localStorage.setItem('journalUser', username);
  };
  const logout = () => {
    setUser(null);
    localStorage.removeItem('journalUser');
  };

  return (
    <UserContext.Provider value={{ user, login, logout }}>
      <Router>
        {user ? (
          <Layout>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/month/:year/:month" element={<MonthPage />} />
              <Route path="/day/:month/:day" element={<DayPage />} />
              <Route path="/trades" element={<TradesPage />} />
              <Route path="/context" element={<ContextPage />} />
              <Route path="/notebook" element={<NotebookPage />} />
              <Route path="/summary" element={<SummaryPage />} />
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
