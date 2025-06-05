const socket = io();

const form = document.getElementById('form');
const input = document.getElementById('input');
const usernameInput = document.getElementById('username');
const imageInput = document.getElementById('imageInput');
const messages = document.getElementById('messages');

let currentUsername = '';

// Recibir nombre de usuario por defecto
socket.on('set username', (username) => {
  currentUsername = username;
  usernameInput.placeholder = `Tu nombre... (${username})`;
});

// Detectar cambio de nombre
usernameInput.addEventListener('change', () => {
  const newUsername = usernameInput.value.trim();
  if (newUsername) {
    socket.emit('change username', newUsername);
    currentUsername = newUsername;
  }
});

form.addEventListener('submit', function (e) {
  e.preventDefault();

  // Enviar texto
  if (input.value.trim()) {
    socket.emit('chat message', { type: 'text', content: input.value.trim() });
    input.value = '';
  }

  // Enviar imagen
  const file = imageInput.files[0];
  if (file && file.type.startsWith('image/')) {
    if (file.size > 2 * 1024 * 1024) {
      alert('La imagen es demasiado grande (máx. 2MB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = function () {
      socket.emit('chat message', { type: 'image', content: reader.result });
    };
    reader.readAsDataURL(file);
    imageInput.value = '';
  }
});

// Mostrar mensajes
socket.on('chat message', function (msg) {
  const item = document.createElement('li');

  const usernameSpan = document.createElement('strong');
  usernameSpan.textContent = msg.username + ': ';
  item.appendChild(usernameSpan);

  if (msg.type === 'text') {
    item.appendChild(document.createTextNode(msg.content));
  } else if (msg.type === 'image') {
    const img = document.createElement('img');
    img.src = msg.content;
    img.style.maxWidth = '200px';
    img.style.borderRadius = '8px';
    img.style.display = 'block';
    img.style.marginTop = '5px';
    item.appendChild(img);
  }

  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
});
