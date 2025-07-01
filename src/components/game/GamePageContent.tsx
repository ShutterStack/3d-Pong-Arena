
"use client";

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { Socket } from 'socket.io-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Loader2, WifiOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '../ui/button';

interface GamePageContentProps {
  Pong3DComponent: React.ComponentType<any>;
  socket: Socket | null;
}

export function GamePageContent({ Pong3DComponent, socket }: GamePageContentProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const gameId = searchParams.get('gameId');
  const mode = gameId ? 'multiplayer' : 'single';

  const [isHost, setIsHost] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'multiplayer' && socket) {
      // The server determines who is the host. We need to find out.
      // A simple way is to check which player joined first.
      // The server's 'gameStarted' event should ideally tell us.
      // For now, let's assume the first player in the server's list is the host.
      // This part is tricky without server sending the role.
      // Let's modify Pong3D to handle `isHost` being determined later.
    }
  }, [mode, socket, gameId, router, toast]);

  // For multiplayer, we can determine isHost based on who created the game vs joined.
  // The creator is the host. This logic is now on the server.
  // We need to get the `isHost` status.
  // Let's assume it comes from the URL, set by the lobby.

  useEffect(() => {
    const hostParam = searchParams.get('isHost');
    if (hostParam) {
      setIsHost(hostParam === 'true');
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

  return <Pong3DComponent mode={mode} socket={socket} gameId={gameId} isHost={isHost} />;
}
