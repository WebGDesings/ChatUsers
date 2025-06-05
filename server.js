const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));

let userCount = 1;

io.on('connection', (socket) => {
  const defaultUsername = `user${userCount++}`;
  socket.username = defaultUsername;

  // Enviar el nombre por defecto al cliente
  socket.emit('set username', socket.username);

  socket.on('chat message', (msg) => {
    io.emit('chat message', {
      username: socket.username,
      ...msg
    });
  });

  socket.on('change username', (newUsername) => {
    socket.username = newUsername || socket.username;
  });

  socket.on('disconnect', () => {
    console.log(`${socket.username} se ha desconectado`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
