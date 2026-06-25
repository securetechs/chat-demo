function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function MessageBubble({ message, isOwn, showAvatar }) {
  const { username, avatar_color, content, created_at } = message;
  const initials = username.slice(0, 2).toUpperCase();

  return (
    <div className={`flex gap-3 px-4 py-1 ${isOwn ? 'flex-row-reverse' : ''}`}>
      {showAvatar ? (
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-1"
          style={{ backgroundColor: avatar_color }}
        >
          {initials}
        </div>
      ) : (
        <div className="w-8 flex-shrink-0" />
      )}

      <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
        {showAvatar && (
          <span className={`text-xs font-medium text-gray-500 mb-1 ${isOwn ? 'text-right' : ''}`}>
            {username}
          </span>
        )}
        <div
          className={`px-4 py-2 rounded-2xl text-sm leading-relaxed break-words ${
            isOwn
              ? 'bg-indigo-600 text-white rounded-br-md'
              : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-md'
          }`}
        >
          {content}
        </div>
        <span className="text-[10px] text-gray-400 mt-1 px-1">
          {formatTime(created_at)}
        </span>
      </div>
    </div>
  );
}
