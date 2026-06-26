import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import db, { initDB, getRandomColor } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: { origin: true, methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

// Serve static frontend in production
const clientDist = path.join(__dirname, '../client/dist');
app.use(express.static(clientDist));

// ── REST API ──

app.post('/api/auth/login', (req, res) => {
  const { username } = req.body;
  if (!username || username.trim().length < 2) {
    return res.status(400).json({ error: 'Username must be at least 2 characters' });
  }

  const name = username.trim().slice(0, 50);

  try {
    const existing = db.prepare('SELECT * FROM users WHERE username = ?').get(name);
    if (existing) return res.json({ user: existing });

    const color = getRandomColor();
    const result = db.prepare('INSERT INTO users (username, avatar_color) VALUES (?, ?)').run(name, color);
    const newUser = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.json({ user: newUser });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/rooms', (_req, res) => {
  try {
    const rooms = db.prepare('SELECT * FROM rooms ORDER BY id').all();
    res.json({ rooms });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/rooms/:roomId/messages', (req, res) => {
  try {
    const messages = db.prepare(`
      SELECT m.id, m.content, m.created_at, m.room_id,
             u.id as user_id, u.username, u.avatar_color
      FROM messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.room_id = ?
      ORDER BY m.created_at ASC
      LIMIT 200
    `).all(req.params.roomId);
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Socket.io ──

const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

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

    try {
      const result = db.prepare(
        'INSERT INTO messages (room_id, user_id, content) VALUES (?, ?, ?)'
      ).run(roomId, userId, content.trim());

      const msg = db.prepare(`
        SELECT m.id, m.content, m.created_at, m.room_id,
               u.id as user_id, u.username, u.avatar_color
        FROM messages m
        JOIN users u ON m.user_id = u.id
        WHERE m.id = ?
      `).get(result.lastInsertRowid);

      io.to(`room:${roomId}`).emit('message:new', msg);
    } catch (err) {
      console.error('Message save error:', err);
    }
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
  res.sendFile(path.join(clientDist, 'index.html'));
});

// ── Start ──

const PORT = process.env.PORT || 3001;

initDB();
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on 0.0.0.0:${PORT}`);
});
