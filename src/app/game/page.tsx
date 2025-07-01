
"use client";

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton';
import { Suspense } from 'react';
import { GamePageContent } from '@/components/game/GamePageContent';

const Pong3D = dynamic(() => import('@/components/game/Pong3D'), {
  ssr: false,
  loading: () => 
    <div className="flex h-[calc(100vh-theme(spacing.14))] w-full flex-col items-center justify-center space-y-4 bg-background">
      <Skeleton className="h-1/2 w-4/5" />
      <p className="text-2xl font-bold text-primary animate-pulse">LOADING ARENA...</p>
    </div>
})


export default function GamePage() {
  return (
    <div className="h-[calc(100vh-theme(spacing.14))] w-full bg-black">
      <Suspense fallback={<div>Loading...</div>}>
         <GamePageContent Pong3DComponent={Pong3D} />
      </Suspense>
    </div>
  )
}
