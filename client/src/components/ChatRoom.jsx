import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../context/SocketContext.jsx';
import MessageBubble from './MessageBubble.jsx';
import { API } from '../App.jsx';

export default function ChatRoom({ room, user, onMenuClick }) {
  const { socket } = useSocket();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Fetch message history
  useEffect(() => {
    if (!room) return;
    setLoading(true);
    fetch(`${API}/api/rooms/${room.id}/messages`)
      .then((r) => r.json())
      .then((data) => {
        setMessages(data.messages || []);
        setLoading(false);
        setTimeout(scrollToBottom, 100);
      })
      .catch(() => setLoading(false));
  }, [room, scrollToBottom]);

  // Join room + listen for messages
  useEffect(() => {
    if (!socket || !room) return;

    socket.emit('room:join', room.id);

    const handleNew = (msg) => {
      setMessages((prev) => [...prev, msg]);
      setTimeout(scrollToBottom, 50);
    };

    const handleTyping = ({ username, isTyping }) => {
      if (username === user.username) return;
      setTypingUsers((prev) => {
        const next = new Set(prev);
        if (isTyping) next.add(username);
        else next.delete(username);
        return next;
      });
    };

    socket.on('message:new', handleNew);
    socket.on('typing:update', handleTyping);

    return () => {
      socket.off('message:new', handleNew);
      socket.off('typing:update', handleTyping);
      setTypingUsers(new Set());
    };
  }, [socket, room, user.username, scrollToBottom]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!input.trim() || !socket) return;

    socket.emit('message:send', {
      roomId: room.id,
      userId: user.id,
      content: input.trim(),
    });
    socket.emit('typing:stop', { roomId: room.id, username: user.username });
    setInput('');
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (!socket) return;

    socket.emit('typing:start', { roomId: room.id, username: user.username });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing:stop', { roomId: room.id, username: user.username });
    }, 2000);
  };

  if (!room) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 text-gray-400">
        <div className="text-center">
          <div className="text-6xl mb-4">💬</div>
          <p className="text-xl font-medium">Select a channel to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50 h-full">
      {/* Room Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shadow-sm">
        <button
          onClick={onMenuClick}
          className="md:hidden text-gray-500 hover:text-gray-700 text-xl"
        >
          ☰
        </button>
        <div>
          <h2 className="font-bold text-gray-800 text-lg">#{room.name}</h2>
          {room.description && (
            <p className="text-xs text-gray-500">{room.description}</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4">
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <p className="text-lg">No messages yet</p>
              <p className="text-sm">Be the first to say something!</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => {
              const prevMsg = messages[i - 1];
              const showAvatar =
                !prevMsg ||
                prevMsg.user_id !== msg.user_id ||
                new Date(msg.created_at) - new Date(prevMsg.created_at) > 60000;

              return (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isOwn={msg.user_id === user.id}
                  showAvatar={showAvatar}
                />
              );
            })}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing Indicator */}
      {typingUsers.size > 0 && (
        <div className="px-4 py-1 text-xs text-gray-500 italic">
          {Array.from(typingUsers).join(', ')}{' '}
          {typingUsers.size === 1 ? 'is' : 'are'} typing...
        </div>
      )}

      {/* Input */}
      <form onSubmit={sendMessage} className="p-3 bg-white border-t border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder={`Message #${room.name}`}
            className="flex-1 px-4 py-3 bg-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition text-sm"
            maxLength={2000}
            autoFocus
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition disabled:opacity-30 font-medium text-sm"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
