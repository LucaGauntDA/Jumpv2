
export type PlatformType = 'normal' | 'moving' | 'fragile' | 'boost';
export type CharacterType = 'triangle' | 'square' | 'circle' | 'diamond' | 'star' | 'hexagon' | 'ghost' | 'robot' | 'duck';
export type MonsterType = 'standard' | 'stalker' | 'giant' | 'wobbler';

export interface Platform {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: PlatformType;
  color: string;
  moveDirection?: number;
  moveRange?: number;
  initialX?: number;
  broken?: boolean;
}

export interface Monster {
  id: string;
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  moveRange: number;
  initialX: number;
  initialY: number;
  color: string;
  type: MonsterType;
  phase?: number;
}

export interface Hole {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  pulsePhase: number;
}

export interface Player {
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  color: string;
  character: CharacterType;
}

export interface GameState {
  score: number;
  highScore: number;
  gameOver: boolean;
  gameStarted: boolean;
  milestoneReached: string | null;
  selectedCharacter: CharacterType;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}
