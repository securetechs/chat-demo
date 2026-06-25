import { useState, useEffect } from 'react';
import Sidebar from './Sidebar.jsx';
import ChatRoom from './ChatRoom.jsx';
import { API } from '../App.jsx';

export default function ChatLayout({ user, onLogout }) {
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/rooms`)
      .then((r) => r.json())
      .then((data) => {
        setRooms(data.rooms || []);
        if (data.rooms?.length > 0) {
          setActiveRoom(data.rooms[0]);
        }
      });
  }, []);

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed md:static inset-y-0 left-0 z-30 w-64 transform transition-transform md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar
          rooms={rooms}
          activeRoom={activeRoom}
          onSelectRoom={setActiveRoom}
          user={user}
          onLogout={onLogout}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {/* Main Chat */}
      <ChatRoom
        room={activeRoom}
        user={user}
        onMenuClick={() => setSidebarOpen(true)}
      />
    </div>
  );
}
