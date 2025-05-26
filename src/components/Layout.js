import React from "react";
import NavBar from "./NavBar";

const Layout = ({ children }) => (
  <div className="min-h-screen w-full">
    <NavBar />
    <div className="pt-20 px-0 w-full">
      {children}
    </div>
  </div>
);

export default Layout; 