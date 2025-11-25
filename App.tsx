import React, { useState, useEffect } from 'react';
import { ThreeScene } from './components/ThreeScene';
import { Controls } from './components/Controls';
import { ShapeType } from './types';
import { DEFAULT_COLOR, ORDERED_SHAPES } from './constants';
import { preloadAllModels } from './services/modelLoader';

const App: React.FC = () => {
  const [color, setColor] = useState<string>(DEFAULT_COLOR);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [modelsLoaded, setModelsLoaded] = useState<boolean>(false);
  
  // scrollPos drives everything. 
  // Integer values = specific models (0=Bunny, 1=Cat, 2=Table, 3=Zaghetto)
  // X.5 values = Maximum Chaos
  // Start at -0.5 (chaos before first model) so scrolling down goes to first model
  const [scrollPos, setScrollPos] = useState<number>(-0.5);

  // Derived State Logic
  const shapeCount = ORDERED_SHAPES.length;
  
  // Normalize scrollPos to be positive for modulo math
  // We allow negative scroll, so we assume a loop behavior
  const normalizedPos = scrollPos < 0 
    ? (scrollPos % shapeCount + shapeCount) 
    : scrollPos;
    
  // The active shape is determined by the nearest integer
  // e.g. 0.0 -> 0, 0.49 -> 0, 0.51 -> 1, 1.0 -> 1
  const activeIndex = Math.round(normalizedPos);
  // Safe modulo to get actual array index
  const safeIndex = ((activeIndex % shapeCount) + shapeCount) % shapeCount;
  const currentShape = ORDERED_SHAPES[safeIndex];

  // Expansion Factor (Chaos)
  // Distance from nearest integer. 
  // At integer (distance 0) -> Expansion 0.
  // At X.5 (distance 0.5) -> Expansion 1.
  const distFromInteger = Math.abs(normalizedPos - activeIndex);
  const expansionFactor = distFromInteger * 2; // Map 0..0.5 to 0..1

  // Handle Wheel Scroll
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault(); // Prevent default page scrolling
      // Sensitivity: 0.0001 for very slow, smooth control
      const delta = e.deltaY * 0.0001;
      setScrollPos(prev => prev + delta);
    };

    // Use passive: false to allow preventDefault
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  const handleSetShape = (shape: ShapeType) => {
    const index = ORDERED_SHAPES.indexOf(shape);
    if (index !== -1) {
      // Jump scroll position to the canonical integer for that shape
      // To keep it smooth, we could find the nearest multiple, but jumping to the base index is acceptable
      // Finding nearest multiple to current scrollPos to avoid massive jumps:
      const currentRound = Math.round(scrollPos);
      const currentMod = ((currentRound % shapeCount) + shapeCount) % shapeCount;
      const diff = index - currentMod;
      setScrollPos(currentRound + diff);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  // Sync state with ESC key
  useEffect(() => {
    const handler = () => {
        setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Preload all models at startup
  useEffect(() => {
    preloadAllModels()
      .then(() => {
        setModelsLoaded(true);
      })
      .catch(error => {
        console.error('Failed to preload models:', error);
        setModelsLoaded(true); // Still show the app even if loading fails
      });
  }, []);

  return (
    <div className="relative w-full h-screen bg-[#050505] overflow-hidden selection:bg-none">
      
      {/* Loading Screen */}
      {!modelsLoaded && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#050505]">
          <div className="flex gap-2 justify-center">
            <div className="w-3 h-3 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-3 h-3 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-3 h-3 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      )}

      {/* 3D Scene Background - Only render when loaded */}
      {modelsLoaded && (
        <ThreeScene 
          shape={currentShape} 
          color={color} 
          expansionFactor={expansionFactor} 
        />
      )}

      {/* UI Overlay - Only render when loaded */}
      {modelsLoaded && (
        <Controls 
          currentShape={currentShape}
          setShape={handleSetShape}
          color={color}
          setColor={setColor}
          toggleFullscreen={toggleFullscreen}
          isFullscreen={isFullscreen}
          expansionFactor={expansionFactor}
        />
      )}

      {/* Optional decorative background elements - Only show when loaded */}
      {modelsLoaded && (
        <div className="absolute bottom-4 left-0 w-full text-center pointer-events-none">
           <p className="text-[10px] text-white/10 tracking-[0.3em] font-light">
              SCROLL TO MORPH · DRAG TO ROTATE
           </p>
        </div>
      )}
    </div>
  );
};

export default App;