import React, { useState, createContext, useContext } from "react";
import NavBar from "./NavBar";

const HeaderContext = createContext();

export const useHeader = () => {
  const context = useContext(HeaderContext);
  if (!context) {
    throw new Error('useHeader must be used within a HeaderProvider');
  }
  return context;
};

const Layout = ({ children }) => {
  const [showHeader, setShowHeader] = useState(true);

  return (
    <HeaderContext.Provider value={{ showHeader, setShowHeader }}>
      <div className="min-h-screen w-full">
        {showHeader && <NavBar />}
        <div className={`w-full ${showHeader ? 'pt-20' : 'pt-0'} px-0`}>
          {children}
        </div>
      </div>
    </HeaderContext.Provider>
  );
};

export default Layout; 