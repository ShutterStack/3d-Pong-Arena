
"use client";

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, ShieldAlert, Award } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';

function GameOverContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const winner = searchParams.get('winner');
  const playerScore = searchParams.get('playerScore');
  const opponentScore = searchParams.get('opponentScore');
  const mode = searchParams.get('mode');

  const isPlayerWinner = winner === 'player';

  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !playerScore) return;

    setIsSubmitting(true);
    try {
      const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL;
      if (!serverUrl) {
          throw new Error("Server URL is not configured. Please set NEXT_PUBLIC_SERVER_URL environment variable.");
      }
      const response = await fetch(`${serverUrl}/api/leaderboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, score: parseInt(playerScore) }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit score.');
      }
      
      toast({
        title: "Score Submitted!",
        description: "Your victory has been recorded on the leaderboard.",
      });

      router.push('/leaderboard');

    } catch (error: any) {
      console.error('Error submitting score:', error);
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: error.message || "Could not submit your score. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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
        <CardContent className="space-y-6">
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

          {isPlayerWinner && mode === 'single' && (
            <form onSubmit={handleSubmitScore} className="space-y-4 pt-4 border-t border-border">
              <h3 className="text-lg font-semibold text-primary flex items-center justify-center gap-2">
                <Award className="h-5 w-5" /> Submit to Leaderboard
              </h3>
              <div className="space-y-2 text-left">
                <Label htmlFor='name' className="text-muted-foreground">Enter Your Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Pong Champion"
                  required
                  disabled={isSubmitting}
                />
              </div>
              <Button type="submit" disabled={isSubmitting || !name.trim()} className="w-full">
                {isSubmitting ? 'Submitting...' : 'Submit Score'}
              </Button>
            </form>
          )}

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
