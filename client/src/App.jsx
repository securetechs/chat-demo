import { useState } from 'react';
import Login from './components/Login.jsx';
import ChatLayout from './components/ChatLayout.jsx';
import { SocketProvider } from './context/SocketContext.jsx';

const API = import.meta.env.PROD ? '' : 'http://localhost:3001';

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('chat_user');
    return saved ? JSON.parse(saved) : null;
  });

  const handleLogin = async (username) => {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    const data = await res.json();
    if (data.user) {
      setUser(data.user);
      localStorage.setItem('chat_user', JSON.stringify(data.user));
    }
    return data;
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('chat_user');
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <SocketProvider user={user}>
      <ChatLayout user={user} onLogout={handleLogout} />
    </SocketProvider>
  );
}

export { API };
