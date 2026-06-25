import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import pool, { initDB, getRandomColor } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);

const clientOrigin = process.env.CLIENT_URL || 'http://localhost:5173';

const io = new Server(server, {
  cors: {
    origin: clientOrigin === '*' ? true : clientOrigin,
    methods: ['GET', 'POST'],
  },
});

app.use(cors({ origin: clientOrigin === '*' ? true : clientOrigin }));
app.use(express.json());

// Serve static frontend in production
const clientDist = path.join(__dirname, '../client/dist');
app.use(express.static(clientDist));

// ── REST API ──

// Login / register
app.post('/api/auth/login', async (req, res) => {
  const { username } = req.body;
  if (!username || username.trim().length < 2) {
    return res.status(400).json({ error: 'Username must be at least 2 characters' });
  }

  const name = username.trim().slice(0, 50);

  try {
    const [existing] = await pool.query('SELECT * FROM users WHERE username = ?', [name]);
    if (existing.length > 0) {
      return res.json({ user: existing[0] });
    }

    const color = getRandomColor();
    const [result] = await pool.query(
      'INSERT INTO users (username, avatar_color) VALUES (?, ?)',
      [name, color]
    );

    const [newUser] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
    res.json({ user: newUser[0] });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get rooms
app.get('/api/rooms', async (_req, res) => {
  try {
    const [rooms] = await pool.query('SELECT * FROM rooms ORDER BY id');
    res.json({ rooms });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get messages for a room
app.get('/api/rooms/:roomId/messages', async (req, res) => {
  try {
    const [messages] = await pool.query(
      `SELECT m.id, m.content, m.created_at, m.room_id,
              u.id as user_id, u.username, u.avatar_color
       FROM messages m
       JOIN users u ON m.user_id = u.id
       WHERE m.room_id = ?
       ORDER BY m.created_at ASC
       LIMIT 200`,
      [req.params.roomId]
    );
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Socket.io ──

const onlineUsers = new Map(); // socketId -> { userId, username, avatarColor }

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
    // Leave all previous rooms except socket's own room
    for (const room of socket.rooms) {
      if (room !== socket.id) socket.leave(room);
    }
    socket.join(`room:${roomId}`);
  });

  socket.on('message:send', async ({ roomId, userId, content }) => {
    if (!content || !content.trim()) return;

    try {
      const [result] = await pool.query(
        'INSERT INTO messages (room_id, user_id, content) VALUES (?, ?, ?)',
        [roomId, userId, content.trim()]
      );

      const [rows] = await pool.query(
        `SELECT m.id, m.content, m.created_at, m.room_id,
                u.id as user_id, u.username, u.avatar_color
         FROM messages m
         JOIN users u ON m.user_id = u.id
         WHERE m.id = ?`,
        [result.insertId]
      );

      io.to(`room:${roomId}`).emit('message:new', rows[0]);
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
    console.log('Disconnected:', socket.id);
  });
});

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// ── Start ──

const PORT = process.env.PORT || 3001;

initDB()
  .then(() => {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on 0.0.0.0:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
