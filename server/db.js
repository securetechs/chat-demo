import mysql from 'mysql2/promise';

// Railway sets MYSQLHOST, MYSQLPORT, MYSQLUSER, MYSQLPASSWORD, MYSQLDATABASE
// Also support DB_ prefixed vars and DATABASE_URL as fallbacks
const dbHost = process.env.MYSQLHOST || process.env.DB_HOST || 'localhost';
const dbPort = parseInt(process.env.MYSQLPORT || process.env.DB_PORT || '3306');
const dbUser = process.env.MYSQLUSER || process.env.DB_USER || 'root';
const dbPass = process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '';
const dbName = process.env.MYSQLDATABASE || process.env.DB_NAME || 'chat_demo';

console.log(`Connecting to MySQL at ${dbHost}:${dbPort} as ${dbUser}, db=${dbName}`);

const pool = mysql.createPool({
  host: dbHost,
  port: dbPort,
  user: dbUser,
  password: dbPass,
  database: dbName,
  waitForConnections: true,
  connectionLimit: 10,
});

const AVATAR_COLORS = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E', '#06B6D4',
  '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6', '#F59E0B',
];

export async function initDB() {
  const conn = await mysql.createConnection({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPass,
  });

  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  await conn.end();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      avatar_color VARCHAR(10) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS rooms (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL,
      description VARCHAR(255) DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      room_id INT NOT NULL,
      user_id INT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (room_id) REFERENCES rooms(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Seed default rooms
  const defaultRooms = [
    ['General', 'General discussion for everyone'],
    ['Tech Talk', 'Programming, frameworks, and tech news'],
    ['Random', 'Off-topic conversations and fun stuff'],
  ];

  for (const [name, description] of defaultRooms) {
    await pool.query(
      'INSERT IGNORE INTO rooms (name, description) VALUES (?, ?)',
      [name, description]
    );
  }

  console.log('Database initialized');
}

export function getRandomColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

export default pool;
