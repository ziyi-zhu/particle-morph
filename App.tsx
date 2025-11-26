import React, { useState, useEffect } from 'react';
import { ThreeScene } from './components/ThreeScene';
import { Controls } from './components/Controls';
import { ShapeType } from './types';
import { DEFAULT_COLOR, ORDERED_SHAPES, DESIGNATION_MAP } from './constants';
import { preloadAllModels } from './services/modelLoader';
import { Send } from 'lucide-react';

const App: React.FC = () => {
  const [color, setColor] = useState<string>(DEFAULT_COLOR);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const [modelsLoaded, setModelsLoaded] = useState<boolean>(false);
  const [designation, setDesignation] = useState<string>('');
  const [designationError, setDesignationError] = useState<string>('');
  
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

  // Handle Wheel Scroll (disabled during loading)
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!modelsLoaded) return; // Disable scrolling while loading
      e.preventDefault(); // Prevent default page scrolling
      const delta = e.deltaY * 0.0002;
      setScrollPos(prev => prev + delta);
    };

    // Use passive: false to allow preventDefault
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [modelsLoaded]);

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

  // Handle designation submission
  const handleDesignationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedDesignation = designation.trim();
    
    if (!trimmedDesignation) {
      setDesignationError('Please enter a designation');
      return;
    }
    
    if (!DESIGNATION_MAP[trimmedDesignation]) {
      setDesignationError('Designation not found');
      return;
    }
    
    // Valid designation - proceed
    setDesignationError('');
    setHasStarted(true);
  };

  // Preload all models after user submits valid designation
  useEffect(() => {
    if (!hasStarted) return;
    
    preloadAllModels()
      .then(() => {
        setModelsLoaded(true);
      })
      .catch(error => {
        console.error('Failed to preload models:', error);
        setModelsLoaded(true); // Still show the app even if loading fails
      });
  }, [hasStarted]);

  return (
    <div className="relative w-full h-screen bg-[#050505] overflow-hidden selection:bg-none">
      
      {/* 3D Scene Background - Always rendered */}
      <ThreeScene 
        shape={currentShape} 
        color={color} 
        expansionFactor={expansionFactor}
        isLoading={!modelsLoaded}
      />

      {/* Designation Input Panel - Show before user starts */}
      {!hasStarted && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleDesignationSubmit} className="bg-black/60 backdrop-blur-xl border border-white/10 p-6 rounded-xl shadow-2xl space-y-4 w-full max-w-md">
            <label className="text-xs uppercase font-bold tracking-wider text-gray-400 block">
              Designation
            </label>
            <div className="relative">
              <input
                type="text"
                value={designation}
                onChange={(e) => {
                  setDesignation(e.target.value);
                  setDesignationError('');
                }}
                placeholder="Enter designation"
                className="w-full px-4 py-3 pr-12 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-white/20 focus:bg-white/20 focus:shadow-[0_0_15px_rgba(255,255,255,0.3)] focus:scale-[1.02] transition-all duration-300"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-white/60 hover:text-white transition-all duration-300 hover:scale-105"
              >
                <Send size={18} />
              </button>
            </div>
            {designationError && (
              <p className="text-red-400 text-sm">{designationError}</p>
            )}
          </form>
        </div>
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