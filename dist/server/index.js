"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const short_uuid_1 = __importDefault(require("short-uuid"));
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:9002';
const io = new socket_io_1.Server(server, {
    cors: {
        origin: frontendUrl,
        methods: ['GET', 'POST'],
    },
});
app.use((0, cors_1.default)({ origin: frontendUrl }));
app.use(express_1.default.json());
const games = {};
const leaderboardPath = path_1.default.join(__dirname, 'leaderboard.json');
async function getLeaderboard() {
    try {
        const data = await promises_1.default.readFile(leaderboardPath, 'utf-8');
        return JSON.parse(data);
    }
    catch (error) {
        // If file doesn't exist, return empty array
        return [];
    }
}
async function saveLeaderboard(leaderboard) {
    await promises_1.default.writeFile(leaderboardPath, JSON.stringify(leaderboard, null, 2));
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
io.on('connection', (socket) => {
    console.log('a user connected:', socket.id);
    socket.on('createGame', () => {
        const gameId = short_uuid_1.default.generate();
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
        }
        else {
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
