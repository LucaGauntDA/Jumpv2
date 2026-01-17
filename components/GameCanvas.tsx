
import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  GAME_WIDTH, 
  GAME_HEIGHT, 
  GRAVITY, 
  JUMP_FORCE, 
  BOOST_FORCE, 
  MOVE_SPEED, 
  FRICTION, 
  MAX_VX,
  COLORS,
  PLATFORM_WIDTH,
  PLATFORM_HEIGHT,
  PLATFORM_SPACING
} from '../constants';
import { Platform, Player, Particle, PlatformType, Monster, CharacterType, MonsterType, Hole } from '../types';

interface GameCanvasProps {
  input: { left: boolean; right: boolean };
  onScoreUpdate: (score: number) => void;
  onGameOver: () => void;
  isStarted: boolean;
  selectedCharacter: CharacterType;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ input, onScoreUpdate, onGameOver, isStarted, selectedCharacter }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef(input);
  const lastPlatformXRef = useRef(GAME_WIDTH / 2 - PLATFORM_WIDTH / 2);
  const lastMonsterYRef = useRef(0);
  const lastHoleYRef = useRef(0);
  
  // Sucking animation state
  const suckingHoleIdRef = useRef<string | null>(null);
  const suckProgressRef = useRef<number>(0);
  const suckPlayerStartPos = useRef<{x: number, y: number} | null>(null);

  const starsLayer1 = useMemo(() => Array.from({ length: 50 }, () => ({
    x: Math.random() * GAME_WIDTH,
    y: Math.random() * GAME_HEIGHT,
    size: Math.random() * 2 + 1,
    opacity: Math.random() * 0.3 + 0.1,
    driftSpeed: Math.random() * 0.05 + 0.02
  })), []);

  const starsLayer2 = useMemo(() => Array.from({ length: 30 }, () => ({
    x: Math.random() * GAME_WIDTH,
    y: Math.random() * GAME_HEIGHT,
    size: Math.random() * 3 + 2,
    opacity: Math.random() * 0.4 + 0.2,
    driftSpeed: Math.random() * 0.08 + 0.04
  })), []);

  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  const playerRef = useRef<Player>({
    x: GAME_WIDTH / 2 - 16,
    y: GAME_HEIGHT - 150,
    width: 32,
    height: 32,
    vx: 0,
    vy: 0,
    color: COLORS.player,
    character: selectedCharacter
  });
  
  const platformsRef = useRef<Platform[]>([]);
  const monstersRef = useRef<Monster[]>([]);
  const holesRef = useRef<Hole[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const cameraYRef = useRef(0);
  const maxScoreRef = useRef(0);
  // Fix: Initialize useRef with null to provide the required 1 argument and avoid 'Expected 1 arguments, but got 0' error.
  const requestRef = useRef<number | null>(null);
  const isDeadRef = useRef(false);

  const createHole = (y: number): Hole => {
    const radius = 50 + Math.random() * 30;
    const x = radius + Math.random() * (GAME_WIDTH - radius * 2);
    return {
      id: Math.random().toString(36).substr(2, 9),
      x,
      y,
      radius,
      color: '#4b5563',
      pulsePhase: Math.random() * Math.PI * 2
    };
  };

  const createMonster = (y: number): Monster => {
    const types: MonsterType[] = ['standard', 'stalker', 'giant', 'wobbler'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    let radius = 25 + Math.random() * 15;
    let color = COLORS.monster;
    let vx = (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 3);
    let vy = 0;
    let moveRange = 100 + Math.random() * 200;

    if (type === 'stalker') {
      vx *= 1.8;
      color = '#00f2ff'; 
    } else if (type === 'giant') {
      radius *= 2.2;
      vx *= 0.5;
      color = '#ff4d00'; 
    } else if (type === 'wobbler') {
      vx = 0;
      color = '#7dff00'; 
    }

    const x = radius + Math.random() * (GAME_WIDTH - radius * 2);
    
    return {
      id: Math.random().toString(36).substr(2, 9),
      x,
      y,
      radius,
      vx,
      vy,
      moveRange,
      initialX: x,
      initialY: y,
      color,
      type,
      phase: Math.random() * Math.PI * 2
    };
  };

  const createPlatform = (y: number, forceType?: PlatformType): Platform => {
    const chance = Math.random();
    let type: PlatformType = forceType || 'normal';
    
    if (!forceType) {
        if (y < -15000) {
            if (chance < 0.35) type = 'moving';
            else if (chance < 0.65) type = 'fragile';
            else if (chance < 0.75) type = 'boost';
        } else if (y < -5000) {
            if (chance < 0.25) type = 'moving';
            else if (chance < 0.50) type = 'fragile';
            else if (chance < 0.58) type = 'boost';
        } else {
            if (chance < 0.12) type = 'fragile';
            else if (chance < 0.20) type = 'moving';
            else if (chance < 0.25) type = 'boost';
        }
    }

    const maxHorizontalGap = 450; 
    let minX = Math.max(0, lastPlatformXRef.current - maxHorizontalGap);
    let maxX = Math.min(GAME_WIDTH - PLATFORM_WIDTH, lastPlatformXRef.current + maxHorizontalGap);
    
    const x = minX + Math.random() * (maxX - minX);
    lastPlatformXRef.current = x;

    const color = type === 'normal' ? COLORS.platformNormal : 
                  type === 'moving' ? COLORS.platformMoving :
                  type === 'fragile' ? COLORS.platformFragile : COLORS.platformBoost;

    return {
      id: Math.random().toString(36).substr(2, 9),
      x,
      y,
      width: type === 'moving' ? PLATFORM_WIDTH * 0.9 : PLATFORM_WIDTH,
      height: PLATFORM_HEIGHT,
      type,
      color,
      moveDirection: Math.random() > 0.5 ? 1 : -1,
      moveRange: 100 + Math.random() * 200,
      initialX: x,
      broken: false
    };
  };

  const initGame = useCallback(() => {
    lastPlatformXRef.current = GAME_WIDTH / 2 - PLATFORM_WIDTH / 2;
    lastMonsterYRef.current = 0;
    lastHoleYRef.current = 0;
    suckingHoleIdRef.current = null;
    suckProgressRef.current = 0;
    suckPlayerStartPos.current = null;
    isDeadRef.current = false;
    const initialPlatforms: Platform[] = [];
    initialPlatforms.push({
      id: 'start',
      x: lastPlatformXRef.current,
      y: GAME_HEIGHT - 60,
      width: PLATFORM_WIDTH,
      height: PLATFORM_HEIGHT,
      type: 'normal',
      color: COLORS.platformNormal
    });

    for (let i = 1; i < 15; i++) {
      const y = GAME_HEIGHT - 60 - i * PLATFORM_SPACING;
      const p = createPlatform(y);
      initialPlatforms.push(p);
      if (p.type === 'fragile') {
        initialPlatforms.push(createPlatform(y, 'normal'));
      }
    }

    platformsRef.current = initialPlatforms;
    monstersRef.current = [];
    holesRef.current = [];
    playerRef.current = {
      x: GAME_WIDTH / 2 - 16,
      y: GAME_HEIGHT - 150,
      width: 32,
      height: 32,
      vx: 0,
      vy: 0,
      color: COLORS.player,
      character: selectedCharacter
    };
    cameraYRef.current = 0;
    maxScoreRef.current = 0;
    particlesRef.current = [];
  }, [selectedCharacter]);

  const spawnParticles = (x: number, y: number, color: string, count = 12, speedScale = 1) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 12 * speedScale,
        vy: (Math.random() - 0.7) * 15 * speedScale,
        life: 1.0,
        color
      });
    }
  };

  const update = () => {
    const player = playerRef.current;
    const currentInput = inputRef.current;
    
    // Sucking Animation Logic
    if (suckingHoleIdRef.current) {
      const hole = holesRef.current.find(h => h.id === suckingHoleIdRef.current);
      if (hole) {
        suckProgressRef.current = Math.min(suckProgressRef.current + 0.02, 1);
        
        // Circular spiral pull
        const startX = suckPlayerStartPos.current!.x;
        const startY = suckPlayerStartPos.current!.y;
        
        // Linear interpolation toward center with a spiral offset
        const spiralAngle = suckProgressRef.current * Math.PI * 4;
        const spiralRadius = (1 - suckProgressRef.current) * 50;
        
        player.x = startX + (hole.x - startX - player.width/2) * suckProgressRef.current + Math.cos(spiralAngle) * spiralRadius;
        player.y = startY + (hole.y - startY - player.height/2) * suckProgressRef.current + Math.sin(spiralAngle) * spiralRadius;

        if (suckProgressRef.current >= 1) {
          onGameOver();
        }
      }
      return; // Skip normal physics when being sucked
    }

    if (!isDeadRef.current) {
        if (currentInput.left) player.vx -= MOVE_SPEED;
        if (currentInput.right) player.vx += MOVE_SPEED;
    }
    
    player.vx *= FRICTION;
    if (Math.abs(player.vx) > MAX_VX) player.vx = Math.sign(player.vx) * MAX_VX;
    
    player.x += player.vx;
    player.vy += GRAVITY;
    player.y += player.vy;

    if (player.x < 0) {
      player.x = 0;
      player.vx = 0;
    } else if (player.x + player.width > GAME_WIDTH) {
      player.x = GAME_WIDTH - player.width;
      player.vx = 0;
    }

    const targetCameraY = player.y - GAME_HEIGHT / 2;
    if (targetCameraY < cameraYRef.current && !isDeadRef.current) {
      cameraYRef.current += (targetCameraY - cameraYRef.current) * 0.12;
    }

    const currentScore = Math.floor(Math.abs(Math.min(0, player.y - (GAME_HEIGHT - 150))) / 10);
    if (currentScore > maxScoreRef.current && !isDeadRef.current) {
      maxScoreRef.current = currentScore;
      onScoreUpdate(maxScoreRef.current);
    }

    if (maxScoreRef.current > 200) {
        if (player.y < lastMonsterYRef.current - 1200) {
            monstersRef.current.push(createMonster(player.y - 600));
            lastMonsterYRef.current = player.y;
        }
        if (player.y < lastHoleYRef.current - 2000) {
            if (Math.random() > 0.4) {
              holesRef.current.push(createHole(player.y - 800));
            }
            lastHoleYRef.current = player.y;
        }
    }

    platformsRef.current.forEach(p => {
      if (p.type === 'moving' && p.initialX !== undefined && p.moveDirection !== undefined && p.moveRange !== undefined) {
        p.x += p.moveDirection * 2.8;
        if (Math.abs(p.x - p.initialX) > p.moveRange) {
          p.moveDirection *= -1;
        }
      }

      if (player.vy > 0 && !p.broken && !isDeadRef.current) {
        if (
          player.x < p.x + p.width &&
          player.x + player.width > p.x &&
          player.y + player.height > p.y &&
          player.y + player.height < p.y + p.height + player.vy + 4
        ) {
          if (p.type === 'fragile') {
            p.broken = true;
            spawnParticles(p.x + p.width / 2, p.y + p.height / 2, p.color, 24, 1.2);
            player.vy = JUMP_FORCE * 0.85;
          } else if (p.type === 'boost') {
            player.vy = BOOST_FORCE;
            spawnParticles(p.x + p.width / 2, p.y + p.height / 2, p.color, 32, 2.5);
          } else {
            player.vy = JUMP_FORCE;
          }
          player.y = p.y - player.height;
        }
      }
    });

    holesRef.current.forEach(h => {
        h.pulsePhase += 0.05;
        if (!isDeadRef.current) {
            const dx = (player.x + player.width / 2) - h.x;
            const dy = (player.y + player.height / 2) - h.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < h.radius * 0.85) {
                isDeadRef.current = true;
                suckingHoleIdRef.current = h.id;
                suckPlayerStartPos.current = { x: player.x, y: player.y };
                suckProgressRef.current = 0;
                spawnParticles(player.x + player.width/2, player.y + player.height/2, h.color, 30, 0.4);
            }
        }
    });

    monstersRef.current.forEach(m => {
        if (m.type === 'wobbler') {
          m.phase = (m.phase || 0) + 0.05;
          m.x = m.initialX + Math.sin(m.phase) * m.moveRange;
          m.y = m.initialY + Math.cos(m.phase) * (m.moveRange * 0.5);
        } else {
          m.x += m.vx;
          if (Math.abs(m.x - m.initialX) > m.moveRange || m.x < m.radius || m.x > GAME_WIDTH - m.radius) {
              m.vx *= -1;
          }
        }

        if (!isDeadRef.current) {
            const dx = (player.x + player.width / 2) - m.x;
            const dy = (player.y + player.height / 2) - m.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < m.radius + 15) {
                isDeadRef.current = true;
                player.vy = 10;
                spawnParticles(player.x + player.width/2, player.y + player.height/2, m.color, 40, 3);
            }
        }
    });

    const lastPlatform = platformsRef.current[platformsRef.current.length - 1];
    if (lastPlatform && lastPlatform.y > cameraYRef.current - 400) {
       const nextY = lastPlatform.y - PLATFORM_SPACING;
       const newP = createPlatform(nextY);
       platformsRef.current.push(newP);
       if (newP.type === 'fragile') {
          platformsRef.current.push(createPlatform(nextY, 'normal'));
       }
    }
    
    platformsRef.current = platformsRef.current.filter(p => p.y < cameraYRef.current + GAME_HEIGHT + 100);
    monstersRef.current = monstersRef.current.filter(m => m.y < cameraYRef.current + GAME_HEIGHT + 600);
    holesRef.current = holesRef.current.filter(h => h.y < cameraYRef.current + GAME_HEIGHT + 600);

    particlesRef.current.forEach(p => {
      p.x += p.vx;
      p.vy += 0.25;
      p.y += p.vy;
      p.life -= 0.02;
    });
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);

    if (player.y > cameraYRef.current + GAME_HEIGHT + 400) {
      onGameOver();
    }
  };

  const drawBackground = (ctx: CanvasRenderingContext2D, camY: number) => {
    const time = performance.now();
    const player = playerRef.current;
    const hParallaxBase = (player.x - GAME_WIDTH / 2) * 0.1;

    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.fillStyle = 'white';
    starsLayer1.forEach(star => {
      const idleX = Math.sin(time * 0.0005) * 20;
      const px = (star.x - hParallaxBase * 0.5 + idleX) % GAME_WIDTH;
      const py = (star.y - camY * 0.1 + time * star.driftSpeed) % GAME_HEIGHT;
      const drawX = px < 0 ? px + GAME_WIDTH : px;
      const drawY = py < 0 ? py + GAME_HEIGHT : py;
      ctx.globalAlpha = star.opacity * (0.8 + Math.sin(time * 0.001 + star.x) * 0.2);
      ctx.beginPath();
      ctx.arc(drawX, drawY, star.size, 0, Math.PI * 2);
      ctx.fill();
    });

    starsLayer2.forEach(star => {
      const idleX = Math.cos(time * 0.0007) * 40;
      const px = (star.x - hParallaxBase * 1.2 + idleX) % GAME_WIDTH;
      const py = (star.y - camY * 0.25 + time * star.driftSpeed) % GAME_HEIGHT;
      const drawX = px < 0 ? px + GAME_WIDTH : px;
      const drawY = py < 0 ? py + GAME_HEIGHT : py;
      ctx.globalAlpha = star.opacity * (0.9 + Math.cos(time * 0.0015 + star.y) * 0.1);
      ctx.beginPath();
      ctx.arc(drawX, drawY, star.size, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.globalAlpha = 1.0;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.lineWidth = 1;
    const gridSize = 120;
    const gridOffsetY = -camY % gridSize;
    const gridOffsetX = -hParallaxBase % gridSize;
    
    ctx.beginPath();
    for (let y = gridOffsetY; y < GAME_HEIGHT; y += gridSize) {
      ctx.moveTo(0, y); ctx.lineTo(GAME_WIDTH, y);
    }
    for (let x = gridOffsetX; x < GAME_WIDTH + gridSize; x += gridSize) {
      ctx.moveTo(x, 0); ctx.lineTo(x, GAME_HEIGHT);
    }
    ctx.stroke();
  };

  const drawHole = (ctx: CanvasRenderingContext2D, h: Hole, camY: number) => {
    const drawY = h.y - camY;
    const pulse = Math.sin(h.pulsePhase) * 5;
    const radius = h.radius + pulse;

    ctx.save();
    ctx.shadowBlur = 30;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.2)';
    
    const grad = ctx.createRadialGradient(h.x, drawY, radius * 0.2, h.x, drawY, radius);
    grad.addColorStop(0, '#000000');
    grad.addColorStop(0.7, '#1f2937');
    grad.addColorStop(1, '#9ca3af');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(h.x, drawY, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(h.x, drawY, radius * 0.9, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  };

  const drawMonster = (ctx: CanvasRenderingContext2D, m: Monster, camY: number) => {
    const drawY = m.y - camY;
    const time = Date.now() / 200;
    const pulse = Math.sin(time) * (m.type === 'giant' ? 12 : 5);
    
    ctx.shadowBlur = m.type === 'giant' ? 40 : 20;
    ctx.shadowColor = m.color;
    ctx.fillStyle = m.color;

    ctx.beginPath();
    const spikes = m.type === 'giant' ? 24 : 12;
    for (let i = 0; i < spikes; i++) {
        const angle = (i / spikes) * Math.PI * 2;
        let r = m.radius + pulse;
        if (m.type === 'stalker') r += (i % 2 === 0 ? 15 : 0);
        else if (m.type === 'standard') r += (i % 2 === 0 ? 10 : 0);
        else if (m.type === 'giant') r += (i % 3 === 0 ? 25 : 0);
        else if (m.type === 'wobbler') r += (i % 2 === 0 ? 8 : -8);

        const tx = m.x + Math.cos(angle) * r;
        const ty = drawY + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(tx, ty);
        else ctx.lineTo(tx, ty);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    const eyeSize = m.type === 'giant' ? 12 : 6;
    const eyeSpacing = m.type === 'giant' ? 25 : 10;
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.ellipse(m.x - eyeSpacing, drawY - 5, eyeSize, eyeSize * 1.3, 0, 0, Math.PI * 2);
    ctx.ellipse(m.x + eyeSpacing, drawY - 5, eyeSize, eyeSize * 1.3, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(m.x - eyeSpacing, drawY - 5, eyeSize * 0.5, 0, Math.PI * 2);
    ctx.arc(m.x + eyeSpacing, drawY - 5, eyeSize * 0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'white';
    ctx.lineWidth = m.type === 'giant' ? 4 : 2;
    ctx.beginPath();
    if (m.type === 'stalker') {
      ctx.moveTo(m.x - 18, drawY - 20); ctx.lineTo(m.x - 4, drawY - 12);
      ctx.moveTo(m.x + 18, drawY - 20); ctx.lineTo(m.x + 4, drawY - 12);
    } else if (m.type === 'giant') {
      ctx.moveTo(m.x - 35, drawY - 25); ctx.lineTo(m.x - 10, drawY - 15);
      ctx.moveTo(m.x + 35, drawY - 25); ctx.lineTo(m.x + 10, drawY - 15);
    } else {
      ctx.moveTo(m.x - 18, drawY - 15); ctx.lineTo(m.x - 4, drawY - 8);
      ctx.moveTo(m.x + 18, drawY - 15); ctx.lineTo(m.x + 4, drawY - 8);
    }
    ctx.stroke();
  };

  const drawPlayer = (ctx: CanvasRenderingContext2D, player: Player, camY: number) => {
    const isSucking = suckingHoleIdRef.current !== null;
    const scale = isSucking ? (1 - suckProgressRef.current) : 1;
    const opacity = isSucking ? (1 - suckProgressRef.current) : 1;
    
    if (scale <= 0) return;

    const pX = player.x;
    const pY = player.y - camY;
    const w = player.width;
    const h = player.height;
    const centerX = pX + w / 2;
    const centerY = pY + h / 2;
    const lean = player.vx * 0.5;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(centerX, centerY);
    // Rapid rotation if being sucked
    const rotation = isSucking ? suckProgressRef.current * Math.PI * 10 : player.vx * 0.02;
    ctx.rotate(rotation);
    ctx.scale(scale, scale);
    ctx.translate(-centerX, -centerY);

    ctx.shadowBlur = 25 * scale;
    ctx.shadowColor = COLORS.player;
    ctx.fillStyle = COLORS.player;
    ctx.strokeStyle = COLORS.player;
    ctx.lineWidth = 3;

    switch (player.character) {
      case 'triangle':
        ctx.beginPath();
        ctx.moveTo(centerX, pY);
        ctx.lineTo(pX + w, pY + h);
        ctx.lineTo(pX, pY + h);
        ctx.closePath();
        ctx.fill();
        break;
      case 'square':
        ctx.fillRect(pX, pY, w, h);
        break;
      case 'circle':
        ctx.beginPath();
        ctx.arc(centerX, centerY, w/2, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'diamond':
        ctx.beginPath();
        ctx.moveTo(centerX, pY);
        ctx.lineTo(pX + w, centerY);
        ctx.lineTo(centerX, pY + h);
        ctx.lineTo(pX, centerY);
        ctx.closePath();
        ctx.fill();
        break;
      case 'star':
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const r = i % 2 === 0 ? w/2 : w/4;
          const a = (i / 10) * Math.PI * 2 - Math.PI/2;
          ctx.lineTo(centerX + Math.cos(a) * r, centerY + Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
        break;
      case 'hexagon':
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 - Math.PI/2;
          ctx.lineTo(centerX + Math.cos(a) * (w/2), centerY + Math.sin(a) * (h/2));
        }
        ctx.closePath();
        ctx.fill();
        break;
      case 'ghost':
        ctx.beginPath();
        ctx.arc(centerX, pY + h*0.4, w/2, Math.PI, 0);
        ctx.lineTo(pX + w, pY + h);
        ctx.lineTo(pX + w*0.8, pY + h*0.8);
        ctx.lineTo(pX + w*0.6, pY + h);
        ctx.lineTo(pX + w*0.4, pY + h*0.8);
        ctx.lineTo(pX + w*0.2, pY + h);
        ctx.lineTo(pX, pY + h);
        ctx.closePath();
        ctx.fill();
        break;
      case 'robot':
        ctx.fillRect(pX, pY + h*0.2, w, h*0.8);
        ctx.strokeRect(pX + w*0.2, pY, w*0.6, h*0.2);
        break;
    }

    ctx.shadowBlur = 0;
    ctx.fillStyle = 'black';
    if (isDeadRef.current) {
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX - 8 + lean, centerY); ctx.lineTo(centerX - 2 + lean, centerY + 6);
        ctx.moveTo(centerX - 2 + lean, centerY); ctx.lineTo(centerX - 8 + lean, centerY + 6);
        ctx.moveTo(centerX + 2 + lean, centerY); ctx.lineTo(centerX + 8 + lean, centerY + 6);
        ctx.moveTo(centerX + 8 + lean, centerY); ctx.lineTo(centerX + 2 + lean, centerY + 6);
        ctx.stroke();
    } else {
        ctx.beginPath();
        ctx.arc(centerX - 6 + lean, centerY + 2, 3, 0, Math.PI * 2);
        ctx.arc(centerX + 6 + lean, centerY + 2, 3, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.restore();
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const camY = cameraYRef.current;

    drawBackground(ctx, camY);

    holesRef.current.forEach(h => drawHole(ctx, h, camY));

    platformsRef.current.forEach(p => {
      if (p.broken) return;
      const drawY = p.y - camY;
      ctx.shadowBlur = 15;
      ctx.shadowColor = p.color;
      ctx.fillStyle = p.color;
      const radius = 6;
      ctx.beginPath();
      ctx.roundRect(p.x, drawY, p.width, p.height, radius);
      ctx.fill();
      ctx.shadowBlur = 0;

      if (p.type === 'fragile') {
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x + p.width * 0.2, drawY);
        ctx.lineTo(p.x + p.width * 0.3, drawY + p.height * 0.6);
        ctx.lineTo(p.x + p.width * 0.25, drawY + p.height);
        ctx.moveTo(p.x + p.width * 0.7, drawY);
        ctx.lineTo(p.x + p.width * 0.6, drawY + p.height * 0.4);
        ctx.lineTo(p.x + p.width * 0.8, drawY + p.height);
        ctx.stroke();
      }

      if (p.type === 'boost') {
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x + 10, drawY + p.height/2);
        ctx.lineTo(p.x + p.width - 10, drawY + p.height/2);
        ctx.stroke();
      }
    });

    monstersRef.current.forEach(m => drawMonster(ctx, m, camY));

    particlesRef.current.forEach(p => {
      ctx.globalAlpha = p.life;
      ctx.shadowBlur = 8;
      ctx.shadowColor = p.color;
      ctx.fillStyle = p.color;
      const size = 3 + p.life * 5;
      ctx.fillRect(p.x - size / 2, p.y - camY - size / 2, size, size);
    });
    ctx.globalAlpha = 1.0;
    ctx.shadowBlur = 0;

    drawPlayer(ctx, playerRef.current, camY);
  };

  const animate = useCallback(() => {
    if (!isStarted) return;
    update();
    draw();
    requestRef.current = requestAnimationFrame(animate);
  }, [isStarted]);

  useEffect(() => {
    if (isStarted) {
      initGame();
      requestRef.current = requestAnimationFrame(animate);
    } else {
      if (requestRef.current !== null) cancelAnimationFrame(requestRef.current);
    }
    return () => {
      if (requestRef.current !== null) cancelAnimationFrame(requestRef.current);
    };
  }, [isStarted, animate, initGame]);

  return (
    <div className="bg-[#0a0a0a] ring-1 ring-white/10 shadow-2xl rounded-lg overflow-hidden flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={GAME_WIDTH}
        height={GAME_HEIGHT}
        className="max-w-full max-h-full object-contain"
        style={{ width: '100%', height: '100%', aspectRatio: `${GAME_WIDTH}/${GAME_HEIGHT}` }}
      />
    </div>
  );
};

export default GameCanvas;
