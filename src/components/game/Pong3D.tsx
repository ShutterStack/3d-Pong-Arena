"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import * as Tone from 'tone';
import { useRouter } from 'next/navigation';
import { adjustDifficulty, type DifficultyAdjustmentInput, type DifficultyAdjustmentOutput } from '@/ai/flows/dynamic-difficulty-adjustment';
import { useToast } from '@/hooks/use-toast';
import HUD from './HUD';

const WINNING_SCORE = 5;

const Pong3D = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { toast } = useToast();

  const [score, setScore] = useState({ player: 0, opponent: 0 });
  const [gameState, setGameState] = useState<'start' | 'playing' | 'paused' | 'gameOver'>('start');
  const [winner, setWinner] = useState<'player' | 'opponent' | null>(null);

  const gameTime = useRef(0);
  const clock = useRef(new THREE.Clock());

  const difficultyParams = useRef<DifficultyAdjustmentOutput>({
    ballSpeedMultiplier: 1.0,
    ballAngleRandomness: 0.1,
    paddleSizeMultiplier: 1.0,
  });

  const updateDifficulty = useCallback(async () => {
    try {
      const input: DifficultyAdjustmentInput = {
        playerScore: score.player,
        opponentScore: score.opponent,
        gameTimeElapsed: gameTime.current,
      };
      const newDifficulty = await adjustDifficulty(input);
      difficultyParams.current = newDifficulty;
      
      toast({
        title: "Difficulty Adjusted",
        description: `Ball speed x${newDifficulty.ballSpeedMultiplier.toFixed(2)}, Paddle size x${newDifficulty.paddleSizeMultiplier.toFixed(2)}`,
      });
    } catch (error) {
      console.error("Failed to adjust difficulty:", error);
    }
  }, [score.player, score.opponent, toast]);

  useEffect(() => {
    if (gameState === 'playing' && (score.player > 0 || score.opponent > 0)) {
        updateDifficulty();
    }
  }, [score, gameState, updateDifficulty]);


  useEffect(() => {
    if (!mountRef.current) return;
    const currentMount = mountRef.current;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);
    const camera = new THREE.PerspectiveCamera(75, currentMount.clientWidth / currentMount.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.shadowMap.enabled = true;
    currentMount.appendChild(renderer.domElement);

    // Arena
    const arenaWidth = 12;
    const arenaHeight = 8;
    const arenaDepth = 20;

    const primaryColor = 0x7DF9FF;
    const accentColor = 0xD400FF;

    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.8 });
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
    const lineMaterial = new THREE.MeshBasicMaterial({ color: primaryColor, fog: false });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(arenaWidth, arenaDepth), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    
    // Grid lines for futuristic feel
    const grid = new THREE.GridHelper(arenaDepth, 20, primaryColor, 0x333333);
    grid.position.y = 0.01;
    grid.position.x = 0;
    scene.add(grid);

    // Paddles
    const paddleGeometry = new THREE.BoxGeometry(2, 1, 0.2);
    const playerMaterial = new THREE.MeshStandardMaterial({ color: primaryColor, emissive: primaryColor, emissiveIntensity: 0.5 });
    const opponentMaterial = new THREE.MeshStandardMaterial({ color: accentColor, emissive: accentColor, emissiveIntensity: 0.5 });

    const playerPaddle = new THREE.Mesh(paddleGeometry, playerMaterial);
    playerPaddle.position.z = arenaDepth / 2 - 1;
    playerPaddle.castShadow = true;
    scene.add(playerPaddle);

    const opponentPaddle = new THREE.Mesh(paddleGeometry, opponentMaterial);
    opponentPaddle.position.z = -arenaDepth / 2 + 1;
    opponentPaddle.castShadow = true;
    scene.add(opponentPaddle);

    // Ball
    const ballGeometry = new THREE.SphereGeometry(0.2, 32, 32);
    const ballMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.8 });
    const ball = new THREE.Mesh(ballGeometry, ballMaterial);
    ball.castShadow = true;
    scene.add(ball);

    const ballLight = new THREE.PointLight(0xffffff, 2, 5);
    ball.add(ballLight);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambientLight);
    const topLight = new THREE.DirectionalLight(primaryColor, 0.5);
    topLight.position.set(0, 10, 0);
    scene.add(topLight);
    const bottomLight = new THREE.DirectionalLight(accentColor, 0.5);
    bottomLight.position.set(0, -10, 0);
    scene.add(bottomLight);

    // Camera setup (first-person)
    camera.position.set(0, 1.5, playerPaddle.position.z + 2);
    camera.lookAt(0, 0, 0);

    // Audio setup
    const hitSound = new Tone.MembraneSynth().toDestination();
    const scoreSound = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 1 },
    }).toDestination();

    // Game state refs
    const ballVelocity = new THREE.Vector3(0, 0, -10);
    const mouse = new THREE.Vector2();
    let localGameState = 'start';
    let localScore = { player: 0, opponent: 0 };
    
    const resetBall = (direction: number) => {
        ball.position.set(0, 0.5, 0);
        const baseSpeed = 10;
        const speed = baseSpeed * difficultyParams.current.ballSpeedMultiplier;
        const angle = (Math.random() - 0.5) * difficultyParams.current.ballAngleRandomness * Math.PI;
        ballVelocity.z = direction * speed * Math.cos(angle);
        ballVelocity.x = speed * Math.sin(angle);
    };
    resetBall(Math.random() > 0.5 ? 1 : -1);

    const onMouseMove = (event: MouseEvent) => {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', onMouseMove);

    const onClick = () => {
        if (localGameState === 'start' || localGameState === 'gameOver') {
            localGameState = 'playing';
            setGameState('playing');
            localScore = { player: 0, opponent: 0 };
            setScore({ player: 0, opponent: 0 });
            setWinner(null);
            gameTime.current = 0;
            resetBall(1);
        }
    }
    window.addEventListener('click', onClick);


    let animationFrameId: number;
    const animate = () => {
        animationFrameId = requestAnimationFrame(animate);
        const delta = clock.current.getDelta();

        if (localGameState === 'playing') {
            gameTime.current += delta;
            
            // Player paddle control
            const vector = new THREE.Vector3(mouse.x, mouse.y, 0.5);
            vector.unproject(camera);
            const dir = vector.sub(camera.position).normalize();
            const distance = -camera.position.z / dir.z;
            const pos = camera.position.clone().add(dir.multiplyScalar(distance));
            playerPaddle.position.x = THREE.MathUtils.clamp(pos.x, -arenaWidth / 2 + 1, arenaWidth / 2 - 1);
            playerPaddle.position.y = THREE.MathUtils.clamp(pos.y, 0.5, arenaHeight - 0.5);
            
            playerPaddle.scale.x = difficultyParams.current.paddleSizeMultiplier;

            // Opponent AI
            const opponentTargetX = ball.position.x;
            opponentPaddle.position.x += (opponentTargetX - opponentPaddle.position.x) * 0.1;
            opponentPaddle.position.x = THREE.MathUtils.clamp(opponentPaddle.position.x, -arenaWidth/2 + 1, arenaWidth/2 - 1);
            opponentPaddle.scale.x = difficultyParams.current.paddleSizeMultiplier;

            // Ball movement
            ball.position.add(ballVelocity.clone().multiplyScalar(delta));

            // Collision detection
            if (ball.position.x <= -arenaWidth / 2 || ball.position.x >= arenaWidth / 2) {
                ballVelocity.x *= -1;
                hitSound.triggerAttackRelease('C1', '8n');
            }
            if (ball.position.y <= 0.2 || ball.position.y >= arenaHeight - 0.2) {
                ballVelocity.y *= -1;
                hitSound.triggerAttackRelease('C1', '8n');
            }

            const ballBox = new THREE.Box3().setFromObject(ball);
            const playerBox = new THREE.Box3().setFromObject(playerPaddle);
            const opponentBox = new THREE.Box3().setFromObject(opponentPaddle);

            if (ballVelocity.z > 0 && ballBox.intersectsBox(playerBox)) {
                ballVelocity.z *= -1.05;
                ballVelocity.x += (ball.position.x - playerPaddle.position.x) * 2;
                hitSound.triggerAttackRelease('C2', '8n');
            }
            if (ballVelocity.z < 0 && ballBox.intersectsBox(opponentBox)) {
                ballVelocity.z *= -1.05;
                ballVelocity.x += (ball.position.x - opponentPaddle.position.x) * 2;
                hitSound.triggerAttackRelease('C2', '8n');
            }
            
            // Scoring
            if (ball.position.z > arenaDepth / 2) {
                localScore.opponent++;
                setScore({...localScore});
                scoreSound.triggerAttackRelease('A4', '8n');
                resetBall(-1);
            }
            if (ball.position.z < -arenaDepth / 2) {
                localScore.player++;
                setScore({...localScore});
                scoreSound.triggerAttackRelease('C5', '8n');
                resetBall(1);
            }

            if (localScore.player >= WINNING_SCORE || localScore.opponent >= WINNING_SCORE) {
                localGameState = 'gameOver';
                setGameState('gameOver');
                const gameWinner = localScore.player >= WINNING_SCORE ? 'player' : 'opponent';
                setWinner(gameWinner);
                router.push(`/game-over?winner=${gameWinner}&playerScore=${localScore.player}&opponentScore=${localScore.opponent}`);
            }
        }
        
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
      window.removeEventListener('click', onClick);
      cancelAnimationFrame(animationFrameId);
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
      scene.clear();
      renderer.dispose();
    };
  }, [router, toast]);

  return (
    <div className="relative h-full w-full">
      <div ref={mountRef} className="absolute inset-0 z-0" />
      <HUD playerScore={score.player} opponentScore={score.opponent} gameState={gameState} winner={winner} />
    </div>
  );
};

export default Pong3D;
