import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  initDB, getRandomColor, findUserByName, createUser,
  getRooms, getMessages, addMessage,
} from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: { origin: true, methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

// Serve static frontend
const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));

// ── REST API ──

app.post('/api/auth/login', (req, res) => {
  const { username } = req.body;
  if (!username || username.trim().length < 2) {
    return res.status(400).json({ error: 'Username must be at least 2 characters' });
  }

  const name = username.trim().slice(0, 50);
  const existing = findUserByName(name);
  if (existing) return res.json({ user: existing });

  const user = createUser(name, getRandomColor());
  res.json({ user });
});

app.get('/api/rooms', (_req, res) => {
  res.json({ rooms: getRooms() });
});

app.get('/api/rooms/:roomId/messages', (req, res) => {
  const messages = getMessages(parseInt(req.params.roomId));
  res.json({ messages });
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Socket.io ──

const onlineUsers = new Map();

io.on('connection', (socket) => {
  socket.on('user:join', (user) => {
    onlineUsers.set(socket.id, {
      userId: user.id,
      username: user.username,
      avatarColor: user.avatar_color,
    });
    io.emit('users:online', Array.from(onlineUsers.values()));
  });

  socket.on('room:join', (roomId) => {
    for (const room of socket.rooms) {
      if (room !== socket.id) socket.leave(room);
    }
    socket.join(`room:${roomId}`);
  });

  socket.on('message:send', ({ roomId, userId, content }) => {
    if (!content || !content.trim()) return;
    const msg = addMessage(roomId, userId, content.trim());
    if (msg) io.to(`room:${roomId}`).emit('message:new', msg);
  });

  socket.on('typing:start', ({ roomId, username }) => {
    socket.to(`room:${roomId}`).emit('typing:update', { username, isTyping: true });
  });

  socket.on('typing:stop', ({ roomId, username }) => {
    socket.to(`room:${roomId}`).emit('typing:update', { username, isTyping: false });
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(socket.id);
    io.emit('users:online', Array.from(onlineUsers.values()));
  });
});

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

const PORT = process.env.PORT || 3001;
initDB();
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on 0.0.0.0:${PORT}`);
});
