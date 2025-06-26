
'use client';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc, onSnapshot, updateDoc, Unsubscribe, serverTimestamp, writeBatch } from 'firebase/firestore';

export interface Player {
  id: string;
}

export interface Paddle {
  x: number;
}

export interface Ball {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

export type GameState = 'waiting' | 'playing' | 'paused' | 'gameOver';

export interface Score {
  [key: string]: number;
  player1: number;
  player2: number;
}

export interface GameData {
  id: string;
  state: GameState;
  players: {
    player1: Player;
    player2?: Player;
  };
  paddles: {
    player1: Paddle;
    player2: Paddle;
  };
  ball: Ball;
  score: Score;
  createdAt: any;
  updatedAt: any;
}

const GAMES_COLLECTION = 'games';

/**
 * Creates a new multiplayer game in Firestore.
 * @param {string} playerId - The ID of the player creating the game (host).
 * @returns {Promise<string>} The ID of the newly created game.
 */
export async function createGame(playerId: string): Promise<string> {
  const gameId = Math.random().toString(36).substring(2, 8).toUpperCase();
  const gameRef = doc(db, GAMES_COLLECTION, gameId);

  const newGame: GameData = {
    id: gameId,
    state: 'waiting',
    players: {
      player1: { id: playerId },
    },
    paddles: {
      player1: { x: 0 },
      player2: { x: 0 },
    },
    ball: { x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: 0 },
    score: { player1: 0, player2: 0 },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(gameRef, newGame);
  return gameId;
}

/**
 * Allows a player to join an existing multiplayer game.
 * @param {string} gameId - The ID of the game to join.
 * @param {string} playerId - The ID of the player joining.
 * @throws {Error} If the game is not found or is full.
 */
export async function joinGame(gameId: string, playerId: string): Promise<void> {
  const gameRef = doc(db, GAMES_COLLECTION, gameId);
  const gameSnap = await getDoc(gameRef);

  if (!gameSnap.exists()) {
    throw new Error('Game not found.');
  }

  const gameData = gameSnap.data() as GameData;

  const isPlayer1 = gameData.players.player1.id === playerId;
  const isPlayer2 = gameData.players.player2?.id === playerId;
  
  if(isPlayer1 || isPlayer2) {
    // Player is already in the game, allow rejoin.
    return;
  }
  
  if (gameData.players.player2) {
    throw new Error('This game is full.');
  }

  await updateDoc(gameRef, {
    'players.player2': { id: playerId },
    updatedAt: serverTimestamp(),
  });
}

/**
 * Listens for real-time updates to a game document.
 * @param {string} gameId - The ID of the game to listen to.
 * @param {(data: GameData) => void} callback - The function to call with updated game data.
 * @returns {Unsubscribe} A function to stop listening for updates.
 */
export function onGameUpdate(gameId: string, callback: (data: GameData) => void): Unsubscribe {
  const gameRef = doc(db, GAMES_COLLECTION, gameId);
  return onSnapshot(gameRef, (doc) => {
    if (doc.exists()) {
      callback(doc.data() as GameData);
    }
  });
}

/**
 * Updates a player's paddle position in Firestore.
 * @param {string} gameId - The game ID.
 * @param {'player1' | 'player2'} playerKey - The key for the player ('player1' or 'player2').
 * @param {Paddle} paddleData - The new paddle data.
 */
export async function updatePlayerPaddle(gameId: string, playerKey: 'player1' | 'player2', paddleData: Paddle): Promise<void> {
  const gameRef = doc(db, GAMES_COLLECTION, gameId);
  await updateDoc(gameRef, {
    [`paddles.${playerKey}`]: paddleData,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Updates the ball's state in Firestore. (Host only)
 * @param {string} gameId - The game ID.
 * @param {Ball} ballData - The new ball state.
 */
export async function updateBall(gameId: string, ballData: Ball): Promise<void> {
  const gameRef = doc(db, GAMES_COLLECTION, gameId);
  await updateDoc(gameRef, { 
      ball: ballData,
      updatedAt: serverTimestamp() 
    });
}

/**
 * Updates the score in Firestore. (Host only)
 * @param {string} gameId - The game ID.
 * @param {Score} scoreData - The new score.
 */
export async function updateScore(gameId: string, scoreData: Score): Promise<void> {
  const gameRef = doc(db, GAMES_COLLECTION, gameId);
  await updateDoc(gameRef, { 
      score: scoreData,
      updatedAt: serverTimestamp()
    });
}

/**
 * Updates the game state.
 * @param {string} gameId - The game ID.
 * @param {GameState} newState - The new game state.
 */
export async function updateGameState(gameId: string, newState: GameState): Promise<void> {
    const gameRef = doc(db, GAMES_COLLECTION, gameId);
    await updateDoc(gameRef, {
        state: newState,
        updatedAt: serverTimestamp()
    });
}
