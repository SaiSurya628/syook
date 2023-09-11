const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const crypto = require('crypto');
const sqlite3 = require('sqlite3');
const path = require('path'); // Import path module
const data = require('./data.json');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const secretKey = "ae6b300a79a81b6d675c4a6cef2a639e743e5b81af21d3f4532cc4174eff1bc3";

console.log('Emitter Secret Key:', secretKey);

const dbPath = path.join(__dirname, 'timeseries.db');

// Connect to SQLite database 
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('SQLite connection error:', err.message);
  } else {
    console.log('Connected to SQLite database');
    // Create a table if it doesn't exist
    db.run(
      'CREATE TABLE IF NOT EXISTS messages (name TEXT, origin TEXT, destination TEXT, secret_key TEXT, timestamp DATETIME)'
    );
  }
});

function generateEncryptedMessage() {
  const message = {
    name: getRandomElement(data.names),
    origin: getRandomElement(data.cities),
    destination: getRandomElement(data.cities),
  };

  const secret_key = crypto.createHash('sha256').update(JSON.stringify(message)).digest('hex');

  const cipher = crypto.createCipheriv('aes-256-ctr', Buffer.from(secretKey, 'hex'), Buffer.alloc(16));
  let encryptedMessage = cipher.update(JSON.stringify(message), 'utf8', 'hex');
  encryptedMessage += cipher.final('hex');

  return encryptedMessage;
}

function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

io.on('connection', (socket) => {
  console.log('Emitter connected to Listener.');

  setInterval(() => {
    const messageStream = Array.from({ length: Math.floor(Math.random() * 451) + 49 }, () =>
      generateEncryptedMessage()
    ).join('|');

    console.log('Sending Message Stream:', messageStream);
    socket.emit('messageStream', messageStream);

    // Insert the message into SQLite database with a timestamp
    const timestamp = new Date().toISOString();
    const stmt = db.prepare(
      'INSERT INTO messages (name, origin, destination, secret_key, timestamp) VALUES (?, ?, ?, ?, ?)'
    );

    for (let i = 0; i < 100; i++) {
      const message = generateEncryptedMessage();
      stmt.run(
        getRandomElement(data.names),
        getRandomElement(data.cities),
        getRandomElement(data.cities),
        crypto.createHash('sha256').update(message).digest('hex'),
        timestamp
      );
    }

    stmt.finalize();
  }, 10000); // Send a new message stream every 10 seconds

  socket.on('disconnect', () => {
    console.log('Emitter disconnected from Listener.');
  });
});

server.listen(3000, () => {
  console.log('Emitter service is running on port 3000');
});
