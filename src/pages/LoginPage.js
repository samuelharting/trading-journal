import React, { useState, useContext } from 'react';
import { UserContext } from '../App';

const getUserPin = (username) => {
  const users = JSON.parse(localStorage.getItem('journalUsers') || '{}');
  return users[username];
};
const setUserPin = (username, pin) => {
  const users = JSON.parse(localStorage.getItem('journalUsers') || '{}');
  users[username] = pin;
  localStorage.setItem('journalUsers', JSON.stringify(users));
};

const LoginPage = () => {
  const { login } = useContext(UserContext);
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [mode, setMode] = useState('login'); // login or create
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username || pin.length !== 4) {
      setError('Enter username and 4-digit PIN');
      return;
    }
    const existingPin = getUserPin(username);
    if (existingPin) {
      if (existingPin === pin) {
        login(username);
      } else {
        setError('Incorrect PIN');
      }
    } else {
      setUserPin(username, pin);
      login(username);
    }
  };

  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-black">
      <form onSubmit={handleSubmit} className="bg-neutral-900 rounded-2xl shadow-2xl p-10 flex flex-col gap-6 min-w-[320px] max-w-xs">
        <h2 className="text-2xl font-bold text-[#e5e5e5] mb-2">Trading Journal Login</h2>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={e => { setUsername(e.target.value); setError(''); }}
          className="bg-neutral-800 text-[#e5e5e5] p-3 rounded-md border-none focus:ring-2 focus:ring-blue-700 transition-all text-lg"
          autoFocus
        />
        <input
          type="password"
          placeholder="4-digit PIN"
          value={pin}
          onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setError(''); }}
          className="bg-neutral-800 text-[#e5e5e5] p-3 rounded-md border-none focus:ring-2 focus:ring-blue-700 transition-all text-lg tracking-widest"
          maxLength={4}
          inputMode="numeric"
        />
        {error && <div className="text-red-400 text-sm font-semibold">{error}</div>}
        <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white rounded-md p-3 font-bold text-lg transition-all">{getUserPin(username) ? 'Login' : 'Create Account'}</button>
      </form>
    </div>
  );
};

export default LoginPage; 