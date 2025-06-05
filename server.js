const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// App setup
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Socket.IO logic
io.on('connection', (socket) => {
  console.log('Nuevo usuario conectado');

  socket.on('chat message', (msg) => {
    // Envía el mensaje a todos los clientes conectados
    io.emit('chat message', msg);
  });

  socket.on('disconnect', () => {
    console.log('Usuario desconectado');
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});