
"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import * as Tone from 'tone';
import { useRouter } from 'next/navigation';
import { adjustDifficulty, type DifficultyAdjustmentInput, type DifficultyAdjustmentOutput } from '@/ai/flows/dynamic-difficulty-adjustment';
import HUD from './HUD';
import { Skeleton } from '../ui/skeleton';
import { getPlayerId } from '@/lib/player';
import { onGameUpdate, updatePlayerPaddle, updateBall, updateScore, GameData, updateGameState } from '@/services/gameService';
import type { Unsubscribe } from 'firebase/firestore';


const WINNING_SCORE = 5;

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

const Pong3D = ({ gameId }: { gameId: string }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const [playerId, setPlayerId] = useState('');
  const [gameData, setGameData] = useState<GameData | null>(null);
  const gameDataRef = useRef(gameData);

  const [score, setScore] = useState({ player: 0, opponent: 0 });
  const scoreRef = useRef(score);

  const [gameState, setGameState] = useState<'start' | 'playing' | 'paused' | 'gameOver'>('start');
  const gameStateRef = useRef(gameState);

  const [winner, setWinner] = useState<'player' | 'opponent' | null>(null);
  const [settings, setSettings] = useState<GameSettings | null>(null);
  const [customization, setCustomization] = useState<CustomizationSettings | null>(null);
  
  const isMultiplayer = gameId !== 'single-player';
  const isHost = useRef(false);

  const gameTime = useRef(0);
  const clock = useRef(new THREE.Clock());
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const cameraShake = useRef({ intensity: 0, time: 0 });
  const cameraOrbit = useRef({ phi: Math.PI / 2, theta: 0 });
  const particlePool = useRef<THREE.Mesh[]>([]);

  const difficultyParams = useRef<DifficultyAdjustmentOutput>({
    ballSpeedMultiplier: 1.0,
    ballAngleRandomness: 0.1,
    paddleSizeMultiplier: 1.0,
  });

  useEffect(() => {
    gameDataRef.current = gameData;
    if (gameData && playerId) {
      isHost.current = gameData.players.player1.id === playerId;
      
      const localPlayerKey = gameData.players.player1.id === playerId ? 'player1' : 'player2';
      const opponentKey = gameData.players.player1.id === playerId ? 'player2' : 'player1';

      if(gameData.score[localPlayerKey] !== undefined) {
         setScore({
          player: gameData.score[localPlayerKey],
          opponent: gameData.score[opponentKey] ?? 0,
        });
      }

      if (gameData.state !== gameStateRef.current && gameData.state !== 'waiting') {
        setGameState(gameData.state);
        if(gameData.state === 'playing' && document.pointerLockElement !== mountRef.current){
             try { mountRef.current?.requestPointerLock() } catch (e) { console.warn("Could not re-lock pointer:", e) }
        }
      }
    }
  }, [gameData, playerId]);
  
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);
  
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);


  useEffect(() => {
    setPlayerId(getPlayerId());
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

  useEffect(() => {
    if (!isMultiplayer || !gameId || !playerId) return;
    
    let unsubscribe: Unsubscribe;
    try {
      unsubscribe = onGameUpdate(gameId, (data) => {
        if (!gameDataRef.current) { // First load
           isHost.current = data.players.player1.id === playerId;
        }
        setGameData(data);
      });
    } catch(error) {
      console.error("Error subscribing to game updates:", error);
      router.push('/');
    }
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [isMultiplayer, gameId, router, playerId]);

  const updateDifficulty = useCallback(async () => {
    if (isMultiplayer) return;
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
  }, [score.player, score.opponent, isMultiplayer]);

  useEffect(() => {
    if (gameState === 'playing' && (score.player > 0 || score.opponent > 0)) {
        updateDifficulty();
    }
  }, [score, gameState, updateDifficulty]);


  useEffect(() => {
    if (!mountRef.current || !settings || !customization || !playerId) return;
    const currentMount = mountRef.current;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.025);
    const camera = new THREE.PerspectiveCamera(75, currentMount.clientWidth / currentMount.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.shadowMap.enabled = true;
    currentMount.appendChild(renderer.domElement);

    const arenaWidth = 30;
    const arenaHeight = 18;
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
    
    const wallMaterial = new THREE.MeshStandardMaterial({ color: arenaColor, emissive: arenaColor, emissiveIntensity: 0.2, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
    const sideWallGeometry = new THREE.BoxGeometry(0.2, arenaHeight, arenaDepth);

    const wallLeft = new THREE.Mesh(sideWallGeometry, wallMaterial);
    wallLeft.position.x = -arenaWidth / 2;
    wallLeft.position.y = arenaHeight / 2;
    scene.add(wallLeft);
    
    const wallRight = new THREE.Mesh(sideWallGeometry, wallMaterial);
    wallRight.position.x = arenaWidth / 2;
    wallRight.position.y = arenaHeight / 2;
    scene.add(wallRight);

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
      size: 0.3,
      color: arenaColor,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    const particleSystem = new THREE.Points(particles, particleMaterial);
    scene.add(particleSystem);


    const paddleGeometry = new THREE.BoxGeometry(4, 2, 0.4);
    const playerPaddle = new THREE.Mesh(paddleGeometry, new THREE.MeshStandardMaterial({ color: customization.paddleColor, emissive: customization.paddleColor, emissiveIntensity: 0.5 }));
    playerPaddle.position.z = arenaDepth / 2 - 2;
    playerPaddle.position.y = 1;
    playerPaddle.castShadow = true;
    scene.add(playerPaddle);

    const opponentPaddle = new THREE.Mesh(paddleGeometry, new THREE.MeshStandardMaterial({ color: opponentColor, emissive: opponentColor, emissiveIntensity: 0.5 }));
    opponentPaddle.position.z = -arenaDepth / 2 + 2;
    opponentPaddle.position.y = 1;
    opponentPaddle.castShadow = true;
    scene.add(opponentPaddle);

    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.4, 32, 32), new THREE.MeshStandardMaterial({ color: customization.ballColor, emissive: customization.ballColor, emissiveIntensity: 0.8 }));
    ball.castShadow = true;
    ball.position.y = 1;
    scene.add(ball);
    ball.add(new THREE.PointLight(customization.ballColor, 2, 5));

    scene.add(new THREE.AmbientLight(0xffffff, 0.2));
    const topLight = new THREE.DirectionalLight(arenaColor, 0.5);
    topLight.position.set(0, 10, 0);
    topLight.castShadow = true;
    scene.add(topLight);
    
    const hitSound = new Tone.MembraneSynth().toDestination();
    const scoreSound = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 1 }, }).toDestination();
    Tone.Master.volume.value = Tone.gainToDb(settings.masterVolume / 100);

    const pGeometry = new THREE.SphereGeometry(0.05, 8, 8);
    const pMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
    particlePool.current = []; // Clear before populating
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
        for (const p of particlePool.current) {
            if (!p.visible && particlesToSpawn > 0) {
                p.visible = true;
                p.position.copy(position);
                // @ts-ignore
                p.velocity.set((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5);
                // @ts-ignore
                p.lifetime = Math.random() * 0.5 + 0.3;
                // @ts-ignore
                p.material.opacity = 0.8;
                particlesToSpawn--;
            }
        }
    };

    const ballVelocity = new THREE.Vector3(0, 0, -15);
    
    const resetBall = (direction: number) => {
        ball.position.set(0, 1, 0);
        const baseSpeed = 15;
        const speed = baseSpeed * difficultyParams.current.ballSpeedMultiplier;
        const angle = (Math.random() - 0.5) * difficultyParams.current.ballAngleRandomness * Math.PI;

        ballVelocity.set(speed * Math.sin(angle), 0, direction * speed * Math.cos(angle));

        if (isMultiplayer && isHost.current) {
          updateBall(gameId, {
            x: ball.position.x, y: ball.position.y, z: ball.position.z,
            vx: ballVelocity.x, vy: ballVelocity.y, vz: ballVelocity.z,
          });
        }
    };
    resetBall(Math.random() > 0.5 ? 1 : -1);

    const onMouseMove = (event: MouseEvent) => {
        if (gameStateRef.current !== 'playing') return;
        const movementX = event.movementX || 0;
        const movementY = event.movementY || 0;
        cameraOrbit.current.theta -= movementX * 0.002;
        cameraOrbit.current.phi -= movementY * 0.002;
        cameraOrbit.current.phi = THREE.MathUtils.clamp(cameraOrbit.current.phi, 0.1, Math.PI - 0.1);
    };
    const onKeyDown = (event: KeyboardEvent) => {
        keysPressed.current[event.key.toLowerCase()] = true;
    };
    const onKeyUp = (event: KeyboardEvent) => {
        keysPressed.current[event.key.toLowerCase()] = false;
    };
    const onClick = () => {
        if (gameStateRef.current === 'start') {
            const requestLock = () => {
                try { mountRef.current?.requestPointerLock() } catch (e) { console.warn("Could not request pointer lock:", e) }
            };

            if (isMultiplayer) {
              if (gameDataRef.current?.players.player1 && gameDataRef.current?.players.player2) {
                 if (isHost.current) { // Only host starts game
                    updateGameState(gameId, 'playing');
                 }
                 requestLock();
              }
            } else {
              setGameState('playing');
              requestLock();
            }
        }
    }
    
    document.addEventListener('mousemove', onMouseMove);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    currentMount.addEventListener('click', onClick);


    let animationFrameId: number;
    const animate = () => {
        animationFrameId = requestAnimationFrame(animate);
        const delta = clock.current.getDelta();
        const currentGamedata = gameDataRef.current;

        particleSystem.rotation.y += 0.0002;

        if (gameStateRef.current === 'playing') {
            gameTime.current += delta;
            
            const paddleSpeed = 20 * delta;
            if (keysPressed.current['a'] || keysPressed.current['arrowleft']) playerPaddle.position.x -= paddleSpeed;
            if (keysPressed.current['d'] || keysPressed.current['arrowright']) playerPaddle.position.x += paddleSpeed;

            playerPaddle.position.x = THREE.MathUtils.clamp(playerPaddle.position.x, -arenaWidth / 2 + 2, arenaWidth / 2 - 2);
            playerPaddle.scale.x = difficultyParams.current.paddleSizeMultiplier;

            if (isMultiplayer && currentGamedata) {
              const localPlayerKey = isHost.current ? 'player1' : 'player2';
              const opponentKey = isHost.current ? 'player2' : 'player1';

              updatePlayerPaddle(gameId, localPlayerKey, { x: playerPaddle.position.x });
              
              if (currentGamedata.paddles && currentGamedata.paddles[opponentKey]) {
                opponentPaddle.position.x = currentGamedata.paddles[opponentKey].x;
              }
              
              if (isHost.current) {
                 ball.position.add(ballVelocity.clone().multiplyScalar(delta));
                 updateBall(gameId, {
                    x: ball.position.x, y: ball.position.y, z: ball.position.z,
                    vx: ballVelocity.x, vy: ballVelocity.y, vz: ballVelocity.z,
                });
              } else if (currentGamedata.ball) {
                ball.position.set(currentGamedata.ball.x, currentGamedata.ball.y, currentGamedata.ball.z);
                ballVelocity.set(currentGamedata.ball.vx, currentGamedata.ball.vy, currentGamedata.ball.vz);
              }
            } else { // Single player
              opponentPaddle.position.x += (ball.position.x - opponentPaddle.position.x) * 0.1;
              opponentPaddle.position.x = THREE.MathUtils.clamp(opponentPaddle.position.x, -arenaWidth/2 + 2, arenaWidth/2 - 2);
              opponentPaddle.scale.x = difficultyParams.current.paddleSizeMultiplier;
              ball.position.add(ballVelocity.clone().multiplyScalar(delta));
            }

            if (ball.position.x <= -arenaWidth / 2 + 0.4 || ball.position.x >= arenaWidth / 2 - 0.4) {
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
            
            if (isHost.current || !isMultiplayer) {
                if (ball.position.z > arenaDepth / 2) { // Opponent scores
                    const newPlayerScore = isMultiplayer ? currentGamedata!.score.player1 : scoreRef.current.player;
                    const newOpponentScore = (isMultiplayer ? currentGamedata!.score.player2 : scoreRef.current.opponent) + 1;
                    if (isMultiplayer && isHost.current) updateScore(gameId, { player1: newPlayerScore, player2: newOpponentScore });
                    else setScore({player: newPlayerScore, opponent: newOpponentScore});
                    scoreSound.triggerAttackRelease('A4', '8n');
                    resetBall(-1);
                }
                if (ball.position.z < -arenaDepth / 2) { // Player scores
                    const newPlayerScore = (isMultiplayer ? currentGamedata!.score.player1 : scoreRef.current.player) + 1;
                    const newOpponentScore = isMultiplayer ? currentGamedata!.score.player2 : scoreRef.current.opponent;
                    if (isMultiplayer && isHost.current) updateScore(gameId, { player1: newPlayerScore, player2: newOpponentScore });
                    else setScore({player: newPlayerScore, opponent: newOpponentScore});
                    scoreSound.triggerAttackRelease('C5', '8n');
                    resetBall(1);
                }
            }

            const finalScore = scoreRef.current;
            if (finalScore.player >= WINNING_SCORE || finalScore.opponent >= WINNING_SCORE) {
                const gameWinner = finalScore.player >= WINNING_SCORE ? (isHost.current ? 'player' : 'opponent') : (isHost.current ? 'opponent' : 'player');
                
                if (document.pointerLockElement) document.exitPointerLock();

                if(isMultiplayer && isHost.current){
                    updateGameState(gameId, 'gameOver');
                }
                setGameState('gameOver');
                
                router.push(`/game-over?winner=${finalScore.player >= WINNING_SCORE ? 'player' : 'opponent'}&playerScore=${finalScore.player}&opponentScore=${finalScore.opponent}`);
                return;
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
            const pivotPoint = playerPaddle.position.clone();
            pivotPoint.y = 1.5; 
            camera.position.copy(pivotPoint);
            camera.rotation.set(0, 0, 0, 'YXZ');
            camera.rotateY(cameraOrbit.current.theta);
            camera.rotateX(cameraOrbit.current.phi - Math.PI / 2);

        } else if (settings.cameraView === 'third-person') {
            camera.position.set(0, 20, arenaDepth / 2 + 15);
            camTarget.set(0, 0, 0);
            camera.lookAt(camTarget);
        } else { // top-down
            camera.position.set(0, 40, 0);
            camTarget.set(0, 0, 0);
            camera.lookAt(camTarget);
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

    animate();

    const handleResize = () => {
        camera.aspect = currentMount.clientWidth / currentMount.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    const onPointerLockChange = () => {
      const isLocked = document.pointerLockElement === currentMount;
      if (!isLocked && gameStateRef.current === 'playing' && gameTime.current > 0.1) {
          setGameState('paused');
          if (isMultiplayer) updateGameState(gameId, 'paused');
      }
    };
    document.addEventListener('pointerlockchange', onPointerLockChange, false);


    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      currentMount.removeEventListener('click', onClick);
      document.removeEventListener('pointerlockchange', onPointerLockChange, false);
      if (document.pointerLockElement === currentMount) {
        document.exitPointerLock();
      }
      cancelAnimationFrame(animationFrameId);
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
      scene.clear();
      renderer.dispose();
    };
  }, [router, settings, customization, updateDifficulty, gameId, playerId]);

  if (!settings || !customization || (isMultiplayer && !gameData)) {
    return (
      <div className="flex h-[calc(100vh-theme(spacing.14))] w-full flex-col items-center justify-center space-y-4 bg-background">
        <Skeleton className="h-1/2 w-4/5" />
        <p className="text-2xl font-bold text-primary animate-pulse">
          {isMultiplayer ? 'CONNECTING TO ARENA...' : 'LOADING ASSETS...'}
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={mountRef} className="absolute inset-0 z-0" />
      <HUD 
        playerScore={score.player} 
        opponentScore={score.opponent} 
        gameState={gameState} 
        winner={winner} 
        isMultiplayer={isMultiplayer}
        gameData={gameData}
       />
      {gameState === 'paused' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 pointer-events-auto" onClick={() => {
            try { mountRef.current?.requestPointerLock() } catch (e) { console.warn("Could not re-lock pointer:", e) }
            if(isMultiplayer && isHost.current){
                updateGameState(gameId, 'playing');
            } else if (!isMultiplayer) {
                setGameState('playing');
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
