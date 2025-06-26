
"use client";

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as THREE from 'three';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { MoveRight, Users, Swords, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getPlayerId } from '@/lib/player';
import { createGame, joinGame } from '@/services/gameService';

export default function MainMenu() {
  const mountRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { toast } = useToast();
  const [joinCode, setJoinCode] = useState('');
  const [isMultiplayerDialogOpen, setIsMultiplayerDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [newGameInfo, setNewGameInfo] = useState({ gameId: '', shareUrl: ''});

  const createMultiplayerGame = async () => {
    const playerId = getPlayerId();
    try {
      const gameId = await createGame(playerId);
      const shareUrl = `${window.location.origin}/game?gameId=${gameId}`;
      setNewGameInfo({ gameId, shareUrl });
      setIsMultiplayerDialogOpen(false);
      setIsShareDialogOpen(true);
    } catch (error) {
      console.error("Failed to create game:", error);
      toast({
        title: "Error",
        description: "Could not create multiplayer game. Please try again.",
        variant: "destructive",
      });
    }
  };

  const joinMultiplayerGame = async () => {
      const code = joinCode.trim().toUpperCase();
      if (code) {
          const playerId = getPlayerId();
          try {
            await joinGame(code, playerId);
            router.push(`/game?gameId=${code}`);
            setIsMultiplayerDialogOpen(false);
          } catch(error: any) {
            console.error("Failed to join game:", error);
            toast({
              title: "Failed to Join",
              description: error.message || "Could not join game. Check the code and try again.",
              variant: "destructive",
            });
          }
      } else {
        toast({
            title: "Error",
            description: "Please enter a game code.",
            variant: "destructive",
        })
      }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(newGameInfo.shareUrl);
    toast({
      title: "Copied!",
      description: "Game link copied to clipboard.",
    });
  }


  useEffect(() => {
    if (!mountRef.current) return;

    const currentMount = mountRef.current;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, currentMount.clientWidth / currentMount.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    currentMount.appendChild(renderer.domElement);

    camera.position.z = 5;

    const particleCount = 500;
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    const primaryColor = new THREE.Color(0x7DF9FF);
    const accentColor = new THREE.Color(0xD400FF);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i++) {
      positions[i] = (Math.random() - 0.5) * 10;
      const color = Math.random() > 0.5 ? primaryColor : accentColor;
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.7,
    });

    const particleSystem = new THREE.Points(particles, particleMaterial);
    scene.add(particleSystem);
    
    let mouseX = 0;
    let mouseY = 0;
    
    const onMouseMove = (event: MouseEvent) => {
        mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    }
    
    window.addEventListener('mousemove', onMouseMove);

    const animate = () => {
      requestAnimationFrame(animate);
      particleSystem.rotation.y += 0.0005;
      particleSystem.rotation.x += 0.0005;
      
      camera.position.x += (mouseX * 0.5 - camera.position.x) * 0.05;
      camera.position.y += (mouseY * 0.5 - camera.position.y) * 0.05;
      camera.lookAt(scene.position);

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      camera.aspect = currentMount.clientWidth / currentMount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', onMouseMove);
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative h-[calc(100vh-theme(spacing.14))] w-full overflow-hidden">
      <div ref={mountRef} className="absolute inset-0 z-0" />
      <div className="relative z-10 flex h-full w-full flex-col items-center justify-center bg-black/50">
        <div className="text-center space-y-4">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
            3D Pong Arena
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Experience the next generation of Pong. A fully immersive, 3D sports simulation.
          </p>
          <p className="max-w-xl text-md text-primary/80 font-code">
            Controls: Use A/D or Arrow Keys for paddle. Use Mouse to look around.
          </p>
          <div className="flex justify-center gap-4 pt-4">
            <Link href="/game">
              <Button size="lg" className="font-bold">
                Single Player
                <MoveRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>

            <Dialog open={isMultiplayerDialogOpen} onOpenChange={setIsMultiplayerDialogOpen}>
              <DialogTrigger asChild>
                <Button size="lg" variant="outline">
                  <Users className="mr-2 h-5 w-5" />
                  Multiplayer
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Multiplayer Arena</DialogTitle>
                  <DialogDescription>
                    Create a new game to challenge a friend, or join an existing game using a code.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <Button onClick={createMultiplayerGame} className="w-full">
                        <Swords className="mr-2 h-5 w-5" />
                        Create Game
                    </Button>
                    <div className="flex items-center space-x-2">
                        <Input 
                            placeholder="Enter Game Code" 
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value)}
                            className="flex-grow"
                        />
                        <Button onClick={joinMultiplayerGame} variant="secondary">Join</Button>
                    </div>
                </div>
              </DialogContent>
            </Dialog>

            <Link href="/settings">
              <Button size="lg" variant="outline">
                Settings
              </Button>
            </Link>
          </div>
        </div>
      </div>
       <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Multiplayer Game Created!</DialogTitle>
            <DialogDescription>
              Share this link with a friend. Once they join, you can start the game.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="game-code">Game Code</Label>
              <Input id="game-code" readOnly value={newGameInfo.gameId} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="share-link">Share Link</Label>
              <div className="flex items-center space-x-2">
                <Input id="share-link" readOnly value={newGameInfo.shareUrl} className="flex-grow"/>
                <Button onClick={copyToClipboard} size="icon" variant="secondary">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => router.push(newGameInfo.shareUrl)}>
              Enter Arena
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
