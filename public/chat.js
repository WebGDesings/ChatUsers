const socket = io();

// Prevenir zoom en inputs en dispositivos móviles
document.addEventListener('DOMContentLoaded', () => {
  const inputs = document.querySelectorAll('input, textarea, [contenteditable]');
  
  inputs.forEach(input => {
    // Prevenir zoom en focus
    input.addEventListener('focus', () => {
      document.documentElement.style.setProperty('--viewport-scale', '1.0');
      document.querySelector('meta[name="viewport"]').content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    });
    
    // Restaurar configuración al perder el foco
    input.addEventListener('blur', () => {
      document.querySelector('meta[name="viewport"]').content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
    });
    
    // Mejorar la experiencia táctil en botones
    input.addEventListener('touchstart', (e) => {
      e.currentTarget.style.transform = 'scale(0.98)';
    }, { passive: true });
    
    input.addEventListener('touchend', (e) => {
      e.currentTarget.style.transform = '';
    }, { passive: true });
  });
  
  // Detectar si es un dispositivo táctil
  if ('ontouchstart' in window || navigator.maxTouchPoints) {
    document.body.classList.add('touch-device');
  }
});

// Tema
const themeToggle = document.getElementById('themeToggle');
const themeIcon = themeToggle.querySelector('i');

// Cargar tema guardado o usar preferencia del sistema
const savedTheme = localStorage.getItem('theme') || 
  (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

// Aplicar tema al cargar
if (savedTheme === 'dark') {
  document.body.classList.add('dark-mode');
  themeIcon.classList.replace('fa-moon', 'fa-sun');
}

// Alternar tema
themeToggle.addEventListener('click', () => {
  const isDark = document.body.classList.toggle('dark-mode');
  
  if (isDark) {
    themeIcon.classList.replace('fa-moon', 'fa-sun');
    localStorage.setItem('theme', 'dark');
  } else {
    themeIcon.classList.replace('fa-sun', 'fa-moon');
    localStorage.setItem('theme', 'light');
  }
});

// Elementos del DOM
const form = document.getElementById('form');
const input = document.getElementById('input');
const usernameInput = document.getElementById('username');
const imageInput = document.getElementById('imageInput');
const fileInput = document.getElementById('fileInput');
const messages = document.getElementById('messages');
const recordButton = document.getElementById('recordButton');
const stopRecordingButton = document.getElementById('stopRecording');
const recordingIndicator = document.getElementById('recordingIndicator');
const recordingTimeElement = document.getElementById('recordingTime');
const audioPlayer = document.getElementById('audioPlayer');

let currentUsername = '';
let mediaRecorder;
let audioChunks = [];
let recordingStartTime;
let recordingTimer;
let audioContext;
let audioAnalyser;
let audioSource;
let isPlaying = false;
let currentAudioElement = null;

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

// Inicializar grabación de audio
recordButton.addEventListener('click', startRecording);
stopRecordingButton.addEventListener('click', stopRecording);

// Función para formatear el tiempo
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// Actualizar el temporizador de grabación
function updateRecordingTimer() {
  const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
  recordingTimeElement.textContent = formatTime(elapsed);
}

// Iniciar grabación de voz
async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Convertir a base64 para enviar al servidor
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = function() {
        const base64Audio = reader.result.split(',')[1];
        socket.emit('chat message', { 
          type: 'audio', 
          content: base64Audio,
          username: currentUsername || 'Anónimo',
          timestamp: Date.now()
        });
      };
      
      // Detener todas las pistas de audio
      stream.getTracks().forEach(track => track.stop());
    };

    // Iniciar la grabación
    mediaRecorder.start();
    recordingStartTime = Date.now();
    recordingTimer = setInterval(updateRecordingTimer, 1000);
    recordingIndicator.classList.add('active');
    recordButton.style.display = 'none';
    
  } catch (error) {
    console.error('Error al acceder al micrófono:', error);
    Swal.fire({
      title: 'Error',
      text: 'Asegurese que tenga conectado un dispositivo de audio.',
      icon: 'error',
      confirmButtonColor: '#d33',
      confirmButtonText: 'Okey',
    });
  }
}

