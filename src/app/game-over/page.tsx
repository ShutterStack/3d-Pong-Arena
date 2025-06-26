"use client";

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, ShieldAlert } from 'lucide-react';

function GameOverContent() {
  const searchParams = useSearchParams();
  const winner = searchParams.get('winner');
  const playerScore = searchParams.get('playerScore');
  const opponentScore = searchParams.get('opponentScore');

  const isPlayerWinner = winner === 'player';

  return (
    <div className="flex items-center justify-center h-[calc(100vh-theme(spacing.14))] bg-gradient-to-br from-background via-gray-900 to-background">
      <Card className="w-full max-w-md text-center border-2 shadow-lg bg-black/30 backdrop-blur-sm"
        style={{
          borderColor: isPlayerWinner ? 'hsl(var(--primary))' : 'hsl(var(--accent))',
          boxShadow: `0 0 20px ${isPlayerWinner ? 'hsl(var(--primary))' : 'hsl(var(--accent))'}`
        }}
      >
        <CardHeader>
          {isPlayerWinner ? (
            <Trophy className="mx-auto h-16 w-16 text-primary" />
          ) : (
            <ShieldAlert className="mx-auto h-16 w-16 text-accent" />
          )}
          <CardTitle className="text-4xl font-bold">
            {isPlayerWinner ? 'Victory!' : 'Game Over'}
          </CardTitle>
          <CardDescription className="text-lg">
            {isPlayerWinner ? "You have conquered the arena!" : "The opponent proved too strong this time."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-around items-center text-2xl font-semibold">
            <div className="text-primary space-y-1">
              <div>Player</div>
              <div className="text-5xl font-bold">{playerScore}</div>
            </div>
            <div className="text-4xl text-muted-foreground">VS</div>
            <div className="text-accent space-y-1">
              <div>Opponent</div>
              <div className="text-5xl font-bold">{opponentScore}</div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center gap-4 pt-6">
          <Link href="/game" passHref>
            <Button size="lg" variant="default">Play Again</Button>
          </Link>
          <Link href="/" passHref>
            <Button size="lg" variant="outline">Main Menu</Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function GameOverPage() {
    return (
        <Suspense fallback={<div>Loading results...</div>}>
            <GameOverContent />
        </Suspense>
    )
}
