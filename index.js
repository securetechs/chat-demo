const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true } });

app.use(express.json());

// ── In-memory DB ──
const COLORS = ["#EF4444","#F97316","#EAB308","#22C55E","#06B6D4","#3B82F6","#8B5CF6","#EC4899","#14B8A6","#F59E0B"];
let uid = 1, mid = 1;
const users = new Map(), byName = new Map();
const rooms = [
  { id: 1, name: "General", description: "General discussion for everyone" },
  { id: 2, name: "Tech Talk", description: "Programming, frameworks, and tech news" },
  { id: 3, name: "Random", description: "Off-topic conversations and fun stuff" },
];
const msgs = new Map([[1,[]],[2,[]],[3,[]]]);

// ── API ──
app.post("/api/auth/login", (req, res) => {
  const name = (req.body.username || "").trim().slice(0, 50);
  if (name.length < 2) return res.status(400).json({ error: "Min 2 chars" });
  if (byName.has(name)) return res.json({ user: byName.get(name) });
  const u = { id: uid++, username: name, avatar_color: COLORS[Math.floor(Math.random()*COLORS.length)], created_at: new Date().toISOString() };
  users.set(u.id, u); byName.set(name, u);
  res.json({ user: u });
});

app.get("/api/rooms", (_, res) => res.json({ rooms }));

app.get("/api/rooms/:id/messages", (req, res) => {
  res.json({ messages: (msgs.get(parseInt(req.params.id)) || []).slice(-200) });
});

app.get("/health", (_, res) => res.json({ status: "ok" }));

// ── Socket.io ──
const online = new Map();
io.on("connection", (s) => {
  s.on("user:join", (u) => { online.set(s.id, { userId: u.id, username: u.username, avatarColor: u.avatar_color }); io.emit("users:online", [...online.values()]); });
  s.on("room:join", (rid) => { for (const r of s.rooms) if (r !== s.id) s.leave(r); s.join("r:" + rid); });
  s.on("message:send", ({ roomId, userId, content }) => {
    if (!content?.trim()) return;
    const u = users.get(userId); if (!u) return;
    const m = { id: mid++, room_id: roomId, user_id: userId, username: u.username, avatar_color: u.avatar_color, content: content.trim(), created_at: new Date().toISOString() };
    if (!msgs.has(roomId)) msgs.set(roomId, []);
    msgs.get(roomId).push(m);
    io.to("r:" + roomId).emit("message:new", m);
  });
  s.on("typing:start", ({ roomId, username }) => s.to("r:" + roomId).emit("typing:update", { username, isTyping: true }));
  s.on("typing:stop", ({ roomId, username }) => s.to("r:" + roomId).emit("typing:update", { username, isTyping: false }));
  s.on("disconnect", () => { online.delete(s.id); io.emit("users:online", [...online.values()]); });
});

