import React from "react";
import { useNavigate } from "react-router-dom";

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const HomePage = () => {
  const navigate = useNavigate();
  const year = new Date().getFullYear();

  return (
    <div className="flex flex-col items-center">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 w-full max-w-2xl mt-4">
        {months.map((month, idx) => (
          <button
            key={month}
            className="bg-gray-800 hover:bg-gray-700 rounded-lg p-6 shadow text-lg font-semibold transition-colors duration-150"
            onClick={() => navigate(`/month/${year}/${idx + 1}`)}
          >
            {month}
          </button>
        ))}
      </div>
    </div>
  );
};

export default HomePage; 