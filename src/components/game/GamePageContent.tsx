
"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Loader2, UserPlus, WifiOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '../ui/button';

interface GamePageContentProps {
  Pong3DComponent: React.ComponentType<any>;
}

export function GamePageContent({ Pong3DComponent }: GamePageContentProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const gameId = searchParams.get('gameId');
  const mode = gameId ? 'multiplayer' : 'single';

  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (mode !== 'multiplayer' || !gameId) {
      setGameStarted(true); // For single player, start immediately
      return;
    }
    
    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL;
    if (!serverUrl) {
      setError("Server URL is not configured. Cannot start multiplayer.");
      console.error("Server URL is not configured.");
      return;
    }

    const newSocket = io(serverUrl);
    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to server with id:', newSocket.id);
      newSocket.emit('joinGame', gameId);
    });

    newSocket.on('gameStarted', (data: { isHost: boolean; gameId: string }) => {
      console.log('Game started!', data);
      setIsHost(data.isHost);
      setGameStarted(true);
    });

    newSocket.on('joinError', (message: string) => {
      setError(`Failed to join game: ${message}`);
      toast({
        variant: 'destructive',
        title: 'Join Failed',
        description: message,
      });
      newSocket.disconnect();
      router.push('/multiplayer');
    });
    
    newSocket.on('disconnect', () => {
      setError('Disconnected from server.');
      console.log('Disconnected from server.');
    });

    return () => {
      if (socketRef.current) {
        console.log('Disconnecting socket...');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [gameId, mode, router, toast]);

  if (mode === 'multiplayer' && !gameStarted) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-background">
        <Card className="w-full max-w-sm text-center">
            <CardHeader>
                <CardTitle className="text-2xl">Joining Game</CardTitle>
                <CardDescription>Game Code: {gameId}</CardDescription>
            </CardHeader>
            <CardContent>
                {error ? (
                     <div className="flex flex-col items-center gap-4 text-destructive">
                        <WifiOff className="h-12 w-12" />
                        <p className="font-semibold">{error}</p>
                        <Button onClick={() => router.push('/multiplayer')} variant="destructive">Go Back</Button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-4 text-primary">
                        <Loader2 className="h-12 w-12 animate-spin" />
                        <p className="font-semibold text-lg">Waiting for opponent...</p>
                        <p className="text-muted-foreground text-sm">Share the code with a friend to begin.</p>
                    </div>
                )}
            </CardContent>
        </Card>
      </div>
    );
  }

  return <Pong3DComponent mode={mode} socket={socket} gameId={gameId} isHost={isHost} />;
}
