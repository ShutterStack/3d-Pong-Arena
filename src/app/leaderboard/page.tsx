
"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, AlertCircle } from 'lucide-react';

interface LeaderboardEntry {
  name: string;
  score: number;
  date: string;
}

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      setError(null);
      try {
        const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL;
        if (!serverUrl) {
            throw new Error("Server URL is not configured. Please set NEXT_PUBLIC_SERVER_URL environment variable.");
        }
        const response = await fetch(`${serverUrl}/api/leaderboard`);
        if (!response.ok) {
          throw new Error('Failed to fetch leaderboard data.');
        }
        const data = await response.json();
        setLeaderboard(data);
      } catch (err: any) {
        setError(err.message || 'An unknown error occurred.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="container mx-auto py-10">
      <Card className="border-primary/50 shadow-lg shadow-primary/20">
        <CardHeader>
          <div className="flex items-center gap-4">
            <Trophy className="h-10 w-10 text-primary" />
            <div>
              <CardTitle className="text-3xl">Leaderboard</CardTitle>
              <CardDescription>Top 10 players in the 3D Pong Arena</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-4 text-destructive p-8 bg-destructive/10 rounded-md">
                <AlertCircle className="h-12 w-12" />
                <p className="text-lg font-semibold">Could not load leaderboard</p>
                <p className="text-sm text-center">{error}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px] text-center">Rank</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.map((entry, index) => (
                  <TableRow key={index} className={index === 0 ? 'bg-primary/10 hover:bg-primary/20' : ''}>
                    <TableCell className="font-bold text-lg text-center">{index + 1}</TableCell>
                    <TableCell className="font-medium">{entry.name}</TableCell>
                    <TableCell className="text-right font-semibold text-primary">{entry.score}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatDate(entry.date)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
