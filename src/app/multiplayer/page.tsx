
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Copy, Gamepad, Loader2, Users } from 'lucide-react';

export default function MultiplayerPage() {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [gameId, setGameId] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [isJoining, setIsJoining] = useState(false);
    const [joinCode, setJoinCode] = useState('');
    const router = useRouter();
    const { toast } = useToast();

    useEffect(() => {
        const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL;
        if (!serverUrl) {
            console.error("Server URL is not configured.");
            toast({
                variant: 'destructive',
                title: 'Configuration Error',
                description: 'The server URL is not set. Multiplayer is unavailable.',
            });
            return;
        }

        const newSocket = io(serverUrl);
        setSocket(newSocket);

        newSocket.on('gameCreated', (newGameId) => {
            setIsCreating(false);
            router.push(`/game?gameId=${newGameId}`);
        });

        newSocket.on('joinError', (message) => {
            setIsJoining(false);
            toast({
                variant: 'destructive',
                title: 'Join Failed',
                description: message,
            });
        });

        return () => {
            newSocket.disconnect();
        };
    }, [router, toast]);

    const handleCreateGame = () => {
        if (!socket) return;
        setIsCreating(true);
        socket.emit('createGame');
    };

    const handleJoinGame = (e: React.FormEvent) => {
        e.preventDefault();
        if (!joinCode.trim() || !socket) return;
        setIsJoining(true);
        router.push(`/game?gameId=${joinCode.trim()}`);
    };

    return (
        <div className="container mx-auto py-10 flex items-center justify-center min-h-[calc(100vh-theme(spacing.24))]">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Users /> Multiplayer</CardTitle>
                    <CardDescription>Create a new game or join one with a code.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div>
                        <Button onClick={handleCreateGame} disabled={isCreating || !socket} className="w-full" size="lg">
                            {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Gamepad className="mr-2" />}
                            {isCreating ? 'Creating Game...' : 'Create New Game'}
                        </Button>
                    </div>
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-2 text-muted-foreground">Or</span>
                        </div>
                    </div>
                    <form onSubmit={handleJoinGame} className="space-y-2">
                        <Input
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value)}
                            placeholder="Enter game code..."
                            disabled={isJoining || !socket}
                        />
                         <Button type="submit" variant="secondary" disabled={isJoining || !socket || !joinCode.trim()} className="w-full">
                            {isJoining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Join Game
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

