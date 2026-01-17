
export const GAME_WIDTH = 1200;
export const GAME_HEIGHT = 800;

export const GRAVITY = 0.45;
export const JUMP_FORCE = -14;
export const BOOST_FORCE = -24;
export const MOVE_SPEED = 1.1; // Increased for better control
export const FRICTION = 0.94;  // Slightly reduced friction for longer slides
export const MAX_VX = 13;     // Slightly higher max speed

export const COLORS = {
  player: '#FFFFFF',
  playerTrail: 'rgba(255, 255, 255, 0.3)',
  platformNormal: '#4ade80', // Cyan/Green
  platformMoving: '#60a5fa', // Blue
  platformFragile: '#f87171', // Red
  platformBoost: '#facc15', // Yellow
  monster: '#d946ef', // Magenta/Purple
  background: '#0a0a0a',
  uiText: '#ffffff'
};

export const PLATFORM_WIDTH = 100;
export const PLATFORM_HEIGHT = 15;
export const PLATFORM_SPACING = 160; // Slightly more spacing but still very safe for jump height
