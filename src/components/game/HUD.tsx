
"use client";

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface HUDProps {
  playerScore: number;
  opponentScore: number;
  gameState: 'start' | 'playing' | 'paused' | 'gameOver';
  winner?: 'player' | 'opponent' | null;
  playerName?: string;
  opponentName?: string;
}

const HUD: React.FC<HUDProps> = ({ playerScore, opponentScore, gameState, playerName, opponentName }) => {

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-8 text-white font-headline">
      <div className="w-full flex justify-between items-start">
        <Card className="bg-black/30 border-primary/50 text-primary min-w-[120px]">
          <CardContent className="p-4">
            <h2 className="text-lg font-bold truncate">{playerName || 'Player'}</h2>
            <p className="text-5xl font-extrabold text-center">{playerScore}</p>
          </CardContent>
        </Card>
        <Card className="bg-black/30 border-accent/50 text-accent min-w-[120px]">
          <CardContent className="p-4">
            <h2 className="text-lg font-bold truncate">{opponentName || 'Opponent'}</h2>
            <p className="text-5xl font-extrabold text-center">{opponentScore}</p>
          </CardContent>
        </Card>
      </div>
      
      {gameState === 'start' && (
        <div className="text-center bg-black/50 p-6 rounded-lg">
          <h1 className="text-4xl font-bold animate-pulse">
            Click to Start
          </h1>
          <p className="text-muted-foreground">Use A/D or Arrow Keys for paddle. Use Mouse to look around.</p>
        </div>
      )}

      <div />
    </div>
  );
};

export default HUD;
