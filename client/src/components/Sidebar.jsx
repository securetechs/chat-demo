import { useSocket } from '../context/SocketContext.jsx';

const ROOM_ICONS = { General: '#', 'Tech Talk': '⚡', Random: '🎲' };

export default function Sidebar({ rooms, activeRoom, onSelectRoom, user, onLogout, onClose }) {
  const { onlineUsers } = useSocket();

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">💬</span>
          <h1 className="font-bold text-lg">LiveChat</h1>
        </div>
        {onClose && (
          <button onClick={onClose} className="md:hidden text-gray-400 hover:text-white text-xl">
            ✕
          </button>
        )}
      </div>

      {/* Rooms */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">
            Channels
          </h2>
          {rooms.map((room) => (
            <button
              key={room.id}
              onClick={() => {
                onSelectRoom(room);
                onClose?.();
              }}
              className={`w-full text-left px-3 py-2 rounded-lg mb-0.5 flex items-center gap-2 transition ${
                activeRoom?.id === room.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <span className="text-gray-400 w-5 text-center">
                {ROOM_ICONS[room.name] || '#'}
              </span>
              <span className="font-medium">{room.name}</span>
            </button>
          ))}
        </div>

        {/* Online Users */}
        <div className="px-3 py-3 border-t border-gray-700">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">
            Online — {onlineUsers.length}
          </h2>
          {onlineUsers.map((u, i) => (
            <div key={i} className="flex items-center gap-2 px-2 py-1.5">
              <div className="relative">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                  style={{ backgroundColor: u.avatarColor }}
                >
                  {u.username.slice(0, 2).toUpperCase()}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900" />
              </div>
              <span className="text-sm text-gray-300">{u.username}</span>
            </div>
          ))}
        </div>
      </div>

      {/* User Footer */}
      <div className="p-3 border-t border-gray-700 flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
          style={{ backgroundColor: user.avatar_color }}
        >
          {user.username.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{user.username}</p>
          <p className="text-xs text-green-400">Online</p>
        </div>
        <button
          onClick={onLogout}
          className="text-gray-400 hover:text-red-400 transition text-sm"
          title="Logout"
        >
          ↩
        </button>
      </div>
    </div>
  );
}
