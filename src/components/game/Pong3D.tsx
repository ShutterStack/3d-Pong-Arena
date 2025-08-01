
"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import * as Tone from 'tone';
import { useRouter } from 'next/navigation';
import { adjustDifficulty, type DifficultyAdjustmentInput, type DifficultyAdjustmentOutput } from '@/ai/flows/dynamic-difficulty-adjustment';
import HUD from './HUD';
import { Skeleton } from '../ui/skeleton';
import type { Socket } from 'socket.io-client';

const POWERUP_SPAWN_INTERVAL = 10; // in seconds
const POWERUP_DURATION = 8000; // in milliseconds

type GameSettings = {
  cameraView: 'first-person' | 'third-person' | 'top-down';
  cameraShake: boolean;
  masterVolume: number;
  musicVolume: number;
};

type CustomizationSettings = {
  paddleColor: string;
  ballColor: string;
  arenaColor: string;
}

type PowerUpType = 'speedBoost' | 'growPaddle' | 'shrinkOpponent';

type PowerUp = {
  id: number;
  mesh: THREE.Mesh;
  type: PowerUpType;
  active: boolean;
};

type Pong3DProps = {
    mode: 'single' | 'multiplayer';
    socket?: Socket | null;
    gameId?: string | null;
    isHost?: boolean;
    playerName?: string | null;
    opponentName?: string | null;
}

type BallState = {
    position: { x: number, y: number, z: number };
    velocity: { x: number, y: number, z: number };
}

