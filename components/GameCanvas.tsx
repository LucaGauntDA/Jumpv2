
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
  
  // Audio state
  const holeOscillatorRef = useRef<OscillatorNode | null>(null);
  const holeGainRef = useRef<GainNode | null>(null);

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
  const requestRef = useRef<number | null>(null);
  const isDeadRef = useRef(false);

  // --- MINIMALIST AUDIO ENGINE ---
  const getAudioCtx = () => (window as any).audioContextInstance as AudioContext | null;

  const playBlip = (freq: number, type: OscillatorType = 'sine', duration = 0.15, volume = 0.1, ramp = true) => {
    const ctx = getAudioCtx();
    if (!ctx) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (ramp) {
        osc.frequency.exponentialRampToValueAtTime(freq * 1.6, ctx.currentTime + duration);
      }
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch(e) { console.warn("Audio failed", e); }
  };

  const playJumpSnd = () => playBlip(440, 'sine', 0.12, 0.08);
  const playBoostSnd = () => playBlip(220, 'triangle', 0.4, 0.15);
  const playHitSnd = () => playBlip(80, 'sine', 0.5, 0.2, false);
  const playBreakSnd = () => {
    const ctx = getAudioCtx();
    if (!ctx) return;
    try {
      const bufferSize = ctx.sampleRate * 0.08;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200, ctx.currentTime);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start();
    } catch(e) {}
  };

  const startHoleSnd = () => {
    const ctx = getAudioCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(50, ctx.currentTime);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(180, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.4);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      holeOscillatorRef.current = osc;
      holeGainRef.current = gain;
    } catch(e) {}
  };

  const stopHoleSnd = () => {
    const ctx = getAudioCtx();
    if (holeGainRef.current && ctx) {
      try {
        holeGainRef.current.gain.cancelScheduledValues(ctx.currentTime);
        holeGainRef.current.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
        const osc = holeOscillatorRef.current;
        setTimeout(() => { try { osc?.stop(); } catch(e) {} }, 250);
        holeOscillatorRef.current = null;
        holeGainRef.current = null;
      } catch(e) {}
    }
  };

  const createHole = (y: number): Hole => {
    const radius = 40 + Math.random() * 25;
    const x = radius + Math.random() * (GAME_WIDTH - radius * 2);
    return { id: Math.random().toString(36).substr(2, 9), x, y, radius, color: '#4b5563', pulsePhase: Math.random() * Math.PI * 2 };
  };

  const createMonster = (y: number): Monster => {
    const types: MonsterType[] = ['standard', 'stalker', 'giant', 'wobbler'];
    const type = types[Math.floor(Math.random() * types.length)];
    let radius = 25 + Math.random() * 15;
    let color = COLORS.monster;
    let vx = (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 3);
    let moveRange = 100 + Math.random() * 200;
    if (type === 'stalker') { vx *= 1.8; color = '#00f2ff'; }
    else if (type === 'giant') { radius *= 2.2; vx *= 0.5; color = '#ff4d00'; }
    else if (type === 'wobbler') { vx = 0; color = '#7dff00'; }
    const x = radius + Math.random() * (GAME_WIDTH - radius * 2);
    return { id: Math.random().toString(36).substr(2, 9), x, y, radius, vx, vy: 0, moveRange, initialX: x, initialY: y, color, type, phase: Math.random() * Math.PI * 2 };
  };

  const createPlatform = (y: number, forceType?: PlatformType): Platform => {
    const chance = Math.random();
    let type: PlatformType = forceType || 'normal';
    if (!forceType) {
        if (y < -15000) { if (chance < 0.35) type = 'moving'; else if (chance < 0.65) type = 'fragile'; else if (chance < 0.75) type = 'boost'; }
        else if (y < -5000) { if (chance < 0.25) type = 'moving'; else if (chance < 0.50) type = 'fragile'; else if (chance < 0.58) type = 'boost'; }
        else { if (chance < 0.12) type = 'fragile'; else if (chance < 0.20) type = 'moving'; else if (chance < 0.25) type = 'boost'; }
    }
    const maxHorizontalGap = 450; 
    let minX = Math.max(0, lastPlatformXRef.current - maxHorizontalGap);
    let maxX = Math.min(GAME_WIDTH - PLATFORM_WIDTH, lastPlatformXRef.current + maxHorizontalGap);
    const x = minX + Math.random() * (maxX - minX);
    lastPlatformXRef.current = x;
    const color = type === 'normal' ? COLORS.platformNormal : type === 'moving' ? COLORS.platformMoving : type === 'fragile' ? COLORS.platformFragile : COLORS.platformBoost;
    return { id: Math.random().toString(36).substr(2, 9), x, y, width: type === 'moving' ? PLATFORM_WIDTH * 0.9 : PLATFORM_WIDTH, height: PLATFORM_HEIGHT, type, color, moveDirection: Math.random() > 0.5 ? 1 : -1, moveRange: 100 + Math.random() * 200, initialX: x, broken: false };
  };

  const initGame = useCallback(() => {
    lastPlatformXRef.current = GAME_WIDTH / 2 - PLATFORM_WIDTH / 2;
    lastMonsterYRef.current = 0;
    lastHoleYRef.current = 0;
    suckingHoleIdRef.current = null;
    suckProgressRef.current = 0;
    suckPlayerStartPos.current = null;
    isDeadRef.current = false;
    stopHoleSnd();
    const initialPlatforms: Platform[] = [];
    initialPlatforms.push({ id: 'start', x: lastPlatformXRef.current, y: GAME_HEIGHT - 60, width: PLATFORM_WIDTH, height: PLATFORM_HEIGHT, type: 'normal', color: COLORS.platformNormal });
    for (let i = 1; i < 15; i++) {
      const y = GAME_HEIGHT - 60 - i * PLATFORM_SPACING;
      const p = createPlatform(y);
      initialPlatforms.push(p);
      if (p.type === 'fragile') initialPlatforms.push(createPlatform(y, 'normal'));
    }
    platformsRef.current = initialPlatforms;
    monstersRef.current = [];
    holesRef.current = [];
    playerRef.current = { x: GAME_WIDTH / 2 - 16, y: GAME_HEIGHT - 150, width: 32, height: 32, vx: 0, vy: 0, color: COLORS.player, character: selectedCharacter };
    cameraYRef.current = 0;
    maxScoreRef.current = 0;
    particlesRef.current = [];
  }, [selectedCharacter]);

  const update = () => {
    const player = playerRef.current;
    const currentInput = inputRef.current;
    
    if (suckingHoleIdRef.current) {
      const hole = holesRef.current.find(h => h.id === suckingHoleIdRef.current);
      if (hole) {
        suckProgressRef.current = Math.min(suckProgressRef.current + 0.02, 1);
        const startX = suckPlayerStartPos.current!.x;
        const startY = suckPlayerStartPos.current!.y;
        const spiralAngle = suckProgressRef.current * Math.PI * 4;
        const spiralRadius = (1 - suckProgressRef.current) * 50;
        player.x = startX + (hole.x - startX - player.width/2) * suckProgressRef.current + Math.cos(spiralAngle) * spiralRadius;
        player.y = startY + (hole.y - startY - player.height/2) * suckProgressRef.current + Math.sin(spiralAngle) * spiralRadius;
        if (holeOscillatorRef.current && getAudioCtx()) {
          holeOscillatorRef.current.frequency.setValueAtTime(50 + suckProgressRef.current * 160, getAudioCtx()!.currentTime);
        }
        if (suckProgressRef.current >= 1) { stopHoleSnd(); onGameOver(); }
      }
      return; 
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
    if (player.x < 0) { player.x = 0; player.vx = 0; }
    else if (player.x + player.width > GAME_WIDTH) { player.x = GAME_WIDTH - player.width; player.vx = 0; }
    const targetCameraY = player.y - GAME_HEIGHT / 2;
    if (targetCameraY < cameraYRef.current && !isDeadRef.current) cameraYRef.current += (targetCameraY - cameraYRef.current) * 0.12;
    const currentScore = Math.floor(Math.abs(Math.min(0, player.y - (GAME_HEIGHT - 150))) / 10);
    if (currentScore > maxScoreRef.current && !isDeadRef.current) { maxScoreRef.current = currentScore; onScoreUpdate(maxScoreRef.current); }
    if (maxScoreRef.current > 200) {
        if (player.y < lastMonsterYRef.current - 1200) { monstersRef.current.push(createMonster(player.y - 600)); lastMonsterYRef.current = player.y; }
        if (player.y < lastHoleYRef.current - 2000) { if (Math.random() > 0.4) holesRef.current.push(createHole(player.y - 800)); lastHoleYRef.current = player.y; }
    }
    platformsRef.current.forEach(p => {
      if (p.type === 'moving' && p.initialX !== undefined && p.moveDirection !== undefined && p.moveRange !== undefined) {
        p.x += p.moveDirection * 2.8;
        if (Math.abs(p.x - p.initialX) > p.moveRange) p.moveDirection *= -1;
      }
      if (player.vy > 0 && !p.broken && !isDeadRef.current) {
        if (player.x < p.x + p.width && player.x + player.width > p.x && player.y + player.height > p.y && player.y + player.height < p.y + p.height + player.vy + 4) {
          if (p.type === 'fragile') { p.broken = true; player.vy = JUMP_FORCE * 0.85; playBreakSnd(); }
          else if (p.type === 'boost') { player.vy = BOOST_FORCE; playBoostSnd(); }
          else { player.vy = JUMP_FORCE; playJumpSnd(); }
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
            if (distance < h.radius * 2.2) {
                const pullStrength = (1 - (distance / (h.radius * 2.2))) * 0.18;
                player.vx += (h.x - (player.x + player.width/2)) * pullStrength;
                player.vy += (h.y - (player.y + player.height/2)) * pullStrength;
            }
            if (distance < h.radius * 0.7) {
                isDeadRef.current = true;
                suckingHoleIdRef.current = h.id;
                suckPlayerStartPos.current = { x: player.x, y: player.y };
                suckProgressRef.current = 0;
                startHoleSnd();
            }
        }
    });
    monstersRef.current.forEach(m => {
        if (m.type === 'wobbler') { m.phase = (m.phase || 0) + 0.05; m.x = m.initialX + Math.sin(m.phase) * m.moveRange; m.y = m.initialY + Math.cos(m.phase) * (m.moveRange * 0.5); }
        else { m.x += m.vx; if (Math.abs(m.x - m.initialX) > m.moveRange || m.x < m.radius || m.x > GAME_WIDTH - m.radius) m.vx *= -1; }
        if (!isDeadRef.current) {
            const dx = (player.x + player.width / 2) - m.x;
            const dy = (player.y + player.height / 2) - m.y;
            if (Math.sqrt(dx * dx + dy * dy) < m.radius + 15) { isDeadRef.current = true; player.vy = 10; playHitSnd(); }
        }
    });
    const lastPlatform = platformsRef.current[platformsRef.current.length - 1];
    if (lastPlatform && lastPlatform.y > cameraYRef.current - 400) {
       const nextY = lastPlatform.y - PLATFORM_SPACING;
       const newP = createPlatform(nextY);
       platformsRef.current.push(newP);
       if (newP.type === 'fragile') platformsRef.current.push(createPlatform(nextY, 'normal'));
    }
    platformsRef.current = platformsRef.current.filter(p => p.y < cameraYRef.current + GAME_HEIGHT + 100);
    monstersRef.current = monstersRef.current.filter(m => m.y < cameraYRef.current + GAME_HEIGHT + 600);
    holesRef.current = holesRef.current.filter(h => h.y < cameraYRef.current + GAME_HEIGHT + 600);
    particlesRef.current.forEach(p => { p.x += p.vx; p.vy += 0.25; p.y += p.vy; p.life -= 0.02; });
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);
    if (player.y > cameraYRef.current + GAME_HEIGHT + 400) { playBlip(100, 'sine', 0.6, 0.2, false); onGameOver(); }
  };

  const drawBackground = (ctx: CanvasRenderingContext2D, camY: number) => {
    const time = performance.now();
    const player = playerRef.current;
    const hParallaxBase = (player.x - GAME_WIDTH / 2) * 0.1;
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    ctx.fillStyle = 'white';
    starsLayer1.forEach(star => {
      const px = (star.x - hParallaxBase * 0.5 + Math.sin(time * 0.0005) * 20) % GAME_WIDTH;
      const py = (star.y - camY * 0.1 + time * star.driftSpeed) % GAME_HEIGHT;
      ctx.globalAlpha = star.opacity * (0.8 + Math.sin(time * 0.001 + star.x) * 0.2);
      ctx.beginPath(); ctx.arc(px < 0 ? px + GAME_WIDTH : px, py < 0 ? py + GAME_HEIGHT : py, star.size, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1.0;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.lineWidth = 1;
    const gY = -camY % 120;
    const gX = -hParallaxBase % 120;
    ctx.beginPath();
    for (let y = gY; y < GAME_HEIGHT; y += 120) { ctx.moveTo(0, y); ctx.lineTo(GAME_WIDTH, y); }
    for (let x = gX; x < GAME_WIDTH + 120; x += 120) { ctx.moveTo(x, 0); ctx.lineTo(x, GAME_HEIGHT); }
    ctx.stroke();
  };

  const drawHole = (ctx: CanvasRenderingContext2D, h: Hole, camY: number) => {
    const drawY = h.y - camY;
    const pulse = Math.sin(h.pulsePhase) * 4;
    const radius = h.radius + pulse;
    ctx.save();
    ctx.beginPath(); ctx.arc(h.x, drawY, h.radius * 2.2, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.05 + Math.sin(h.pulsePhase * 0.5) * 0.02})`;
    ctx.lineWidth = 1; ctx.stroke();
    const grad = ctx.createRadialGradient(h.x, drawY, radius * 0.1, h.x, drawY, radius);
    grad.addColorStop(0, '#000000'); grad.addColorStop(0.6, '#111827'); grad.addColorStop(1, '#374151');
    ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(h.x, drawY, radius, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  const drawMonster = (ctx: CanvasRenderingContext2D, m: Monster, camY: number) => {
    const drawY = m.y - camY;
    const pulse = Math.sin(Date.now() / 200) * (m.type === 'giant' ? 12 : 5);
    ctx.shadowBlur = m.type === 'giant' ? 40 : 20; ctx.shadowColor = m.color; ctx.fillStyle = m.color;
    ctx.beginPath();
    const spikes = m.type === 'giant' ? 24 : 12;
    for (let i = 0; i < spikes; i++) {
        const angle = (i / spikes) * Math.PI * 2;
        let r = m.radius + pulse;
        if (m.type === 'stalker') r += (i % 2 === 0 ? 15 : 0);
        const tx = m.x + Math.cos(angle) * r; const ty = drawY + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(tx, ty); else ctx.lineTo(tx, ty);
    }
    ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = 'white'; ctx.beginPath(); ctx.ellipse(m.x - 10, drawY - 5, 6, 8, 0, 0, Math.PI * 2); ctx.ellipse(m.x + 10, drawY - 5, 6, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(m.x - 10, drawY - 5, 3, 0, Math.PI * 2); ctx.arc(m.x + 10, drawY - 5, 3, 0, Math.PI * 2); ctx.fill();
  };

  const drawPlayer = (ctx: CanvasRenderingContext2D, player: Player, camY: number) => {
    const isSucking = suckingHoleIdRef.current !== null;
    const scale = isSucking ? (1 - suckProgressRef.current) : 1;
    if (scale <= 0) return;
    const pX = player.x; const pY = player.y - camY;
    const w = player.width; const h = player.height;
    ctx.save();
    ctx.translate(pX + w/2, pY + h/2);
    ctx.rotate(isSucking ? suckProgressRef.current * Math.PI * 10 : player.vx * 0.02);
    ctx.scale(scale, scale);
    ctx.translate(-(pX + w/2), -(pY + h/2));
    ctx.shadowBlur = 25; ctx.shadowColor = COLORS.player; ctx.fillStyle = COLORS.player;
    switch (player.character) {
      case 'triangle': ctx.beginPath(); ctx.moveTo(pX + w/2, pY); ctx.lineTo(pX + w, pY + h); ctx.lineTo(pX, pY + h); ctx.closePath(); ctx.fill(); break;
      case 'square': ctx.fillRect(pX, pY, w, h); break;
      case 'circle': ctx.beginPath(); ctx.arc(pX + w/2, pY + h/2, w/2, 0, Math.PI * 2); ctx.fill(); break;
      default: ctx.fillRect(pX, pY, w, h);
    }
    ctx.restore();
  };

  const draw = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const camY = cameraYRef.current;
    drawBackground(ctx, camY);
    holesRef.current.forEach(h => drawHole(ctx, h, camY));
    platformsRef.current.forEach(p => {
      if (p.broken) return;
      const drawY = p.y - camY;
      ctx.shadowBlur = 15; ctx.shadowColor = p.color; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.roundRect(p.x, drawY, p.width, p.height, 6); ctx.fill(); ctx.shadowBlur = 0;
    });
    monstersRef.current.forEach(m => drawMonster(ctx, m, camY));
    drawPlayer(ctx, playerRef.current, camY);
  };

  const animate = useCallback(() => {
    if (!isStarted) return;
    update();
    draw();
    requestRef.current = requestAnimationFrame(animate);
  }, [isStarted]);

  useEffect(() => {
    if (isStarted) { initGame(); requestRef.current = requestAnimationFrame(animate); }
    else { stopHoleSnd(); if (requestRef.current !== null) cancelAnimationFrame(requestRef.current); }
    return () => { stopHoleSnd(); if (requestRef.current !== null) cancelAnimationFrame(requestRef.current); };
  }, [isStarted, animate, initGame]);

  return (
    <div className="w-full h-full">
      <canvas 
        ref={canvasRef} 
        width={GAME_WIDTH} 
        height={GAME_HEIGHT} 
        className="w-full h-full object-contain" 
      />
    </div>
  );
};

export default GameCanvas;
