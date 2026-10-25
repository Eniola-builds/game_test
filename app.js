const express = require("express")
const http = require('http')
const PORT = 5000
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the 'public' folder
app.use(express.static('public'));

// Game State Variables
let players = []; // Stores connected players: { id, username, score, isMaster }
let currentMasterIndex = 0;
let activeRiddle = { question: '', answer: '' };
let gameActive = false;
let timer = 60;
let timerInterval = null;
let playerGuesses = {}; // Tracks guess counts per player for the current round

io.on('connection', (socket) => {
  console.log(`A user connected: ${socket.id}`);

  // 1. User Joins the Game
  socket.on('join_game', (username) => {
    if (!username.trim()) return;

    // First player to join automatically becomes the Game Master
    const isFirstPlayer = players.length === 0;

    const newPlayer = {
      id: socket.id,
      username: username.trim(),
      score: 0,
      isMaster: isFirstPlayer
    };

    players.push(newPlayer);
    updatePlayerList();

    io.emit('chat_message', { sender: 'System', text: `${newPlayer.username} joined the game!` });
  });

  // 2. Game Master Sets the Riddle & Answer
  socket.on('set_question', ({ question, answer }) => {
    const player = players.find(p => p.id === socket.id);
    if (!player || !player.isMaster) {
      return socket.emit('error_message', 'Only the Game Master can set a riddle!');
    }

    if (!question || !answer) {
      return socket.emit('error_message', 'Both question and answer are required!');
    }

    activeRiddle = { question: question.trim(), answer: answer.trim().toLowerCase() };
    socket.emit('question_set_success', 'Riddle locked in! Click Start Game when ready.');
  });

  // 3. Game Master Starts the Timer & Round
  socket.on('start_game', () => {
    const player = players.find(p => p.id === socket.id);
    if (!player || !player.isMaster) return;

    if (!activeRiddle.question) {
      return socket.emit('error_message', 'Please set a riddle first!');
    }

    if (gameActive) return;

    gameActive = true;
    timer = 60;
    playerGuesses = {}; // Reset guess counts for the new round

    io.emit('game_started', { question: activeRiddle.question, timer });
    io.emit('chat_message', { sender: 'System', text: '🎮 Round started! Type your guesses in the chat.' });

    // Start 60-second countdown ticker
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      timer--;
      io.emit('timer_update', timer);

      if (timer <= 0) {
        clearInterval(timerInterval);
        endRound(`Time is up! No one guessed the answer.`);
      }
    }, 1000);
  });

  // 4. Players Submit Guesses (3-guess limit)
  socket.on('submit_guess', (guessText) => {
    const player = players.find(p => p.id === socket.id);
    if (!player) return;

    // Game Master cannot guess their own riddle
    if (player.isMaster) {
      return socket.emit('error_message', 'The Game Master cannot guess!');
    }

    if (!gameActive) {
      return socket.emit('error_message', 'The game has not started yet!');
    }

    // Initialize guess counter for player if not tracked yet
    if (!playerGuesses[socket.id]) {
      playerGuesses[socket.id] = 0;
    }

    if (playerGuesses[socket.id] >= 3) {
      return socket.emit('error_message', 'You have reached your 3-guess limit for this round!');
    }

    playerGuesses[socket.id]++;
    const remainingAttempts = 3 - playerGuesses[socket.id];

    // Broadcast the player's guess to everyone
    io.emit('chat_message', { sender: player.username, text: guessText });

    // Check if guess is correct
    if (guessText.trim().toLowerCase() === activeRiddle.answer) {
      clearInterval(timerInterval);
      player.score += 10; // Award points for winning
      endRound(`${player.username} guessed the correct answer! (+10 pts)`);
    } else {
      socket.emit('system_feedback', `❌ Incorrect! You have ${remainingAttempts} attempts remaining.`);
    }
  });

  // 5. Handle Disconnections
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    const index = players.findIndex(p => p.id === socket.id);

    if (index !== -1) {
      const removedPlayer = players.splice(index, 1)[0];
      io.emit('chat_message', { sender: 'System', text: `${removedPlayer.username} left the game.` });

      // If the disconnecting player was the Master, rotate master role to someone else
      if (removedPlayer.isMaster && players.length > 0) {
        currentMasterIndex = currentMasterIndex % players.length;
        players[currentMasterIndex].isMaster = true;
        io.emit('chat_message', { sender: 'System', text: `👑 ${players[currentMasterIndex].username} is now the Game Master!` });
      }

      updatePlayerList();
    }
  });
});

// Helper: End current round and rotate Game Master
function endRound(reason) {
  gameActive = false;
  clearInterval(timerInterval);

  io.emit('game_ended', { answer: activeRiddle.answer, reason });

  // Rotate Game Master role to the next player in the list
  if (players.length > 0) {
    players[currentMasterIndex].isMaster = false;
    currentMasterIndex = (currentMasterIndex + 1) % players.length;
    players[currentMasterIndex].isMaster = true;
  }

  activeRiddle = { question: '', answer: '' };
  updatePlayerList();
}

// Helper: Broadcast updated player list and scores to all clients
function updatePlayerList() {
  io.emit('update_players', players);
}

// Start the server on port 3000
server.listen(PORT, () => {
  console.log(`Server is running live at http://localhost:${PORT}`);
});