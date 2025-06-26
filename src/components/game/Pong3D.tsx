
"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import * as Tone from 'tone';
import { useRouter } from 'next/navigation';
import { adjustDifficulty, type DifficultyAdjustmentInput, type DifficultyAdjustmentOutput } from '@/ai/flows/dynamic-difficulty-adjustment';
import HUD from './HUD';
import { Skeleton } from '../ui/skeleton';
import { getPlayerId } from '@/lib/player';
import { onGameUpdate, updatePlayerPaddle, updateBall, updateScore, GameData } from '@/services/gameService';
import { Unsubscribe } from 'firebase/firestore';


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
  const [gameState, setGameState] = useState<'start' | 'playing' | 'paused' | 'gameOver'>('start');
  const [winner, setWinner] = useState<'player' | 'opponent' | null>(null);
  const [settings, setSettings] = useState<GameSettings | null>(null);
  const [customization, setCustomization] = useState<CustomizationSettings | null>(null);
  
  const isMultiplayer = gameId !== 'single-player';

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
    if (gameData) {
      const localPlayerKey = gameData.players.player1.id === playerId ? 'player1' : 'player2';
      const opponentKey = localPlayerKey === 'player1' ? 'player2' : 'player1';
      setScore({
        player: gameData.score[localPlayerKey],
        opponent: gameData.score[opponentKey],
      });
      if (gameData.state === 'playing') {
        setGameState('playing');
      }
    }
  }, [gameData, playerId]);

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
    if (!isMultiplayer || !gameId) return;
    
    let unsubscribe: Unsubscribe;
    try {
      unsubscribe = onGameUpdate(gameId, (data) => {
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
  }, [isMultiplayer, gameId, router]);

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
    const camera = new THREE.PerspectiveCamera(90, currentMount.clientWidth / currentMount.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.shadowMap.enabled = true;
    currentMount.appendChild(renderer.domElement);

    const arenaWidth = 24;
    const arenaHeight = 16;
    const arenaDepth = 40;

    const opponentColor = 0xD400FF;
    const playerColor = new THREE.Color(customization.paddleColor);
    const arenaColor = new THREE.Color(customization.arenaColor);

    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(arenaWidth, arenaDepth), 
        new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.1, roughness: 0.8 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(arenaDepth, 10, arenaColor, arenaColor);
    grid.position.y = 0.01;
    scene.add(grid);

    const boundaryMaterial = new THREE.LineBasicMaterial({ color: arenaColor, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending });
    const points = [
        new THREE.Vector3(-arenaWidth / 2, 0.01, -arenaDepth / 2),
        new THREE.Vector3(arenaWidth / 2, 0.01, -arenaDepth / 2),
        new THREE.Vector3(arenaWidth / 2, 0.01, arenaDepth / 2),
        new THREE.Vector3(-arenaWidth / 2, 0.01, arenaDepth / 2),
        new THREE.Vector3(-arenaWidth / 2, 0.01, -arenaDepth / 2)
    ];
    const boundaryGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const boundaryLines = new THREE.Line(boundaryGeometry, boundaryMaterial);
    scene.add(boundaryLines);
    
    const particleCount = 5000;
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);
    const pPrimary = new THREE.Color(customization.paddleColor);
    const pAccent = new THREE.Color(opponentColor);

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
    scene.add(ball);
    ball.add(new THREE.PointLight(customization.ballColor, 2, 5));

    scene.add(new THREE.AmbientLight(0xffffff, 0.2));
    const topLight = new THREE.DirectionalLight(arenaColor, 0.5);
    topLight.position.set(0, 10, 0);
    scene.add(topLight);
    const bottomLight = new THREE.DirectionalLight(opponentColor, 0.5);
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

    const ballVelocity = new THREE.Vector3(0, 0, -15);
    let localGameState = 'start';
    let localScore = { player: 0, opponent: 0 };
    
    const resetBall = (direction: number) => {
        const newBallState = {
          x: 0,
          y: 1,
          z: 0,
          vx: 0,
          vy: 0,
          vz: 0,
        };

        const baseSpeed = 15;
        const speed = baseSpeed * difficultyParams.current.ballSpeedMultiplier;
        const angle = (Math.random() - 0.5) * difficultyParams.current.ballAngleRandomness * Math.PI;

        newBallState.vz = direction * speed * Math.cos(angle);
        newBallState.vx = speed * Math.sin(angle);

        ball.position.set(newBallState.x, newBallState.y, newBallState.z);
        ballVelocity.set(newBallState.vx, newBallState.vy, newBallState.vz);

        if (isMultiplayer) {
          updateBall(gameId, newBallState);
        }
    };
    resetBall(Math.random() > 0.5 ? 1 : -1);

    const onMouseMove = (event: MouseEvent) => {
        if (localGameState !== 'playing') return;
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
        const currentGamedata = gameDataRef.current;
        if (localGameState === 'start') {
            if (isMultiplayer) {
              if (currentGamedata?.players.player1 && currentGamedata?.players.player2) {
                 localGameState = 'playing';
                 setGameState('playing');
                 if (currentGamedata.players.player1.id === playerId) { // Only host starts game
                    updateScore(gameId, { player1: 0, player2: 0 }, 'playing');
                 }
                 currentMount.requestPointerLock();
              }
            } else {
              localGameState = 'playing';
              setGameState('playing');
              currentMount.requestPointerLock();
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

        if (localGameState === 'playing') {
            gameTime.current += delta;
            
            const paddleSpeed = 20 * delta;
            if (keysPressed.current['a'] || keysPressed.current['arrowleft']) playerPaddle.position.x -= paddleSpeed;
            if (keysPressed.current['d'] || keysPressed.current['arrowright']) playerPaddle.position.x += paddleSpeed;

            playerPaddle.position.x = THREE.MathUtils.clamp(playerPaddle.position.x, -arenaWidth / 2 + 2, arenaWidth / 2 - 2);
            playerPaddle.position.y = 1;
            playerPaddle.scale.x = difficultyParams.current.paddleSizeMultiplier;

            if (isMultiplayer && currentGamedata) {
              const localPlayerKey = currentGamedata.players.player1.id === playerId ? 'player1' : 'player2';
              const opponentKey = localPlayerKey === 'player1' ? 'player2' : 'player1';
              const isHost = localPlayerKey === 'player1';

              updatePlayerPaddle(gameId, localPlayerKey, { x: playerPaddle.position.x });
              if (currentGamedata.paddles[opponentKey]) {
                opponentPaddle.position.x = currentGamedata.paddles[opponentKey].x;
              }
              opponentPaddle.position.y = 1;
              opponentPaddle.scale.x = difficultyParams.current.paddleSizeMultiplier;
              
              if (isHost) {
                 ball.position.add(ballVelocity.clone().multiplyScalar(delta));
                 updateBall(gameId, {
                    x: ball.position.x,
                    y: ball.position.y,
                    z: ball.position.z,
                    vx: ballVelocity.x,
                    vy: ballVelocity.y,
                    vz: ballVelocity.z,
                });
              } else if (currentGamedata.ball) {
                ball.position.set(currentGamedata.ball.x, currentGamedata.ball.y, currentGamedata.ball.z);
                ballVelocity.set(currentGamedata.ball.vx, currentGamedata.ball.vy, currentGamedata.ball.vz);
              }
            } else { // Single player
              opponentPaddle.position.x += (ball.position.x - opponentPaddle.position.x) * 0.1;
              opponentPaddle.position.x = THREE.MathUtils.clamp(opponentPaddle.position.x, -arenaWidth/2 + 2, arenaWidth/2 - 2);
              opponentPaddle.position.y = 1;
              opponentPaddle.scale.x = difficultyParams.current.paddleSizeMultiplier;
              ball.position.add(ballVelocity.clone().multiplyScalar(delta));
            }

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
            
            if (ball.position.z > arenaDepth / 2) { // Opponent scores
                if (!isMultiplayer || (currentGamedata?.players.player1.id === playerId)) {
                  localScore.opponent++;
                  setScore({...localScore});
                  scoreSound.triggerAttackRelease('A4', '8n');
                  if (isMultiplayer) updateScore(gameId, { player1: localScore.player, player2: localScore.opponent });
                  resetBall(-1);
                }
            }
            if (ball.position.z < -arenaDepth / 2) { // Player scores
                if (!isMultiplayer || (currentGamedata?.players.player1.id === playerId)) {
                  localScore.player++;
                  setScore({...localScore});
                  scoreSound.triggerAttackRelease('C5', '8n');
                  if (isMultiplayer) updateScore(gameId, { player1: localScore.player, player2: localScore.opponent });
                  resetBall(1);
                }
            }
            
            const finalScore = isMultiplayer && currentGamedata ? currentGamedata.score : localScore;
            if (finalScore.player1 >= WINNING_SCORE || finalScore.player2 >= WINNING_SCORE || finalScore.player >= WINNING_SCORE || finalScore.opponent >= WINNING_SCORE) {
                localGameState = 'gameOver';
                setGameState('gameOver');
                const pScore = isMultiplayer ? finalScore.player1 : finalScore.player;
                const oScore = isMultiplayer ? finalScore.player2 : finalScore.opponent;
                const gameWinner = pScore >= WINNING_SCORE ? 'player' : 'opponent';
                setWinner(gameWinner);
                document.exitPointerLock();
                router.push(`/game-over?winner=${gameWinner}&playerScore=${pScore}&opponentScore=${oScore}`);
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
        const spherical = new THREE.Spherical();
        spherical.phi = cameraOrbit.current.phi;
        spherical.theta = cameraOrbit.current.theta;
        
        if (settings.cameraView === 'first-person') {
            const pivotPoint = playerPaddle.position.clone();
            pivotPoint.y = 1.5; // Eye level
            camera.position.copy(pivotPoint);
            
            const lookAtPoint = new THREE.Vector3(0,0,-1);
            lookAtPoint.applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(cameraOrbit.current.phi - Math.PI/2, cameraOrbit.current.theta, 0, 'YXZ')));
            lookAtPoint.add(pivotPoint);
            camTarget.copy(lookAtPoint);

        } else if (settings.cameraView === 'third-person') {
            spherical.radius = 25;
            const pivotPoint = new THREE.Vector3(0, 2, 0);
            const offset = new THREE.Vector3().setFromSpherical(spherical);
            camera.position.copy(pivotPoint).add(offset);
            camTarget.set(0, 2, 0);
        } else { // top-down
            camera.position.set(0, 25, 0);
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

    const onPointerLockChange = () => {
        if (document.pointerLockElement !== currentMount) {
            localGameState = 'paused';
            setGameState('paused');
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
      particlePool.current = [];
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
            if (mountRef.current) {
                mountRef.current.requestPointerLock();
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
