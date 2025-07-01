
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Copy, Gamepad, Loader2, Users, Check } from 'lucide-react';
import { useSocket } from '@/context/SocketContext';

export default function MultiplayerPage() {
    const socket = useSocket();
    const [gameId, setGameId] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [isJoining, setIsJoining] = useState(false);
    const [joinCode, setJoinCode] = useState('');
    const [copied, setCopied] = useState(false);
    const router = useRouter();
    const { toast } = useToast();

    useEffect(() => {
        if (!socket) {
            // Socket might not be ready on first render.
            return;
        }

        const onGameCreated = (newGameId: string) => {
            setGameId(newGameId);
            setIsCreating(false);
        };

        const onGameStarted = (data: { gameId: string; isHost: boolean }) => {
            router.push(`/game?gameId=${data.gameId}`);
        };

        const onJoinError = (message: string) => {
            setIsJoining(false);
            toast({
                variant: 'destructive',
                title: 'Join Failed',
                description: message,
            });
        };

        socket.on('gameCreated', onGameCreated);
        socket.on('gameStarted', onGameStarted);
        socket.on('joinError', onJoinError);

        return () => {
            socket.off('gameCreated', onGameCreated);
            socket.off('gameStarted', onGameStarted);
            socket.off('joinError', onJoinError);
        };
    }, [socket, router, toast]);

    const handleCreateGame = () => {
        if (!socket) return;
        setIsCreating(true);
        socket.emit('createGame');
    };

    const handleJoinGame = (e: React.FormEvent) => {
        e.preventDefault();
        if (!joinCode.trim() || !socket) return;
        setIsJoining(true);
        socket.emit('joinGame', joinCode.trim());
    };
    
    const handleCopy = () => {
        if (!gameId) return;
        navigator.clipboard.writeText(gameId);
        setCopied(true);
        toast({ title: "Copied!", description: "Game code copied to clipboard." });
        setTimeout(() => setCopied(false), 2000);
    }

    if (gameId) {
        return (
            <div className="container mx-auto py-10 flex items-center justify-center min-h-[calc(100vh-theme(spacing.24))]">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Gamepad /> Game Created!</CardTitle>
                        <CardDescription>Share this code with a friend to join.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex w-full items-center space-x-2">
                             <Input value={gameId} readOnly className="font-mono text-lg" />
                             <Button variant="outline" size="icon" onClick={handleCopy}>
                                {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                             </Button>
                        </div>
                        <div className="flex flex-col items-center gap-4 text-primary pt-4">
                            <Loader2 className="h-12 w-12 animate-spin" />
                            <p className="font-semibold text-lg">Waiting for opponent...</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

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
