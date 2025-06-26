"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import * as Tone from 'tone';
import { useRouter } from 'next/navigation';
import { adjustDifficulty, type DifficultyAdjustmentInput, type DifficultyAdjustmentOutput } from '@/ai/flows/dynamic-difficulty-adjustment';
import { useToast } from '@/hooks/use-toast';
import HUD from './HUD';
import { Skeleton } from '../ui/skeleton';

const WINNING_SCORE = 5;

type GameSettings = {
  cameraView: 'first-person' | 'third-person' | 'top-down';
  cameraShake: boolean;
  masterVolume: number;
  musicVolume: number;
};

const Pong3D = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { toast } = useToast();

  const [score, setScore] = useState({ player: 0, opponent: 0 });
  const [gameState, setGameState] = useState<'start' | 'playing' | 'paused' | 'gameOver'>('start');
  const [winner, setWinner] = useState<'player' | 'opponent' | null>(null);
  const [settings, setSettings] = useState<GameSettings | null>(null);
  const [useMouse, setUseMouse] = useState(true);

  const gameTime = useRef(0);
  const clock = useRef(new THREE.Clock());
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const cameraShake = useRef({ intensity: 0, time: 0 });
  const particlePool = useRef<THREE.Mesh[]>([]);

  const difficultyParams = useRef<DifficultyAdjustmentOutput>({
    ballSpeedMultiplier: 1.0,
    ballAngleRandomness: 0.1,
    paddleSizeMultiplier: 1.0,
  });

  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('pongSettings');
      const defaultSettings = { cameraView: 'first-person', cameraShake: true, masterVolume: 80, musicVolume: 50 };
      setSettings(savedSettings ? JSON.parse(savedSettings) : defaultSettings);
    } catch (error) {
      console.error("Could not load settings, using defaults.", error);
    }
  }, []);

  const updateDifficulty = useCallback(async () => {
    try {
      const input: DifficultyAdjustmentInput = {
        playerScore: score.player,
        opponentScore: score.opponent,
        gameTimeElapsed: gameTime.current,
      };
      const newDifficulty = await adjustDifficulty(input);
      difficultyParams.current = newDifficulty;
      
    } catch (error) {
      console.error("Failed to adjust difficulty:", error);
    }
  }, [score.player, score.opponent]);

  useEffect(() => {
    if (gameState === 'playing' && (score.player > 0 || score.opponent > 0)) {
        updateDifficulty();
    }
  }, [score, gameState, updateDifficulty]);


  useEffect(() => {
    if (!mountRef.current || !settings) return;
    const currentMount = mountRef.current;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.025);
    const camera = new THREE.PerspectiveCamera(90, currentMount.clientWidth / currentMount.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.shadowMap.enabled = true;
    currentMount.appendChild(renderer.domElement);

    const arenaWidth = 12;
    const arenaHeight = 8;
    const arenaDepth = 20;

    const primaryColor = 0x7DF9FF;
    const accentColor = 0xD400FF;

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(arenaWidth, arenaDepth), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    
    const particleCount = 5000;
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);
    const pPrimary = new THREE.Color(primaryColor);
    const pAccent = new THREE.Color(accentColor);

    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        positions[i3] = (Math.random() - 0.5) * 300;
        positions[i3 + 1] = (Math.random() - 0.5) * 300;
        positions[i3 + 2] = (Math.random() - 0.5) * 300;
        
        const color = Math.random() > 0.5 ? pPrimary : pAccent;
        particleColors[i3] = color.r;
        particleColors[i3 + 1] = color.g;
        particleColors[i3 + 2] = color.b;
    }

    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particles.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.3,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });

    const particleSystem = new THREE.Points(particles, particleMaterial);
    scene.add(particleSystem);


    const paddleGeometry = new THREE.BoxGeometry(2, 1, 0.2);
    const playerPaddle = new THREE.Mesh(paddleGeometry, new THREE.MeshStandardMaterial({ color: primaryColor, emissive: primaryColor, emissiveIntensity: 0.5 }));
    playerPaddle.position.z = arenaDepth / 2 - 1;
    playerPaddle.position.y = 1;
    playerPaddle.castShadow = true;
    scene.add(playerPaddle);

    const opponentPaddle = new THREE.Mesh(paddleGeometry, new THREE.MeshStandardMaterial({ color: accentColor, emissive: accentColor, emissiveIntensity: 0.5 }));
    opponentPaddle.position.z = -arenaDepth / 2 + 1;
    opponentPaddle.position.y = 1;
    opponentPaddle.castShadow = true;
    scene.add(opponentPaddle);

    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 32), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.8 }));
    ball.castShadow = true;
    scene.add(ball);
    ball.add(new THREE.PointLight(0xffffff, 2, 5));

    scene.add(new THREE.AmbientLight(0xffffff, 0.2));
    const topLight = new THREE.DirectionalLight(primaryColor, 0.5);
    topLight.position.set(0, 10, 0);
    scene.add(topLight);
    const bottomLight = new THREE.DirectionalLight(accentColor, 0.5);
    bottomLight.position.set(0, -10, 0);
    scene.add(bottomLight);

    const hitSound = new Tone.MembraneSynth().toDestination();
    const scoreSound = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 1 }, }).toDestination();
    Tone.Master.volume.value = Tone.gainToDb(settings.masterVolume / 100);

    const pGeometry = new THREE.SphereGeometry(0.05, 8, 8);
    const pMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
    for (let i = 0; i < 100; i++) {
        const particle = new THREE.Mesh(pGeometry, pMaterial.clone());
        particle.visible = false;
        // @ts-ignore
        particle.velocity = new THREE.Vector3();
        // @ts-ignore
        particle.lifetime = 0;
        scene.add(particle);
        particlePool.current.push(particle);
    }
    
    const triggerEffect = (position: THREE.Vector3) => {
        hitSound.triggerAttackRelease('C1', '8n');
        if (settings.cameraShake) {
            cameraShake.current = { intensity: 0.1, time: 0.2 };
        }
        let particlesToSpawn = 10;
        for (const particle of particlePool.current) {
            if (!particle.visible && particlesToSpawn > 0) {
                particle.visible = true;
                particle.position.copy(position);
                // @ts-ignore
                particle.velocity.set((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5);
                // @ts-ignore
                particle.lifetime = Math.random() * 0.5 + 0.3;
                // @ts-ignore
                particle.material.opacity = 0.8;
                particlesToSpawn--;
            }
        }
    };

    const ballVelocity = new THREE.Vector3(0, 0, -10);
    const mouse = new THREE.Vector2();
    let localGameState = 'start';
    let localScore = { player: 0, opponent: 0 };
    
    const resetBall = (direction: number) => {
        ball.position.set(0, 1, 0);
        const baseSpeed = 10;
        const speed = baseSpeed * difficultyParams.current.ballSpeedMultiplier;
        const angle = (Math.random() - 0.5) * difficultyParams.current.ballAngleRandomness * Math.PI;
        ballVelocity.z = direction * speed * Math.cos(angle);
        ballVelocity.x = speed * Math.sin(angle);
        ballVelocity.y = 0;
    };
    resetBall(Math.random() > 0.5 ? 1 : -1);

    const onMouseMove = (event: MouseEvent) => {
        setUseMouse(true);
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };
    const onKeyDown = (event: KeyboardEvent) => {
        keysPressed.current[event.key.toLowerCase()] = true;
        setUseMouse(false);
    };
    const onKeyUp = (event: KeyboardEvent) => {
        keysPressed.current[event.key.toLowerCase()] = false;
    };
    const onClick = () => {
        if (localGameState === 'start') {
            localGameState = 'playing';
            setGameState('playing');
        }
    }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('click', onClick);

    const raycaster = new THREE.Raycaster();
    const paddlePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -playerPaddle.position.z);

    let animationFrameId: number;
    const animate = () => {
        animationFrameId = requestAnimationFrame(animate);
        const delta = clock.current.getDelta();

        particleSystem.rotation.y += 0.0002;

        if (localGameState === 'playing') {
            gameTime.current += delta;
            
            if (useMouse) {
                raycaster.setFromCamera(mouse, camera);
                const intersectPoint = new THREE.Vector3();
                raycaster.ray.intersectPlane(paddlePlane, intersectPoint);
                if (intersectPoint) {
                    playerPaddle.position.x = intersectPoint.x;
                }
            } else {
                const paddleSpeed = 10 * delta;
                if (keysPressed.current['a'] || keysPressed.current['arrowleft']) playerPaddle.position.x -= paddleSpeed;
                if (keysPressed.current['d'] || keysPressed.current['arrowright']) playerPaddle.position.x += paddleSpeed;
            }
            playerPaddle.position.x = THREE.MathUtils.clamp(playerPaddle.position.x, -arenaWidth / 2 + 1, arenaWidth / 2 - 1);
            playerPaddle.position.y = 1;
            playerPaddle.scale.x = difficultyParams.current.paddleSizeMultiplier;

            opponentPaddle.position.x += (ball.position.x - opponentPaddle.position.x) * 0.1;
            opponentPaddle.position.x = THREE.MathUtils.clamp(opponentPaddle.position.x, -arenaWidth/2 + 1, arenaWidth/2 - 1);
            opponentPaddle.position.y = 1;
            opponentPaddle.scale.x = difficultyParams.current.paddleSizeMultiplier;

            ball.position.add(ballVelocity.clone().multiplyScalar(delta));
            ball.position.y = 1;

            if (ball.position.x <= -arenaWidth / 2 || ball.position.x >= arenaWidth / 2) {
                ballVelocity.x *= -1;
                triggerEffect(ball.position);
            }
            
            const ballBox = new THREE.Box3().setFromObject(ball);
            const playerBox = new THREE.Box3().setFromObject(playerPaddle);
            const opponentBox = new THREE.Box3().setFromObject(opponentPaddle);

            if (ballVelocity.z > 0 && ballBox.intersectsBox(playerBox)) {
                ballVelocity.z *= -1.05;
                ballVelocity.x += (ball.position.x - playerPaddle.position.x) * 2;
                triggerEffect(ball.position);
            }
            if (ballVelocity.z < 0 && ballBox.intersectsBox(opponentBox)) {
                ballVelocity.z *= -1.05;
                ballVelocity.x += (ball.position.x - opponentPaddle.position.x) * 2;
                triggerEffect(ball.position);
            }
            
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
        
        particlePool.current.forEach(p => {
            if(p.visible) {
                p.position.addScaledVector(p.velocity, delta);
                // @ts-ignore
                p.lifetime -= delta;
                // @ts-ignore
                p.material.opacity = (p.lifetime / 0.8);
                // @ts-ignore
                if (p.lifetime <= 0) p.visible = false;
            }
        });

        const camTarget = new THREE.Vector3();
        if (settings.cameraView === 'first-person') {
            camera.position.x = playerPaddle.position.x * 0.1;
            camera.position.y = 1.2;
            camera.position.z = playerPaddle.position.z + 1.5;
            camTarget.set(playerPaddle.position.x * 0.3, 1, 0);
        } else if (settings.cameraView === 'third-person') {
            camera.position.set(0, 8, arenaDepth / 2 + 6);
            camTarget.set(0, 2, 0);
        } else { // top-down
            camera.position.set(0, 15, 0);
            camTarget.set(0, 0, 0);
        }
        
        if (cameraShake.current.time > 0) {
            cameraShake.current.time -= delta;
            const { intensity } = cameraShake.current;
            camera.position.x += (Math.random() - 0.5) * intensity;
            camera.position.y += (Math.random() - 0.5) * intensity;
            camera.position.z += (Math.random() - 0.5) * intensity;
        }

        camera.lookAt(camTarget);
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
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('click', onClick);
      cancelAnimationFrame(animationFrameId);
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
      particlePool.current = [];
      scene.clear();
      renderer.dispose();
    };
  }, [router, settings, useMouse, updateDifficulty]);

  if (!settings) {
    return (
      <div className="flex h-[calc(100vh-theme(spacing.14))] w-full flex-col items-center justify-center space-y-4 bg-background">
        <Skeleton className="h-1/2 w-4/5" />
        <p className="text-2xl font-bold text-primary animate-pulse">LOADING SETTINGS...</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full cursor-none">
      <div ref={mountRef} className="absolute inset-0 z-0" />
      <HUD playerScore={score.player} opponentScore={score.opponent} gameState={gameState} winner={winner} />
    </div>
  );
};

export default Pong3D;
