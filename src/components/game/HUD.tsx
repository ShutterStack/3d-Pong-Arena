
"use client";

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import type { GameData } from '@/services/gameService';

interface HUDProps {
  playerScore: number;
  opponentScore: number;
  gameState: 'start' | 'playing' | 'paused' | 'gameOver';
  winner?: 'player' | 'opponent' | null;
  isMultiplayer: boolean;
  gameData?: GameData | null;
}

const HUD: React.FC<HUDProps> = ({ playerScore, opponentScore, gameState, isMultiplayer, gameData }) => {
  const showWaitingMessage = isMultiplayer && (!gameData?.players.player2 || gameData?.state === 'waiting');

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-8 text-white font-headline">
      <div className="w-full flex justify-between items-start">
        <Card className="bg-black/30 border-primary/50 text-primary">
          <CardContent className="p-4">
            <h2 className="text-lg font-bold">Player</h2>
            <p className="text-5xl font-extrabold text-center">{playerScore}</p>
          </CardContent>
        </Card>
        <Card className="bg-black/30 border-accent/50 text-accent">
          <CardContent className="p-4">
            <h2 className="text-lg font-bold">Opponent</h2>
            <p className="text-5xl font-extrabold text-center">{opponentScore}</p>
          </CardContent>
        </Card>
      </div>
      
      {(gameState === 'start' || showWaitingMessage) && (
        <div className="text-center bg-black/50 p-6 rounded-lg">
          <h1 className="text-4xl font-bold animate-pulse">
            {showWaitingMessage ? "Waiting for Opponent..." : "Click to Start"}
          </h1>
          {!showWaitingMessage && <p className="text-muted-foreground">Use A/D or Arrow Keys for paddle. Use Mouse to look around.</p>}
           {isMultiplayer && !showWaitingMessage && <p className="text-primary/80 mt-2">Opponent has joined! Click when ready.</p>}
           {isMultiplayer && showWaitingMessage && <p className="text-primary/80 mt-2">Share the game link with a friend.</p>}
        </div>
      )}

      <div />
    </div>
  );
};

export default HUD;
