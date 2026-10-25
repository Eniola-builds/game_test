const socket = io();

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const gameScreen = document.getElementById('game-screen');
const usernameInput = document.getElementById('username-input');
const joinBtn = document.getElementById('join-btn');

const playerCount = document.getElementById('player-count');
const playersList = document.getElementById('players-list');
const timerDisplay = document.getElementById('timer');
const questionDisplay = document.getElementById('question-display');

const masterControls = document.getElementById('master-controls');
const qmQuestion = document.getElementById('qm-question');
const qmAnswer = document.getElementById('qm-answer');
const setQBtn = document.getElementById('set-q-btn');
const startGameBtn = document.getElementById('start-game-btn');

const chatMessages = document.getElementById('chat-messages');
const guessInput = document.getElementById('guess-input');
const sendBtn = document.getElementById('send-btn');

let myUsername = '';

// 1. Join Game Button Click
joinBtn.addEventListener('click', () => {
  const username = usernameInput.value.trim();
  if (!username) {
    alert('Please enter a username!');
    return;
  }
  myUsername = username;
  
  // Send username to backend
  socket.emit('join_game', username);

  // Switch screens: Hide login, show game
  loginScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');
});

// 2. Update Players List & Roles (Received from server)
socket.on('update_players', (players) => {
  playersList.innerHTML = '';
  players.forEach(player => {
    const li = document.createElement('li');
    li.textContent = `${player.username} - Score: ${player.score} ${player.isMaster ? '👑 (Master)' : ''}`;
    playersList.appendChild(li);

    // If I am the master, show master controls; otherwise hide them
    if (player.id === socket.id && player.isMaster) {
      if (masterControls) masterControls.classList.remove('hidden');
    } else if (player.id === socket.id && !player.isMaster) {
      if (masterControls) masterControls.classList.add('hidden');
    }
  });
});

// 3. Game Master Sets Question
if (setQBtn) {
  setQBtn.addEventListener('click', () => {
    const question = qmQuestion.value.trim();
    const answer = qmAnswer.value.trim();
    if (!question || !answer) {
      alert('Please fill in both question and answer!');
      return;
    }
    socket.emit('set_question', { question, answer });
  });
}

// 4. Game Master Starts Game
if (startGameBtn) {
  startGameBtn.addEventListener('click', () => {
    socket.emit('start_game');
  });
}

// 5. Game Started Event
socket.on('game_started', ({ question, timer }) => {
  questionDisplay.textContent = `Current Riddle: ${question}`;
  timerDisplay.textContent = `Time left: ${timer}s`;
});

// 6. Timer Countdown Update
socket.on('timer_update', (timer) => {
  timerDisplay.textContent = `Time left: ${timer}s`;
});

// 7. Send Guess / Chat Message
sendBtn.addEventListener('click', () => {
  const text = guessInput.value.trim();
  if (!text) return;
  
  // Treat input as a guess/chat submission
  socket.emit('submit_guess', text);
  guessInput.value = '';
});

// Allow pressing 'Enter' to send guess
guessInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendBtn.click();
  }
});

// 8. Receive Chat Messages / System Feedback
socket.on('chat_message', (msg) => {
  const div = document.createElement('div');
  div.textContent = `${msg.sender}: ${msg.text}`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight; // Auto scroll to bottom
});

socket.on('system_feedback', (text) => {
  const div = document.createElement('div');
  div.style.color = 'orange';
  div.textContent = text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

// 9. Error Handler from Server
socket.on('error_message', (err) => {
  alert(err);
});

// 10. Round Ended Event
socket.on('game_ended', ({ answer, reason }) => {
  const div = document.createElement('div');
  div.style.color = 'red';
  div.textContent = `Round Over! Answer was: "${answer}". Reason: ${reason}`;
  chatMessages.appendChild(div);
  questionDisplay.textContent = 'Waiting for next riddle...';
});