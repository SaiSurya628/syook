const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const sqlite3 = require('sqlite3');
const cors=require("cors")
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
app.use(cors());

const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3001", // Replace with the URL of your React frontend
    methods: ["GET", "POST"],
  },
});


const dbPath = path.join(__dirname, 'timeseries.db');

// Connect to SQLite
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('SQLite connection error:', err.message);
  } else {
    console.log('Connected to SQLite database');
  }
});

io.on('connection', (socket) => {
  console.log('Emitter connected to Listener.');

  socket.on('messageStream', (encryptedMessageStream) => {
    const messages = encryptedMessageStream.split('|');

    for (const message of messages) {
      try {
        // Decrypt the message
        const secretKey = "ae6b300a79a81b6d675c4a6cef2a639e743e5b81af21d3f4532cc4174eff1bc3";
        const decipher = crypto.createDecipheriv('aes-256-ctr', Buffer.from(secretKey, 'hex'), Buffer.alloc(16));
        let decryptedMessage = decipher.update(message, 'hex', 'utf8');
        decryptedMessage += decipher.final('utf8');

        // Validate the secret_key
        const messageObj = JSON.parse(decryptedMessage);
        const computedKey = crypto
          .createHash('sha256')
          .update(JSON.stringify(messageObj))
          .digest('hex');

        if (computedKey === messageObj.secret_key) {
          // Valid message, add timestamp and save to SQLite database
          const timestamp = new Date().toISOString();
          db.run(
            'INSERT INTO messages (name, origin, destination, secret_key, timestamp) VALUES (?, ?, ?, ?, ?)',
            [messageObj.name, messageObj.origin, messageObj.destination, messageObj.secret_key, timestamp],
            (err) => {
              if (err) {
                console.error('Error inserting message:', err.message);
              }
            }
          );
        } else {
          console.error('Invalid message integrity. Discarding.');
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('Emitter disconnected from Listener.');
  });
});

server.listen(4000, () => {
  console.log('Listener service is running on port 4000');
});

