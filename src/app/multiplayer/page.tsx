
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Copy, Gamepad, Loader2, Users, Check, Save } from 'lucide-react';
import { useSocket } from '@/context/SocketContext';
import short from 'short-uuid';
import { Label } from '@/components/ui/label';

export default function MultiplayerPage() {
    const socket = useSocket();
    const router = useRouter();
    const { toast } = useToast();

    // Player Identity State
    const [player, setPlayer] = useState<{ name: string; id: string } | null>(null);
    const [nameInput, setNameInput] = useState('');
    const [isSavingName, setIsSavingName] = useState(false);

    // Game State
    const [gameId, setGameId] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [isJoining, setIsJoining] = useState(false);
    const [joinCode, setJoinCode] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        // Load player from local storage on mount
        try {
            const savedPlayer = localStorage.getItem('pongPlayer');
            if (savedPlayer) {
                const parsedPlayer = JSON.parse(savedPlayer);
                if(parsedPlayer.name && parsedPlayer.id) {
                    setPlayer(parsedPlayer);
                } else {
                    // Data is malformed, create a new one
                    setPlayer({ name: '', id: short.generate() });
                }
            } else {
                setPlayer({ name: '', id: short.generate() });
            }
        } catch (error) {
            console.error("Could not load player data", error);
            setPlayer({ name: '', id: short.generate() });
        }
    }, []);

    useEffect(() => {
        if (!socket) return;

        const onGameCreated = (newGameId: string) => {
            setGameId(newGameId);
            setIsCreating(false);
        };

        const onGameStarted = (data: { gameId: string; isHost: boolean, playerName: string, opponentName: string }) => {
            router.push(`/game?gameId=${data.gameId}&isHost=${data.isHost}&playerName=${encodeURIComponent(data.playerName)}&opponentName=${encodeURIComponent(data.opponentName)}`);
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
    
    const handleSaveName = (e: React.FormEvent) => {
        e.preventDefault();
        if (!nameInput.trim() || !player) return;
        setIsSavingName(true);
        const newPlayer = { ...player, name: nameInput.trim() };
        localStorage.setItem('pongPlayer', JSON.stringify(newPlayer));
        setPlayer(newPlayer);
        setIsSavingName(false);
        toast({
            title: "Name Saved!",
            description: `Welcome to the arena, ${newPlayer.name}!`,
        });
    };

    const handleCreateGame = () => {
        if (!socket || !player?.name) return;
        setIsCreating(true);
        socket.emit('createGame', { playerName: player.name, playerId: player.id });
    };

    const handleJoinGame = (e: React.FormEvent) => {
        e.preventDefault();
        if (!joinCode.trim() || !socket || !player?.name) return;
        setIsJoining(true);
        socket.emit('joinGame', { gameId: joinCode.trim().toUpperCase(), playerName: player.name, playerId: player.id });
    };
    
    const handleCopy = () => {
        if (!gameId) return;
        navigator.clipboard.writeText(gameId);
        setCopied(true);
        toast({ title: "Copied!", description: "Game code copied to clipboard." });
        setTimeout(() => setCopied(false), 2000);
    }
    
    // Render name input form if player name is not set
    if (!player || !player.name) {
        return (
             <div className="container mx-auto py-10 flex items-center justify-center min-h-[calc(100vh-theme(spacing.24))]">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Users /> Welcome, Challenger!</CardTitle>
                        <CardDescription>Enter your name to compete on the leaderboard.</CardDescription>
                    </CardHeader>
                    <form onSubmit={handleSaveName}>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                               <Label htmlFor="playerName">Player Name</Label>
                               <Input
                                    id="playerName"
                                    value={nameInput}
                                    onChange={(e) => setNameInput(e.target.value)}
                                    placeholder="Enter your name..."
                                    required
                                    maxLength={20}
                                    disabled={isSavingName}
                               />
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button type="submit" disabled={isSavingName || !nameInput.trim()} className="w-full">
                                {isSavingName ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Save and Enter Lobby
                            </Button>
                        </CardFooter>
                    </form>
                </Card>
            </div>
        )
    }

    // Render game creation/waiting lobby
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
                             <Input value={gameId} readOnly className="font-mono text-lg text-center tracking-[0.2em]" />
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

    // Render main multiplayer lobby
    return (
        <div className="container mx-auto py-10 flex items-center justify-center min-h-[calc(100vh-theme(spacing.24))]">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Users /> Multiplayer Lobby</CardTitle>
                    <CardDescription>Welcome, <span className="text-primary font-bold">{player.name}</span>! Create a new game or join one.</CardDescription>
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
                            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                            placeholder="ENTER 6-DIGIT CODE"
                            maxLength={6}
                            disabled={isJoining || !socket}
                            className="font-mono text-center tracking-widest text-lg"
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
