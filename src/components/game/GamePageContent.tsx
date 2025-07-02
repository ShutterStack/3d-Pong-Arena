
"use client";

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Socket } from 'socket.io-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Loader2 } from 'lucide-react';

interface GamePageContentProps {
  Pong3DComponent: React.ComponentType<any>;
  socket: Socket | null;
}

export function GamePageContent({ Pong3DComponent, socket }: GamePageContentProps) {
  const searchParams = useSearchParams();

  const gameId = searchParams.get('gameId');
  const mode = gameId ? 'multiplayer' : 'single';

  const [isHost, setIsHost] = useState(false);
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [opponentName, setOpponentName] = useState<string | null>(null);

  useEffect(() => {
    const hostParam = searchParams.get('isHost');
    if (hostParam) {
      setIsHost(hostParam === 'true');
    }
    const playerNameParam = searchParams.get('playerName');
    if (playerNameParam) {
      setPlayerName(decodeURIComponent(playerNameParam));
    }
    const opponentNameParam = searchParams.get('opponentName');
    if(opponentNameParam) {
        setOpponentName(decodeURIComponent(opponentNameParam));
    }
  }, [searchParams]);


  if (mode === 'multiplayer' && !socket) {
    return (
       <div className="flex items-center justify-center h-full w-full bg-background">
        <Card className="w-full max-w-sm text-center">
            <CardHeader>
                <CardTitle className="text-2xl">Connecting...</CardTitle>
                <CardDescription>Establishing connection to the arena.</CardDescription>
            </CardHeader>
            <CardContent>
                 <div className="flex flex-col items-center gap-4 text-primary">
                    <Loader2 className="h-12 w-12 animate-spin" />
                    <p className="font-semibold text-lg">Connecting to server...</p>
                </div>
            </CardContent>
        </Card>
      </div>
    )
  }

  return <Pong3DComponent 
            mode={mode} 
            socket={socket} 
            gameId={gameId} 
            isHost={isHost} 
            playerName={playerName} 
            opponentName={opponentName} 
        />;
}