const Pong3D: React.FC<Pong3DProps> = ({ mode, socket, gameId, isHost, playerName, opponentName }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const score = useRef({ player: 0, opponent: 0 });
  const [currentScore, setCurrentScore] = useState({ player: 0, opponent: 0 });
  
  const [gameState, setGameState] = useState<'start' | 'playing' | 'paused' | 'gameOver'>('start');
  const gameStateRef = useRef(gameState);

  const [winner, setWinner] = useState<'player' | 'opponent' | null>(null);
  const [settings, setSettings] = useState<GameSettings | null>(null);
  const [customization, setCustomization] = useState<CustomizationSettings | null>(null);
  
  const gameTime = useRef(0);
  const lastPowerupTime = useRef(0);
  const lastSpeedIncreaseTime = useRef(0);
  const [showSpeedIncreaseText, setShowSpeedIncreaseText] = useState(false);

  const clock = useRef(new THREE.Clock());
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const cameraShake = useRef({ intensity: 0, time: 0 });
  const cameraOrbit = useRef({ phi: Math.PI / 3, theta: 0 });
  const isDragging = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });
  const particlePool = useRef<THREE.Mesh[]>([]);

  // Use an array for power-ups
  const powerUpsRef = useRef<PowerUp[]>([]);

  const music = useRef<Tone.Loop | null>(null);
  const playerPaddleEffectTimeout = useRef<NodeJS.Timeout | null>(null);
  const opponentPaddleEffectTimeout = useRef<NodeJS.Timeout | null>(null);

  const playerPaddleRef = useRef<THREE.Mesh>(null!);
  const opponentPaddleRef = useRef<THREE.Mesh>(null!);
  const ballRef = useRef<THREE.Mesh>(null!);
  const ballVelocityRef = useRef(new THREE.Vector3());
  const authoritativeBallState = useRef<BallState | null>(null);

  const difficultyParams = useRef<DifficultyAdjustmentOutput>({
    ballSpeedMultiplier: 1.0,
    ballAngleRandomness: 0.1,
    paddleSizeMultiplier: 1.0,
    opponentSpeedMultiplier: 1.0,
  });

  const WINNING_SCORE = mode === 'multiplayer' ? 10 : 5;
  
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('pongSettings');
      const defaultSettings = { cameraView: 'first-person', cameraShake: true, masterVolume: 80, musicVolume: 50 };
      setSettings(savedSettings ? JSON.parse(savedSettings) : defaultSettings);

      const savedCustomization = localStorage.getItem('pongCustomization');
      const defaultCustomization = { paddleColor: '#7DF9FF', ballColor: '#FFFFFF', arenaColor: '#7DF9FF' };
      setCustomization(savedCustomization ? JSON.parse(savedCustomization) : defaultCustomization);

    } catch (error) {
      console.error("Could not load settings, using defaults.", error);
    }
  }, []);

  const updateDifficulty = useCallback(async () => {
    if (mode !== 'single') return;
    try {
      const input: DifficultyAdjustmentInput = {
        playerScore: score.current.player,
        opponentScore: score.current.opponent,
        gameTimeElapsed: gameTime.current,
      };
      const newDifficulty = await adjustDifficulty(input);
      difficultyParams.current = newDifficulty;
      
    } catch (error) {
      console.error("Failed to adjust difficulty:", error);
    }
  }, [mode]);

  useEffect(() => {
    if (gameState === 'playing' && mode === 'single' && (score.current.player > 0 || score.current.opponent > 0)) {
        updateDifficulty();
    }
  }, [currentScore, gameState, updateDifficulty, mode]);


  useEffect(() => {
    if (!mountRef.current || !settings || !customization) return;
    const currentMount = mountRef.current;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.025);
    const camera = new THREE.PerspectiveCamera(75, currentMount.clientWidth / currentMount.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.shadowMap.enabled = true;
    currentMount.appendChild(renderer.domElement);

    const arenaWidth = 30;
    const arenaDepth = 50;

    const opponentColor = 0xD400FF;
    const arenaColor = new THREE.Color(customization.arenaColor);

    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(arenaWidth, arenaDepth), 
        new THREE.MeshStandardMaterial({ color: 0x0A0A0A, metalness: 0.2, roughness: 0.8 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    
    const wallMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        metalness: 0.5,
        roughness: 0.7,
    });
    
    const wallHeight = 10;
    const leftWall = new THREE.Mesh( new THREE.BoxGeometry(0.5, wallHeight, arenaDepth), wallMaterial );
    leftWall.position.set(-arenaWidth / 2 - 0.25, wallHeight / 2, 0);
    leftWall.receiveShadow = true;
    scene.add(leftWall);

    const rightWall = new THREE.Mesh( new THREE.BoxGeometry(0.5, wallHeight, arenaDepth), wallMaterial );
    rightWall.position.set(arenaWidth / 2 + 0.25, wallHeight / 2, 0);
    rightWall.receiveShadow = true;
    scene.add(rightWall);

    const grid = new THREE.GridHelper(arenaDepth, 10, arenaColor, arenaColor);
    grid.position.y = 0.01;
    scene.add(grid);
    
    const particleCount = 5000;
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        positions[i3] = (Math.random() - 0.5) * 300;
        positions[i3 + 1] = (Math.random() - 0.5) * 300;
        positions[i3 + 2] = (Math.random() - 0.5) * 300;
    }

    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      size: 0.3, color: arenaColor, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.5, depthWrite: false,
    });
    const particleSystem = new THREE.Points(particles, particleMaterial);
    scene.add(particleSystem);


    const paddleGeometry = new THREE.BoxGeometry(4, 2, 0.4);
    const playerPaddle = new THREE.Mesh(paddleGeometry, new THREE.MeshStandardMaterial({ color: customization.paddleColor, emissive: customization.paddleColor, emissiveIntensity: 0.5 }));
    playerPaddle.position.z = arenaDepth / 2 - 2;
    playerPaddle.position.y = 1;
    playerPaddle.castShadow = true;
    scene.add(playerPaddle);
    playerPaddleRef.current = playerPaddle;

    const opponentPaddle = new THREE.Mesh(paddleGeometry, new THREE.MeshStandardMaterial({ color: opponentColor, emissive: opponentColor, emissiveIntensity: 0.5 }));
    opponentPaddle.position.z = -arenaDepth / 2 + 2;
    opponentPaddle.position.y = 1;
    opponentPaddle.castShadow = true;
    scene.add(opponentPaddle);
    opponentPaddleRef.current = opponentPaddle;


    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.4, 32, 32), new THREE.MeshStandardMaterial({ color: customization.ballColor, emissive: customization.ballColor, emissiveIntensity: 0.8 }));
    ball.castShadow = true;
    ball.position.y = 1;
    scene.add(ball);
    ballRef.current = ball;
    ball.add(new THREE.PointLight(customization.ballColor, 2, 5));
    
    scene.add(new THREE.AmbientLight(0xffffff, 2.0));
    const hemisphereLight = new THREE.HemisphereLight(arenaColor, 0x0A0A0A, 2.5);
    scene.add(hemisphereLight);

    const opponentLight = new THREE.PointLight(opponentColor, 3, 25);
    opponentLight.position.set(0, 5, -arenaDepth / 2);
    scene.add(opponentLight);

    const topLight = new THREE.DirectionalLight(arenaColor, 0.8);
    topLight.position.set(0, 10, 0);
    topLight.castShadow = true;
    scene.add(topLight);
    
    const hitSound = new Tone.MembraneSynth().toDestination();
    const scoreSound = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 1 }, }).toDestination();
    const powerupSound = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.5 } }).toDestination();
    
    Tone.Master.volume.value = Tone.gainToDb(settings.masterVolume / 100);

    const musicSynth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'fmsine' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 1 } }).toDestination();
    musicSynth.volume.value = Tone.gainToDb(settings.musicVolume / 100) - 15; // Music quieter
    const pattern = new Tone.Pattern((time, note) => {
        musicSynth.triggerAttackRelease(note, '8n', time);
    }, ["C3", "E3", "G3", "B3"], "randomWalk");
    pattern.interval = "4n";
    
    music.current = new Tone.Loop(time => {
        pattern.start(time).stop(time + 2);
    }, "2m");
    Tone.Transport.bpm.value = 90;
    
    particlePool.current = [];
    const pGeometry = new THREE.SphereGeometry(0.05, 8, 8);
    const pMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
    for (let i = 0; i < 100; i++) {
        const particle = new THREE.Mesh(pGeometry, pMaterial.clone());
        particle.visible = false;
        (particle as any).velocity = new THREE.Vector3();
        (particle as any).lifetime = 0;
        scene.add(particle);
        particlePool.current.push(particle);
    }
    
    const triggerEffect = (position: THREE.Vector3, color: THREE.Color | number = 0xffffff) => {
        hitSound.triggerAttackRelease('C1', '8n');
        if (settings.cameraShake) {
            cameraShake.current = { intensity: 0.1, time: 0.2 };
        }
        let particlesToSpawn = 10;
        for (const p of particlePool.current) {
            if (!p.visible && particlesToSpawn > 0) {
                p.visible = true;
                p.position.copy(position);
                (p.material as THREE.MeshBasicMaterial).color.set(color);
                (p as any).velocity.set((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5);
                (p as any).lifetime = Math.random() * 0.5 + 0.3;
                (p.material as THREE.Material).opacity = 0.8;
                particlesToSpawn--;
            }
        }
    };

    const ballVelocity = ballVelocityRef.current;
    
    const resetBall = (direction: number) => {
        ball.position.set(0, 1, 0);
        const baseSpeed = 15;
        const speed = baseSpeed * (mode === 'single' ? difficultyParams.current.ballSpeedMultiplier : 1);
        const angle = (Math.random() - 0.5) * (mode === 'single' ? difficultyParams.current.ballAngleRandomness * Math.PI : 0.2 * Math.PI);
        ballVelocity.set(speed * Math.sin(angle), 0, direction * speed * Math.cos(angle));

        if (mode === 'multiplayer' && isHost) {
            socket?.emit('ballSync', { gameId, ballState: { position: ball.position, velocity: ballVelocity } });
        }
    };
    resetBall(Math.random() > 0.5 ? 1 : -1);

    const onMouseDown = (event: MouseEvent) => {
        if (gameStateRef.current === 'playing' || gameStateRef.current === 'start') {
            isDragging.current = true;
            previousMousePosition.current = { x: event.clientX, y: event.clientY };
        }
    };
    const onMouseUp = () => {
        isDragging.current = false;
    };
    const onMouseLeave = () => {
        isDragging.current = false;
    };

    const onMouseMove = (event: MouseEvent) => {
        if (gameStateRef.current !== 'playing') return;
        if (document.pointerLockElement === currentMount) { // First person
            const movementX = event.movementX || 0;
            cameraOrbit.current.theta -= movementX * 0.002;
        } else if (isDragging.current) { // Third person drag
            const deltaX = event.clientX - previousMousePosition.current.x;
            cameraOrbit.current.theta -= deltaX * 0.005;
            previousMousePosition.current = { x: event.clientX, y: event.clientY };
        }
    };

    const onKeyDown = (event: KeyboardEvent) => { keysPressed.current[event.key.toLowerCase()] = true; };
    const onKeyUp = (event: KeyboardEvent) => { keysPressed.current[event.key.toLowerCase()] = false; };
    
    const onClick = () => {
        if (gameStateRef.current === 'start' && currentMount) {
            setGameState('playing');
            if (settings.cameraView === 'first-person') {
                try { currentMount.requestPointerLock() } catch (e) { console.warn("Could not request pointer lock:", e) }
            }
        }
    }
    
    currentMount.addEventListener('mousedown', onMouseDown);
    currentMount.addEventListener('mouseup', onMouseUp);
    currentMount.addEventListener('mouseleave', onMouseLeave);
    document.addEventListener('mousemove', onMouseMove);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    currentMount.addEventListener('click', onClick);

    let animationFrameId: number;
    const animate = () => {
        animationFrameId = requestAnimationFrame(animate);
        const delta = clock.current.getDelta();

        particleSystem.rotation.y += 0.0002;

        for (const p of powerUpsRef.current) {
            if (p.active) {
                p.mesh.rotation.y += delta;
                p.mesh.rotation.x += delta;
            }
        }

        if (gameStateRef.current === 'playing') {
            gameTime.current += delta;
            
            if (Tone.Transport.state !== 'started') {
                Tone.Transport.start();
                music.current?.start(0);
            }

            const paddleSpeed = 20 * delta;
            if (keysPressed.current['a'] || keysPressed.current['arrowleft']) playerPaddle.position.x -= paddleSpeed;
            if (keysPressed.current['d'] || keysPressed.current['arrowright']) playerPaddle.position.x += paddleSpeed;

            const playerHalfWidth = playerPaddle.geometry.parameters.width * playerPaddle.scale.x / 2;
            playerPaddle.position.x = THREE.MathUtils.clamp(playerPaddle.position.x, -arenaWidth / 2 + playerHalfWidth, arenaWidth / 2 - playerHalfWidth);

            if (mode === 'multiplayer' && socket?.connected) {
                socket.emit('paddleMove', { gameId, position: playerPaddle.position.x });
            }

            const isPhysicsHost = mode === 'single' || (mode === 'multiplayer' && isHost);
            
            if (isPhysicsHost) {
                if (mode === 'single') {
                     // AI Opponent Logic
                    if (!opponentPaddleEffectTimeout.current) opponentPaddle.scale.x = difficultyParams.current.paddleSizeMultiplier;
                    const opponentSpeed = 0.12 * difficultyParams.current.opponentSpeedMultiplier;
                    opponentPaddle.position.x += (ball.position.x - opponentPaddle.position.x) * opponentSpeed;
                }
               
                const opponentHalfWidth = opponentPaddle.geometry.parameters.width * opponentPaddle.scale.x / 2;
                opponentPaddle.position.x = THREE.MathUtils.clamp(opponentPaddle.position.x, -arenaWidth/2 + opponentHalfWidth, arenaWidth/2 - opponentHalfWidth);

                ball.position.add(ballVelocity.clone().multiplyScalar(delta));

                // Ball collision with walls
                if (ball.position.x <= -arenaWidth / 2 + 0.4 || ball.position.x >= arenaWidth / 2 - 0.4) {
                    ballVelocity.x *= -1;
                    triggerEffect(ball.position);
                }
                
                // Ball collision with paddles
                const ballBox = new THREE.Box3().setFromObject(ball);
                const playerBox = new THREE.Box3().setFromObject(playerPaddle);
                const opponentBox = new THREE.Box3().setFromObject(opponentPaddle);

                if (ballVelocity.z > 0 && ballBox.intersectsBox(playerBox)) {
                    ballVelocity.z *= -1.05;
                    ballVelocity.x += (ball.position.x - playerPaddle.position.x) * 2;
                    triggerEffect(ball.position, new THREE.Color(customization.paddleColor));
                }
                if (ballVelocity.z < 0 && ballBox.intersectsBox(opponentBox)) {
                    ballVelocity.z *= -1.05;
                    ballVelocity.x += (ball.position.x - opponentPaddle.position.x) * 2;
                    triggerEffect(ball.position, new THREE.Color(opponentColor));
                }

                 // Sync ball for multiplayer guests
                if (mode === 'multiplayer' && socket?.connected) {
                    socket.emit('ballSync', { gameId, ballState: { position: ball.position, velocity: ballVelocity } });
                }

                 // Score Logic
                if (ball.position.z > arenaDepth / 2) { // Opponent scores
                    score.current.opponent++;
                    if (mode === 'multiplayer' && socket?.connected) socket.emit('scoreUpdate', { gameId, score: score.current });
                    scoreSound.triggerAttackRelease('A4', '8n');
                    resetBall(-1);
                }
                if (ball.position.z < -arenaDepth / 2) { // Player scores
                    score.current.player++;
                    if (mode === 'multiplayer' && socket?.connected) socket.emit('scoreUpdate', { gameId, score: score.current });
                    scoreSound.triggerAttackRelease('C5', '8n');
                    resetBall(1);
                }
                setCurrentScore({...score.current});

                // Host-side Power-up & Speed logic
                if (gameTime.current - lastSpeedIncreaseTime.current > 15) {
                    ballVelocity.multiplyScalar(1.1);
                    lastSpeedIncreaseTime.current = gameTime.current;
                    setShowSpeedIncreaseText(true);
                    setTimeout(() => setShowSpeedIncreaseText(false), 2000);
                    if (mode === 'multiplayer') {
                        socket?.emit('speedIncrease', { gameId, ballVelocity });
                    }
                }

                if (!powerUpsRef.current.some(p => p.active) && gameTime.current - lastPowerupTime.current > POWERUP_SPAWN_INTERVAL) {
                    const powerupTypes: PowerUpType[] = ['speedBoost', 'growPaddle', 'shrinkOpponent'];
                    const type = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
                    const id = Date.now();
                    const powerupData = {
                        id,
                        type,
                        position: {
                            x: (Math.random() - 0.5) * (arenaWidth - 10),
                            y: 1,
                            z: (Math.random() - 0.5) * (arenaDepth - 20)
                        }
                    };
                    
                    if (mode === 'multiplayer') {
                        socket?.emit('powerupSpawn', { gameId, powerup: powerupData });
                    }
                    // Spawn for host too
                    spawnPowerUp(powerupData.id, powerupData.type, new THREE.Vector3(powerupData.position.x, powerupData.position.y, powerupData.position.z));
                    lastPowerupTime.current = gameTime.current;
                }
                 // Host checks for powerup collection
                for (const p of powerUpsRef.current) {
                    if (p.active) {
                        const ballBoxPowerup = new THREE.Box3().setFromObject(ball);
                        const powerupBox = new THREE.Box3().setFromObject(p.mesh);
                        if (ballBoxPowerup.intersectsBox(powerupBox)) {
                            // The host determines who collected it based on ball direction
                             const collectorSocketId = ballVelocity.z < 0 ? playerPaddleRef.current.uuid : opponentPaddleRef.current.uuid; // Simplified, UUID is not socketID. Needs real ID.
                             const collector = ballVelocity.z < 0 ? socket?.id : 'opponent';
                             
                             if(mode === 'multiplayer'){
                                socket?.emit('powerupCollect', { gameId, type: p.type, id: p.id });
                             }
                             collectPowerUp(p.id, p.type); // Host collects it
                        }
                    }
                }

            } else { // Client-side ball interpolation for multiplayer guests
                ball.position.add(ballVelocity.clone().multiplyScalar(delta));
    
                if (authoritativeBallState.current) {
                    const serverPos = new THREE.Vector3().copy(authoritativeBallState.current.position as THREE.Vector3);
                    ball.position.lerp(serverPos, 0.25);
                    const serverVel = new THREE.Vector3().copy(authoritativeBallState.current.velocity as THREE.Vector3);
                    ballVelocity.lerp(serverVel, 0.25);
                }
            }


            if (score.current.player >= WINNING_SCORE || score.current.opponent >= WINNING_SCORE) {
                if (document.pointerLockElement) document.exitPointerLock();
                setGameState('gameOver');
                const winnerId = score.current.player >= WINNING_SCORE ? 'player' : 'opponent';
                setWinner(winnerId);
                
                if (mode === 'multiplayer' && isHost && socket?.connected) {
                    socket.emit('gameOver', { gameId, winnerId: socket.id });
                }
                
                router.push(`/game-over?winner=${winnerId}&playerScore=${score.current.player}&opponentScore=${score.current.opponent}&mode=${mode}`);
                return;
            }
        } else {
            if (Tone.Transport.state === 'started') {
                 music.current?.stop();
                 Tone.Transport.stop();
            }
        }
        
        particlePool.current.forEach(p => {
            if(p.visible) {
                p.position.addScaledVector((p as any).velocity, delta);
                (p as any).lifetime -= delta;
                (p.material as THREE.Material).opacity = ((p as any).lifetime / 0.8);
                if ((p as any).lifetime <= 0) p.visible = false;
            }
        });
        
        if (settings.cameraView === 'first-person') {
            const pivotPoint = playerPaddle.position.clone();
            pivotPoint.y = 1.5; 
            camera.position.copy(pivotPoint);
            camera.rotation.set(0, 0, 0, 'YXZ');
            camera.rotateY(cameraOrbit.current.theta);
            camera.rotateX(cameraOrbit.current.phi - Math.PI / 2);
            leftWall.visible = true;
            rightWall.visible = true;

        } else if (settings.cameraView === 'third-person') {
            const offset = new THREE.Vector3(0, 7, 12);
            offset.applyAxisAngle(new THREE.Vector3(0,1,0), cameraOrbit.current.theta);
            camera.position.copy(playerPaddle.position).add(offset);
            camera.lookAt(playerPaddle.position);
            leftWall.visible = false;
            rightWall.visible = false;

        } else { // top-down
            camera.position.set(0, 40, 0);
            camera.lookAt(new THREE.Vector3(0, 0, 0));
            leftWall.visible = true;
            rightWall.visible = true;
        }
        
        if (cameraShake.current.time > 0) {
            cameraShake.current.time -= delta;
            const { intensity } = cameraShake.current;
            camera.position.x += (Math.random() - 0.5) * intensity;
            camera.position.y += (Math.random() - 0.5) * intensity;
            camera.position.z += (Math.random() - 0.5) * intensity;
        }

        renderer.render(scene, camera);
    };

    const powerupGeo = new THREE.IcosahedronGeometry(0.8, 1);
    const powerupMaterials = {
        speedBoost: new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffd700, emissiveIntensity: 1, transparent: true, opacity: 0.9 }),
        growPaddle: new THREE.MeshStandardMaterial({ color: 0x007bff, emissive: 0x007bff, emissiveIntensity: 1, transparent: true, opacity: 0.9 }),
        shrinkOpponent: new THREE.MeshStandardMaterial({ color: 0x6f42c1, emissive: 0x6f42c1, emissiveIntensity: 1, transparent: true, opacity: 0.9 }),
    };

    const spawnPowerUp = (id: number, type: PowerUpType, position: THREE.Vector3) => {
        const material = powerupMaterials[type];
        const mesh = new THREE.Mesh(powerupGeo, material);
        mesh.position.copy(position);
        mesh.castShadow = true;

        const powerUp: PowerUp = { id, mesh, type, active: true };
        powerUpsRef.current.push(powerUp);
        scene.add(mesh);
    };

    const collectPowerUp = (id: number, type: PowerUpType, collectorId?: string) => {
        const powerUpIndex = powerUpsRef.current.findIndex(p => p.id === id);
        if (powerUpIndex === -1) return;

        const powerUp = powerUpsRef.current[powerUpIndex];
        powerupSound.triggerAttackRelease("C5", "8n");
        triggerEffect(powerUp.mesh.position, (powerUp.mesh.material as THREE.MeshStandardMaterial).color);

        if (type === 'speedBoost') {
            ballVelocityRef.current.multiplyScalar(1.5);
        } else if (type === 'growPaddle') {
            const paddleToGrow = socket?.id === collectorId ? playerPaddleRef.current : opponentPaddleRef.current;
            if(playerPaddleEffectTimeout.current) clearTimeout(playerPaddleEffectTimeout.current);
            paddleToGrow.scale.x = 1.5;
            playerPaddleEffectTimeout.current = setTimeout(() => {
                paddleToGrow.scale.x = 1.0;
                playerPaddleEffectTimeout.current = null;
            }, POWERUP_DURATION);
        } else if (type === 'shrinkOpponent') {
            const paddleToShrink = socket?.id === collectorId ? opponentPaddleRef.current : playerPaddleRef.current;
            if(opponentPaddleEffectTimeout.current) clearTimeout(opponentPaddleEffectTimeout.current);
            paddleToShrink.scale.x = 0.5;
            opponentPaddleEffectTimeout.current = setTimeout(() => {
               paddleToShrink.scale.x = 1.0;
               opponentPaddleEffectTimeout.current = null;
            }, POWERUP_DURATION);
        }

        scene.remove(powerUp.mesh);
        powerUpsRef.current.splice(powerUpIndex, 1);
    }
    
    animate();

    const handleResize = () => {
        camera.aspect = currentMount.clientWidth / currentMount.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    const onPointerLockChange = () => {
      const isLocked = document.pointerLockElement === currentMount;
      if (!isLocked && gameStateRef.current === 'playing' && gameTime.current > 0.1 && settings.cameraView === 'first-person') {
          setGameState('paused');
          if (mode === 'multiplayer' && socket) {
            socket.emit('pause', { gameId });
          }
      }
    };
    document.addEventListener('pointerlockchange', onPointerLockChange, false);
    
    // Multiplayer socket event listeners
    if (mode === 'multiplayer' && socket) {
        socket.on('opponentMoved', (position: number) => {
            if (opponentPaddleRef.current) {
                 if (isHost) {
                    // For host, guest paddle is opponent
                    opponentPaddleRef.current.position.x = position;
                } else {
                    // For guest, host paddle is opponent. Guest paddle is controlled by guest.
                    opponentPaddleRef.current.position.x = position;
                }
            }
        });

        socket.on('ballSynced', (ballState: BallState) => {
            if (!isHost) {
                authoritativeBallState.current = ballState;
            }
        });

        socket.on('scoreUpdated', (newScore: { player: number, opponent: number }) => {
            if(isHost) {
              score.current = newScore;
            } else {
              score.current = { player: newScore.opponent, opponent: newScore.player };
            }
            setCurrentScore({ ...score.current });
        });

        socket.on('speedIncreased', (newVelocity: { x: number, y: number, z: number }) => {
            if (!isHost) {
                ballVelocityRef.current.set(newVelocity.x, newVelocity.y, newVelocity.z);
                setShowSpeedIncreaseText(true);
                setTimeout(() => setShowSpeedIncreaseText(false), 2000);
            }
        });

        socket.on('powerupSpawned', (powerup: { id: number, type: PowerUpType, position: {x:number, y:number, z:number} }) => {
             if (!isHost) {
                spawnPowerUp(powerup.id, powerup.type, new THREE.Vector3(powerup.position.x, powerup.position.y, powerup.position.z));
            }
        });

        socket.on('powerupCollected', ({ id, type, collectorId }: { id: number, type: PowerUpType, collectorId: string }) => {
            // Both host and guest will receive this to apply effect
            collectPowerUp(id, type, collectorId);
        });
        
        socket.on('opponentPaused', () => {
            setGameState('paused');
        });

        socket.on('opponentResumed', () => {
            setGameState('playing');
        });

        socket.on('gameOver', ({ winnerId }) => {
            if (document.pointerLockElement) document.exitPointerLock();
            setGameState('gameOver');
            
            const finalWinner = winnerId === socket.id ? 'player' : 'opponent';
            setWinner(finalWinner);

            router.push(`/game-over?winner=${finalWinner}&playerScore=${score.current.player}&opponentScore=${score.current.opponent}&mode=multiplayer`);
        });
        
        socket.on('opponentDisconnected', () => {
            if(gameStateRef.current === 'gameOver') return;
            setGameState('gameOver');
            setWinner('player');
            alert('Opponent disconnected. You win!');
            router.push(`/game-over?winner=player&playerScore=${score.current.player}&opponentScore=${score.current.opponent}&mode=multiplayer`);
        });
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      currentMount.removeEventListener('click', onClick);
      currentMount.removeEventListener('mousedown', onMouseDown);
      currentMount.removeEventListener('mouseup', onMouseUp);
      currentMount.removeEventListener('mouseleave', onMouseLeave);
      document.removeEventListener('pointerlockchange', onPointerLockChange, false);
      if (document.pointerLockElement === currentMount) {
        document.exitPointerLock();
      }
      if(music.current) {
        music.current.stop();
        music.current.dispose();
      }
      if(playerPaddleEffectTimeout.current) clearTimeout(playerPaddleEffectTimeout.current);
      if(opponentPaddleEffectTimeout.current) clearTimeout(opponentPaddleEffectTimeout.current);
      Tone.Transport.stop();
      Tone.Transport.cancel();
      cancelAnimationFrame(animationFrameId);
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
      if (socket) {
        socket.off('opponentMoved');
        socket.off('ballSynced');
        socket.off('scoreUpdated');
        socket.off('gameOver');
        socket.off('opponentDisconnected');
        socket.off('opponentPaused');
        socket.off('opponentResumed');
        socket.off('speedIncreased');
        socket.off('powerupSpawned');
        socket.off('powerupCollected');
      }
      scene.clear();
      renderer.dispose();
    };
  }, [router, settings, customization, updateDifficulty, mode, socket, gameId, isHost, WINNING_SCORE, playerName, opponentName]);

  if (!settings || !customization) {
    return (
      <div className="flex h-[calc(100vh-theme(spacing.14))] w-full flex-col items-center justify-center space-y-4 bg-background">
        <Skeleton className="h-1/2 w-4/5" />
        <p className="text-2xl font-bold text-primary animate-pulse">LOADING ASSETS...</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={mountRef} className="absolute inset-0 z-0" />
      <HUD 
        playerScore={currentScore.player} 
        opponentScore={currentScore.opponent} 
        gameState={gameState} 
        winner={winner}
        playerName={playerName || 'Player'}
        opponentName={opponentName || 'Opponent'}
       />
        {showSpeedIncreaseText && (
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                <h1 className="text-5xl font-bold text-primary animate-emerge drop-shadow-[0_5px_15px_rgba(var(--primary-hsl),0.8)]">
                    SPEED INCREASE
                </h1>
            </div>
        )}
      {gameState === 'paused' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 pointer-events-auto" onClick={() => {
            if (mountRef.current) {
                if (settings.cameraView === 'first-person') {
                    try { 
                        mountRef.current.requestPointerLock();
                    } catch (e) { 
                        console.warn("Could not re-lock pointer:", e);
                    }
                }
            }
            setGameState('playing');
            if (mode === 'multiplayer' && socket) {
              socket.emit('resume', { gameId });
            }
        }}>
             <div className="text-center bg-black/50 p-6 rounded-lg">
                <h1 className="text-4xl font-bold text-white">Paused</h1>
                <p className="text-muted-foreground">Click to resume</p>
            </div>
        </div>
      )}
    </div>
  );
};

export default Pong3D;
