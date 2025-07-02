
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs/promises';

interface LeaderboardEntry {
  name: string;
  wins: number;
  playerId: string;
}

interface Player {
    socketId: string;
    name: string;
    playerId: string;
}

interface Game {
    id: string;
    players: Player[];
    state: 'waiting' | 'playing';
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

const games: Record<string, Game> = {};
const leaderboardPath = path.join(__dirname, 'leaderboard.json');

async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const data = await fs.readFile(leaderboardPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
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

function generateGameId(): string {
  let id;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  do {
    id = '';
    for (let i = 0; i < 6; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (games[id]);
  return id;
}


io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);

  socket.on('createGame', ({ playerName, playerId }) => {
    const gameId = generateGameId();
    games[gameId] = {
      id: gameId,
      players: [{ socketId: socket.id, name: playerName, playerId }],
      state: 'waiting',
    };
    socket.join(gameId);
    socket.emit('gameCreated', gameId);
    console.log(`Game ${gameId} created by ${playerName} (${socket.id})`);
  });

  socket.on('joinGame', ({ gameId, playerName, playerId }) => {
    const game = games[gameId];
    if (game && game.players.length === 1) {
      game.players.push({ socketId: socket.id, name: playerName, playerId });
      socket.join(gameId);
      game.state = 'playing';

      const hostPlayer = game.players[0];
      const guestPlayer = game.players[1];

      // Player 1 is host
      io.to(hostPlayer.socketId).emit('gameStarted', { isHost: true, gameId, playerName: hostPlayer.name, opponentName: guestPlayer.name });
      // Player 2 is guest
      io.to(guestPlayer.socketId).emit('gameStarted', { isHost: false, gameId, playerName: guestPlayer.name, opponentName: hostPlayer.name });
      
      console.log(`${playerName} (${socket.id}) joined game ${gameId}. Starting game.`);
    } else {
      socket.emit('joinError', 'Game not found or is full.');
      console.log(`Join error for ${playerName} (${socket.id}) on game ${gameId}`);
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
  
  socket.on('gameOver', async ({ gameId, winnerId }) => {
    const game = games[gameId];
    if (game) {
      io.in(gameId).emit('gameOver', { winnerId });

      const winner = game.players.find(p => p.socketId === winnerId);
      if (winner) {
          try {
              const leaderboard = await getLeaderboard();
              const playerIndex = leaderboard.findIndex(entry => entry.playerId === winner.playerId);

              if (playerIndex > -1) {
                  leaderboard[playerIndex].wins += 1;
              } else {
                  leaderboard.push({ name: winner.name, playerId: winner.playerId, wins: 1 });
              }

              leaderboard.sort((a, b) => b.wins - a.wins);
              const top10 = leaderboard.slice(0, 10);
              await saveLeaderboard(top10);
              
              io.emit('leaderboardUpdated', top10);
          } catch (error) {
              console.error("Failed to update leaderboard:", error);
          }
      }

      delete games[gameId];
      console.log(`Game ${gameId} over. Winner: ${winner ? winner.name : 'Unknown'}`);
    }
  });


  socket.on('disconnect', () => {
    console.log('user disconnected:', socket.id);
    for (const gameId in games) {
      const game = games[gameId];
      const playerIndex = game.players.findIndex(p => p.socketId === socket.id);
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
