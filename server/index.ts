import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs/promises';

interface LeaderboardEntry {
  name: string;
  score: number;
  date: string;
}

const app = express();
const server = http.createServer(app);

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:9002';

const io = new Server(server, {
  cors: {
    origin: frontendUrl,
    methods: ['GET', 'POST'],
  },
});

app.use(cors({ origin: frontendUrl }));
app.use(express.json());

const games: Record<string, any> = {};
const leaderboardPath = path.join(__dirname, 'leaderboard.json');

async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const data = await fs.readFile(leaderboardPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist, return empty array
    return [];
  }
}

async function saveLeaderboard(leaderboard: LeaderboardEntry[]): Promise<void> {
  await fs.writeFile(leaderboardPath, JSON.stringify(leaderboard, null, 2));
}

app.get('/api/leaderboard', async (req, res) => {
  const leaderboard = await getLeaderboard();
  res.json(leaderboard);
});

app.post('/api/leaderboard', async (req, res) => {
  const { name, score } = req.body;
  if (typeof name !== 'string' || typeof score !== 'number') {
    return res.status(400).json({ message: 'Invalid name or score' });
  }

  const leaderboard = await getLeaderboard();
  leaderboard.push({ name, score, date: new Date().toISOString() });
  leaderboard.sort((a, b) => b.score - a.score);
  const top10 = leaderboard.slice(0, 10);
  await saveLeaderboard(top10);

  res.status(201).json(top10);
});

function generateGameId(): string {
  let id;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  do {
    id = '';
    for (let i = 0; i < 6; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (games[id]); // Ensure unique ID
  return id;
}


io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);

  socket.on('createGame', () => {
    const gameId = generateGameId();
    games[gameId] = {
      id: gameId,
      players: [socket.id],
      state: 'waiting',
    };
    socket.join(gameId);
    socket.emit('gameCreated', gameId);
    console.log(`Game ${gameId} created by ${socket.id}`);
  });

  socket.on('joinGame', (gameId) => {
    const game = games[gameId];
    if (game && game.players.length === 1) {
      game.players.push(socket.id);
      socket.join(gameId);
      game.state = 'playing';

      // Player 1 is host (index 0)
      io.to(game.players[0]).emit('gameStarted', { isHost: true, gameId });
      // Player 2 is guest (index 1)
      io.to(game.players[1]).emit('gameStarted', { isHost: false, gameId });
      
      console.log(`${socket.id} joined game ${gameId}. Starting game.`);
    } else {
      socket.emit('joinError', 'Game not found or is full.');
      console.log(`Join error for ${socket.id} on game ${gameId}`);
    }
  });

  socket.on('paddleMove', ({ gameId, position }) => {
    socket.to(gameId).emit('opponentMoved', position);
  });
  
  socket.on('ballSync', ({ gameId, ballState }) => {
    socket.to(gameId).emit('ballSynced', ballState);
  });

  socket.on('scoreUpdate', ({ gameId, score }) => {
    io.in(gameId).emit('scoreUpdated', score);
  });

  socket.on('pause', ({ gameId }) => {
    socket.to(gameId).emit('opponentPaused');
  });

  socket.on('resume', ({ gameId }) => {
    socket.to(gameId).emit('opponentResumed');
  });
  
  socket.on('gameOver', ({ gameId, winnerId }) => {
    const game = games[gameId];
    if (game) {
      io.in(gameId).emit('gameOver', { winnerId });
      delete games[gameId];
      console.log(`Game ${gameId} over. Winner: ${winnerId}`);
    }
  });


  socket.on('disconnect', () => {
    console.log('user disconnected:', socket.id);
    for (const gameId in games) {
      const game = games[gameId];
      const playerIndex = game.players.indexOf(socket.id);
      if (playerIndex !== -1) {
        // Notify other player
        socket.to(gameId).emit('opponentDisconnected');
        // Clean up game
        delete games[gameId];
        console.log(`Game ${gameId} closed due to disconnect.`);
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