// Detener grabación de voz
function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    clearInterval(recordingTimer);
    recordingIndicator.classList.remove('active');
    recordButton.style.display = 'flex';
  }
}

// Reproducir mensaje de audio
function playAudio(audioData, progressBar, durationElement, playButton) {
  if (isPlaying) {
    audioPlayer.pause();
    isPlaying = false;
    playButton.innerHTML = '<i class="fas fa-play"></i>';
    return;
  }

  // Si hay un audio reproduciéndose, lo detenemos
  if (currentAudioElement) {
    currentAudioElement.pause();
    currentAudioElement.currentTime = 0;
    const currentPlayButton = document.querySelector('.audio-message.playing .play-button');
    if (currentPlayButton) {
      currentPlayButton.innerHTML = '<i class="fas fa-play"></i>';
      currentPlayButton.closest('.audio-message').classList.remove('playing');
    }
  }

  // Configurar el reproductor de audio
  audioPlayer.src = `data:audio/wav;base64,${audioData}`;
  audioPlayer.currentTime = 0;
  
  // Actualizar la interfaz
  playButton.innerHTML = '<i class="fas fa-pause"></i>';
  playButton.closest('.audio-message').classList.add('playing');
  currentAudioElement = audioPlayer;
  
  // Reproducir
  audioPlayer.play();
  isPlaying = true;
  
  // Actualizar la barra de progreso
  audioPlayer.ontimeupdate = () => {
    const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    progressBar.style.width = `${progress}%`;
    durationElement.textContent = formatTime(audioPlayer.duration - audioPlayer.currentTime);
  };
  
  // Cuando termine la reproducción
  audioPlayer.onended = () => {
    isPlaying = false;
    playButton.innerHTML = '<i class="fas fa-play"></i>';
    progressBar.style.width = '0%';
    playButton.closest('.audio-message').classList.remove('playing');
    durationElement.textContent = formatTime(audioPlayer.duration);
  };
  
  // Manejar errores
  audioPlayer.onerror = () => {
    console.error('Error al reproducir el audio');
    isPlaying = false;
    playButton.innerHTML = '<i class="fas fa-play"></i>';
    playButton.closest('.audio-message').classList.remove('playing');
  };
}