// ── Serve frontend ──
app.get("*", (_, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(HTML);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, "0.0.0.0", () => console.log("Server running on port " + PORT));

// ── Embedded Frontend ──
const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>LiveChat</title>
<script src="https://cdn.tailwindcss.com"><\/script>
<script src="/socket.io/socket.io.js"><\/script>
<style>
*{scrollbar-width:thin;scrollbar-color:#cbd5e1 transparent}
*::-webkit-scrollbar{width:6px}*::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px}
.fade-in{animation:fadeIn .3s ease}@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
</style>
</head>
<body class="bg-gray-100 h-screen overflow-hidden">
<div id="app"></div>
<script>
const API = "";
let user = JSON.parse(localStorage.getItem("chat_user") || "null");
let socket = null, currentRoom = null, rooms = [], messages = [], onlineUsers = [], typingUsers = new Set();
let typingTimeout = null;

function render() {
  if (!user) return renderLogin();
  renderChat();
}

function renderLogin() {
  document.getElementById("app").innerHTML = \`
  <div class="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
      <div class="text-center mb-8"><div class="text-5xl mb-3">💬</div><h1 class="text-3xl font-bold text-gray-800">LiveChat</h1><p class="text-gray-500 mt-2">Real-time messaging platform</p></div>
      <form onsubmit="login(event)">
        <label class="block text-sm font-medium text-gray-700 mb-2">Choose a username</label>
        <input id="loginInput" type="text" placeholder="Enter your name..." maxlength="50" class="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition text-lg" autofocus>
        <div id="loginError" class="text-red-500 text-sm mt-2 hidden"></div>
        <button type="submit" class="w-full mt-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition text-lg">Join Chat</button>
      </form>
      <p class="text-center text-xs text-gray-400 mt-6">Built with React + Node.js + Socket.io + MySQL</p>
    </div>
  </div>\`;
}

async function login(e) {
  e.preventDefault();
  const name = document.getElementById("loginInput").value.trim();
  if (name.length < 2) { document.getElementById("loginError").textContent = "Min 2 characters"; document.getElementById("loginError").classList.remove("hidden"); return; }
  const res = await fetch(API + "/api/auth/login", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({username: name}) });
  const data = await res.json();
  if (data.error) { document.getElementById("loginError").textContent = data.error; document.getElementById("loginError").classList.remove("hidden"); return; }
  user = data.user;
  localStorage.setItem("chat_user", JSON.stringify(user));
  connectSocket();
  loadRooms();
}

function connectSocket() {
  socket = io();
  socket.on("connect", () => socket.emit("user:join", user));
  socket.on("users:online", (u) => { onlineUsers = u; updateOnline(); });
  socket.on("message:new", (m) => { if (currentRoom && m.room_id === currentRoom.id) { messages.push(m); renderMessages(); scrollBottom(); } });
  socket.on("typing:update", ({ username, isTyping }) => { if (username === user.username) return; if (isTyping) typingUsers.add(username); else typingUsers.delete(username); updateTyping(); });
}

async function loadRooms() {
  const res = await fetch(API + "/api/rooms");
  const data = await res.json();
  rooms = data.rooms;
  currentRoom = rooms[0];
  render();
  joinRoom(currentRoom);
}

async function joinRoom(room) {
  currentRoom = room;
  socket.emit("room:join", room.id);
  typingUsers.clear();
  const res = await fetch(API + "/api/rooms/" + room.id + "/messages");
  const data = await res.json();
  messages = data.messages;
  renderRoomList();
  renderMessages();
  updateTyping();
  setTimeout(scrollBottom, 100);
}

function renderChat() {
  const icons = {General:"#","Tech Talk":"⚡",Random:"🎲"};
  document.getElementById("app").innerHTML = \`
  <div class="h-screen flex overflow-hidden">
    <div id="sidebar" class="w-64 bg-gray-900 text-white flex flex-col hidden md:flex">
      <div class="p-4 border-b border-gray-700 flex items-center gap-2"><span class="text-xl">💬</span><h1 class="font-bold text-lg">LiveChat</h1></div>
      <div class="flex-1 overflow-y-auto">
        <div class="px-3 py-3"><h2 class="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">Channels</h2><div id="roomList"></div></div>
        <div class="px-3 py-3 border-t border-gray-700"><h2 class="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2" id="onlineCount">Online — 0</h2><div id="onlineList"></div></div>
      </div>
      <div class="p-3 border-t border-gray-700 flex items-center gap-3">
        <div class="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold" style="background:\${user.avatar_color}">\${user.username.slice(0,2).toUpperCase()}</div>
        <div class="flex-1 min-w-0"><p class="text-sm font-medium truncate">\${user.username}</p><p class="text-xs text-green-400">Online</p></div>
        <button onclick="logout()" class="text-gray-400 hover:text-red-400 text-sm" title="Logout">↩</button>
      </div>
    </div>
    <div class="flex-1 flex flex-col bg-gray-50 h-full">
      <div class="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shadow-sm">
        <button onclick="toggleSidebar()" class="md:hidden text-gray-500 hover:text-gray-700 text-xl">☰</button>
        <div><h2 class="font-bold text-gray-800 text-lg" id="roomTitle">#\${currentRoom?.name||""}</h2><p class="text-xs text-gray-500" id="roomDesc">\${currentRoom?.description||""}</p></div>
      </div>
      <div id="messagesArea" class="flex-1 overflow-y-auto py-4"></div>
      <div id="typingArea" class="px-4 py-1 text-xs text-gray-500 italic hidden"></div>
      <form onsubmit="sendMessage(event)" class="p-3 bg-white border-t border-gray-200"><div class="flex gap-2">
        <input id="msgInput" type="text" placeholder="Message #\${currentRoom?.name||""}" class="flex-1 px-4 py-3 bg-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition text-sm" maxlength="2000" autocomplete="off" oninput="handleTyping()">
        <button type="submit" class="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition font-medium text-sm">Send</button>
      </div></form>
    </div>
  </div>\`;
  renderRoomList();
  renderMessages();
  updateOnline();
}

function renderRoomList() {
  const icons = {General:"#","Tech Talk":"⚡",Random:"🎲"};
  const el = document.getElementById("roomList");
  if (!el) return;
  el.innerHTML = rooms.map(r => \`<button onclick="joinRoom(rooms[\${rooms.indexOf(r)}])" class="w-full text-left px-3 py-2 rounded-lg mb-0.5 flex items-center gap-2 transition \${currentRoom?.id===r.id?"bg-indigo-600 text-white":"text-gray-300 hover:bg-gray-800 hover:text-white"}"><span class="text-gray-400 w-5 text-center">\${icons[r.name]||"#"}</span><span class="font-medium">\${r.name}</span></button>\`).join("");
}

function renderMessages() {
  const el = document.getElementById("messagesArea");
  if (!el) return;
  if (messages.length === 0) { el.innerHTML = '<div class="flex items-center justify-center h-full text-gray-400"><div class="text-center"><p class="text-lg">No messages yet</p><p class="text-sm">Be the first to say something!</p></div></div>'; return; }
  el.innerHTML = messages.map((m, i) => {
    const prev = messages[i-1];
    const showAvatar = !prev || prev.user_id !== m.user_id || new Date(m.created_at) - new Date(prev.created_at) > 60000;
    const isOwn = m.user_id === user.id;
    const time = new Date(m.created_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
    const initials = m.username.slice(0,2).toUpperCase();
    return \`<div class="flex gap-3 px-4 py-1 fade-in \${isOwn?"flex-row-reverse":""}">
      \${showAvatar?\`<div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-1" style="background:\${m.avatar_color}">\${initials}</div>\`:'<div class="w-8 flex-shrink-0"></div>'}
      <div class="max-w-[70%] flex flex-col \${isOwn?"items-end":"items-start"}">
        \${showAvatar?\`<span class="text-xs font-medium text-gray-500 mb-1">\${m.username}</span>\`:""}
        <div class="px-4 py-2 rounded-2xl text-sm leading-relaxed break-words \${isOwn?"bg-indigo-600 text-white rounded-br-md":"bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-md"}">\${escHtml(m.content)}</div>
        <span class="text-[10px] text-gray-400 mt-1 px-1">\${time}</span>
      </div>
    </div>\`;
  }).join("");
}

function updateOnline() {
  const countEl = document.getElementById("onlineCount");
  const listEl = document.getElementById("onlineList");
  if (!countEl || !listEl) return;
  countEl.textContent = "Online — " + onlineUsers.length;
  listEl.innerHTML = onlineUsers.map(u => \`<div class="flex items-center gap-2 px-2 py-1.5"><div class="relative"><div class="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style="background:\${u.avatarColor}">\${u.username.slice(0,2).toUpperCase()}</div><div class="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900"></div></div><span class="text-sm text-gray-300">\${u.username}</span></div>\`).join("");
}

function updateTyping() {
  const el = document.getElementById("typingArea");
  if (!el) return;
  if (typingUsers.size > 0) { el.classList.remove("hidden"); el.textContent = [...typingUsers].join(", ") + (typingUsers.size === 1 ? " is" : " are") + " typing..."; }
  else el.classList.add("hidden");
}

function sendMessage(e) {
  e.preventDefault();
  const input = document.getElementById("msgInput");
  if (!input.value.trim() || !socket) return;
  socket.emit("message:send", { roomId: currentRoom.id, userId: user.id, content: input.value.trim() });
  socket.emit("typing:stop", { roomId: currentRoom.id, username: user.username });
  input.value = "";
}

function handleTyping() {
  if (!socket) return;
  socket.emit("typing:start", { roomId: currentRoom.id, username: user.username });
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => socket.emit("typing:stop", { roomId: currentRoom.id, username: user.username }), 2000);
}

function scrollBottom() { const el = document.getElementById("messagesArea"); if (el) el.scrollTop = el.scrollHeight; }

function toggleSidebar() { const el = document.getElementById("sidebar"); el.classList.toggle("hidden"); el.classList.toggle("fixed"); el.classList.toggle("inset-y-0"); el.classList.toggle("left-0"); el.classList.toggle("z-50"); }

function logout() { user = null; localStorage.removeItem("chat_user"); if (socket) socket.disconnect(); render(); }

function escHtml(s) { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

// Init
if (user) { connectSocket(); loadRooms(); } else render();
<\/script>
</body>
</html>`;
