// In-memory storage - lightweight, zero config, perfect for demo
const AVATAR_COLORS = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E', '#06B6D4',
  '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6', '#F59E0B',
];

let nextUserId = 1;
let nextMsgId = 1;

const users = new Map();
const usersByName = new Map();

const rooms = [
  { id: 1, name: 'General', description: 'General discussion for everyone', created_at: new Date().toISOString() },
  { id: 2, name: 'Tech Talk', description: 'Programming, frameworks, and tech news', created_at: new Date().toISOString() },
  { id: 3, name: 'Random', description: 'Off-topic conversations and fun stuff', created_at: new Date().toISOString() },
];

// roomId -> messages[]
const messages = new Map();
messages.set(1, []);
messages.set(2, []);
messages.set(3, []);

export function initDB() {
  console.log('In-memory database initialized');
}

export function getRandomColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

export function findUserByName(username) {
  return usersByName.get(username) || null;
}

export function createUser(username, color) {
  const user = {
    id: nextUserId++,
    username,
    avatar_color: color,
    created_at: new Date().toISOString(),
  };
  users.set(user.id, user);
  usersByName.set(username, user);
  return user;
}

export function getUserById(id) {
  return users.get(id) || null;
}

export function getRooms() {
  return rooms;
}

export function getMessages(roomId) {
  return (messages.get(roomId) || []).slice(-200);
}

export function addMessage(roomId, userId, content) {
  const user = users.get(userId);
  if (!user) return null;

  const msg = {
    id: nextMsgId++,
    room_id: roomId,
    user_id: userId,
    username: user.username,
    avatar_color: user.avatar_color,
    content,
    created_at: new Date().toISOString(),
  };

  if (!messages.has(roomId)) messages.set(roomId, []);
  messages.get(roomId).push(msg);
  return msg;
}
