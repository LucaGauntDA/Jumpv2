
import React, { useState, useEffect, useCallback } from 'react';
import GameCanvas from './components/GameCanvas';
import { GameState, CharacterType } from './types';

const CHARACTERS: CharacterType[] = ['triangle', 'square', 'circle', 'diamond', 'star', 'hexagon', 'ghost', 'robot'];

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    highScore: parseInt(localStorage.getItem('jump-v2-highscore') || '0'),
    gameOver: false,
    gameStarted: false,
    milestoneReached: null,
    selectedCharacter: 'triangle'
  });

  const [input, setInput] = useState<{ left: boolean; right: boolean }>({
    left: false,
    right: false
  });

  // Pick a random character on initial load
  useEffect(() => {
    const randomChar = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
    setGameState(prev => ({ ...prev, selectedCharacter: randomChar }));
  }, []);

  const handleScoreUpdate = useCallback((newScore: number) => {
    setGameState(prev => {
      const updatedScore = Math.floor(newScore);
      const newHighScore = Math.max(prev.highScore, updatedScore);
      
      if (newHighScore > prev.highScore) {
        localStorage.setItem('jump-v2-highscore', newHighScore.toString());
      }

      return {
        ...prev,
        score: updatedScore,
        highScore: newHighScore
      };
    });
  }, []);

  const handleGameOver = useCallback(() => {
    setGameState(prev => {
        if (prev.gameOver) return prev;
        return { ...prev, gameOver: true };
    });
  }, []);

  const startGame = () => {
    // Select a new random character every time the game starts
    const randomChar = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
    setGameState(prev => ({ 
      ...prev, 
      gameStarted: true, 
      gameOver: false, 
      score: 0,
      selectedCharacter: randomChar
    }));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setInput(prev => ({ ...prev, left: true }));
      if (e.key === 'ArrowRight') setInput(prev => ({ ...prev, right: true }));
      if (e.key === 'Enter' && !gameState.gameStarted) startGame();
      if (e.key === 'Enter' && gameState.gameOver) startGame();
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setInput(prev => ({ ...prev, left: false }));
      if (e.key === 'ArrowRight') setInput(prev => ({ ...prev, right: false }));
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState.gameStarted, gameState.gameOver]);

  const onLeftStart = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setInput(p => ({ ...p, left: true }));
  };
  const onLeftEnd = (e: React.PointerEvent) => {
    setInput(p => ({ ...p, left: false }));
  };

  const onRightStart = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setInput(p => ({ ...p, right: true }));
  };
  const onRightEnd = (e: React.PointerEvent) => {
    setInput(p => ({ ...p, right: false }));
  };

  return (
    <div 
      className="relative w-screen h-screen flex items-center justify-center overflow-hidden bg-black select-none touch-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      <GameCanvas 
        input={input} 
        onScoreUpdate={handleScoreUpdate} 
        onGameOver={handleGameOver}
        isStarted={gameState.gameStarted && !gameState.gameOver}
        selectedCharacter={gameState.selectedCharacter}
      />

      {gameState.gameStarted && !gameState.gameOver && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none z-10">
          <div className="text-6xl font-black tracking-tighter opacity-80">{gameState.score}</div>
          <div className="text-xs uppercase tracking-[0.4em] opacity-40 font-bold mt-1">Distance</div>
        </div>
      )}

      {(!gameState.gameStarted || gameState.gameOver) && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center z-50 p-8 overflow-y-auto">
          <h1 className="text-7xl font-black italic tracking-tighter mb-2 text-white/90">
            JUMP <span className="text-blue-500">V2</span>
          </h1>
          <p className="text-white/40 uppercase tracking-[0.5em] text-[10px] mb-8">Minimalist Landscape Arcade</p>
          
          <div className="flex flex-col items-center gap-6 mb-12 w-full max-w-2xl">
            {gameState.gameOver ? (
              <div className="text-center animate-in fade-in zoom-in duration-300">
                <div className="text-red-500 font-black uppercase tracking-[0.2em] text-xl mb-1">GAME OVER</div>
                <div className="text-5xl font-black">{gameState.score}</div>
              </div>
            ) : (
                <div className="text-center">
                   <div className="text-white/30 font-bold uppercase tracking-widest text-xs mb-1">Character randomized every run</div>
                   <div className="flex items-center justify-center mt-4">
                      <div className="w-16 h-16 bg-white/10 rounded-2xl border border-white/20 flex items-center justify-center text-white">
                        {gameState.selectedCharacter === 'triangle' && <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l9 16H3z"/></svg>}
                        {gameState.selectedCharacter === 'square' && <div className="w-8 h-8 bg-current rounded-sm" />}
                        {gameState.selectedCharacter === 'circle' && <div className="w-8 h-8 bg-current rounded-full" />}
                        {gameState.selectedCharacter === 'diamond' && <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l10 10-10 10-10-10z"/></svg>}
                        {gameState.selectedCharacter === 'star' && <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 7h7l-5.5 4.5 2 7.5-6.5-5-6.5 5 2-7.5L2 9h7z"/></svg>}
                        {gameState.selectedCharacter === 'hexagon' && <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l8.66 5v10L12 22l-8.66-5V7z"/></svg>}
                        {gameState.selectedCharacter === 'ghost' && <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a8 8 0 00-8 8v12l3-3 3 3 3-3 3 3 3-3 3 3V10a8 8 0 00-8-8z"/></svg>}
                        {gameState.selectedCharacter === 'robot' && <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 8a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 01-2 2H8a2 2 0 01-2-2V8zm6-6v4m-4-2h8"/></svg>}
                      </div>
                   </div>
                </div>
            )}

            <div className="text-center border-t border-white/10 pt-6 w-full max-w-xs mt-4">
              <div className="text-white/30 text-[10px] uppercase tracking-[0.3em] font-bold mb-1">Personal Best</div>
              <div className="text-2xl font-bold text-white/80">{gameState.highScore}</div>
            </div>
          </div>

          <button 
            onClick={startGame}
            className="group relative px-24 py-6 bg-white text-black font-black uppercase tracking-[0.5em] transition-all hover:bg-blue-500 hover:text-white hover:scale-105 active:scale-95 shadow-[0_0_50px_rgba(255,255,255,0.15)]"
          >
            PLAY
          </button>

          <div className="mt-12 flex gap-12 opacity-20 text-[10px] uppercase font-bold tracking-widest">
            <div>Optimized for Tablet</div>
            <div>Landscape Mode</div>
          </div>
        </div>
      )}

      {gameState.gameStarted && !gameState.gameOver && (
        <div 
          className={`absolute left-0 top-0 bottom-0 w-1/2 flex items-end p-12 transition-colors cursor-pointer z-20 ${input.left ? 'bg-white/5' : ''}`}
          onPointerDown={onLeftStart}
          onPointerUp={onLeftEnd}
          onPointerCancel={onLeftEnd}
          onPointerLeave={onLeftEnd}
        >
          <div className={`w-24 h-24 border-2 rounded-full flex items-center justify-center transition-all ${input.left ? 'border-white/80 bg-white/20 scale-110 shadow-lg shadow-white/10' : 'border-white/10'}`}>
            <svg className={`w-10 h-10 transition-opacity ${input.left ? 'opacity-100' : 'opacity-20'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </div>
        </div>
      )}

      {gameState.gameStarted && !gameState.gameOver && (
        <div 
          className={`absolute right-0 top-0 bottom-0 w-1/2 flex items-end justify-end p-12 transition-colors cursor-pointer z-20 ${input.right ? 'bg-white/5' : ''}`}
          onPointerDown={onRightStart}
          onPointerUp={onRightEnd}
          onPointerCancel={onRightEnd}
          onPointerLeave={onRightEnd}
        >
          <div className={`w-24 h-24 border-2 rounded-full flex items-center justify-center transition-all ${input.right ? 'border-white/80 bg-white/20 scale-110 shadow-lg shadow-white/10' : 'border-white/10'}`}>
            <svg className={`w-10 h-10 transition-opacity ${input.right ? 'opacity-100' : 'opacity-20'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