form.addEventListener('submit', function (e) {
  e.preventDefault();

  // Enviar texto
  if (input.value.trim()) {
    socket.emit('chat message', { type: 'text', content: input.value.trim() });
    input.value = '';
  }

  // Enviar imagen
  const imageFile = imageInput.files[0];
  if (imageFile && imageFile.type.startsWith('image/')) {
    if (imageFile.size > 50 * 1024 * 1024) {
      Swal.fire({
        title: '¡Alerta!',
        text: 'La imagen supera el límite de 50 MB.',
        icon: 'warning',
        confirmButtonColor: '#d33',
        confirmButtonText: 'Okey',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = function () {
      socket.emit('chat message', {
        type: 'image',
        name: imageFile.name,
        content: reader.result,
      });
    };
    reader.readAsDataURL(imageFile);
    imageInput.value = '';
  }

  // Enviar archivo (documentos, videos, HTML, PDF, etc., pero NO ejecutables)
  const file = fileInput.files[0];
  if (file) {
    const fileName = file.name.toLowerCase();
    const blockedExtensions = ['.exe', '.apk', '.msi', '.bat', '.sh', '.cmd', '.scr', '.cpp'];

    const isBlocked = blockedExtensions.some(ext => fileName.endsWith(ext));
    if (isBlocked) {
      Swal.fire({
        title: 'Archivo no permitido',
        text: 'Este tipo de archivo está bloqueado por seguridad.',
        icon: 'error',
        confirmButtonColor: '#d33',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      Swal.fire({
        title: '¡Alerta!',
        text: 'El archivo supera el límite de 50 MB.',
        icon: 'warning',
        confirmButtonColor: '#d33',
        confirmButtonText: 'Okey',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = function () {
      socket.emit('chat message', {
        type: 'file',
        name: file.name,
        content: reader.result,
      });
    };
    reader.readAsDataURL(file);
    fileInput.value = '';
  }
});

// Función para formatear la hora
function formatTime(date) {
  return date.toLocaleTimeString('es-ES', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });
}

// Mostrar mensajes
socket.on('chat message', function (msg) {
  const messageElement = document.createElement('li');
  const isCurrentUser = msg.username === currentUsername;
  messageElement.className = `message ${isCurrentUser ? 'self' : 'other'}`;
  
  const messageContent = document.createElement('div');
  messageContent.className = 'message-content';
  
  // Solo mostrar el nombre de usuario si no es el mensaje del usuario actual
  if (!isCurrentUser) {
    const usernameSpan = document.createElement('span');
    usernameSpan.className = 'message-username';
    usernameSpan.textContent = msg.username;
    messageContent.appendChild(usernameSpan);
  }
  
  // Contenido del mensaje según el tipo
  switch (msg.type) {
    case 'text':
      const textContent = document.createElement('span');
      textContent.textContent = msg.content;
      messageContent.appendChild(textContent);
      break;
      
    case 'image':
      const imgContainer = document.createElement('div');
      imgContainer.className = 'image-container';
      const img = document.createElement('img');
      img.src = msg.content;
      img.alt = 'Imagen enviada';
      img.loading = 'lazy';
      imgContainer.appendChild(img);
      messageContent.appendChild(imgContainer);
      break;

      case 'file':
        const fileContainer = document.createElement('div');
        fileContainer.className = 'file-container';

        const fileName = document.createElement('p');
        fileName.textContent = `📎 ${msg.name || 'Archivo adjunto'}`;
        fileName.className = 'file-name';

        const downloadLink = document.createElement('a');
        downloadLink.href = msg.content;
        downloadLink.download = msg.name || 'archivo';
        downloadLink.textContent = 'Descargar archivo';
        downloadLink.className = 'file-download';
        downloadLink.target = '_blank'; // Opcional: abre en nueva pestaña si es navegable

        fileContainer.appendChild(fileName);
        fileContainer.appendChild(downloadLink);
        messageContent.appendChild(fileContainer);
        break;
        
    case 'audio':
      const audioContainer = document.createElement('div');
      audioContainer.className = 'audio-message';
      
      const playButton = document.createElement('button');
      playButton.className = 'play-button';
      playButton.innerHTML = '<i class="fas fa-play"></i>';
      
      const progressContainer = document.createElement('div');
      progressContainer.className = 'progress-container';
      
      const progressBar = document.createElement('div');
      progressBar.className = 'progress-bar';
      
      const progress = document.createElement('div');
      progress.className = 'progress';
      progressBar.appendChild(progress);
      
      const duration = document.createElement('span');
      duration.className = 'duration';
      duration.textContent = '0:00';
      
      progressContainer.appendChild(progressBar);
      progressContainer.appendChild(duration);
      
      audioContainer.appendChild(playButton);
      audioContainer.appendChild(progressContainer);
      
      // Configurar evento de reproducción
      playButton.addEventListener('click', (e) => {
        e.stopPropagation();
        playAudio(msg.content, progress, duration, playButton);
      });
      
      // Calcular duración del audio
      const audio = new Audio(`data:audio/wav;base64,${msg.content}`);
      audio.onloadedmetadata = () => {
        duration.textContent = formatTime(audio.duration);
      };
      
      messageContent.appendChild(audioContainer);
      break;
  }
  
  // Añadir la hora del mensaje
  const timeElement = document.createElement('span');
  timeElement.className = 'message-time';
  const messageTime = msg.timestamp ? new Date(msg.timestamp) : new Date();
  timeElement.textContent = messageTime.toLocaleTimeString('es-ES', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });
  
  messageElement.appendChild(messageContent);
  messageElement.appendChild(timeElement);
  
  messages.appendChild(messageElement);
  
  // Desplazamiento suave al último mensaje
  messages.scrollTo({
    top: messages.scrollHeight,
    behavior: 'smooth'
  });
});
