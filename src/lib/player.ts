
'use client';

/**
 * Gets the current player's unique ID.
 * If one doesn't exist in localStorage, it creates one and saves it.
 * @returns {string} The player's ID.
 */
export function getPlayerId(): string {
  if (typeof window === 'undefined') {
    return 'server_player';
  }

  let playerId = localStorage.getItem('pongPlayerId');
  
  if (!playerId) {
    playerId = `player_${Math.random().toString(36).substring(2, 11)}`;
    localStorage.setItem('pongPlayerId', playerId);
  }
  
  return playerId;
}
