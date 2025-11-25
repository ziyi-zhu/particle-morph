import React from 'react';
import { ShapeType } from '../types';
import { Palette, Sofa, Flower2, Heart, Moon, Sparkles, Maximize2, Minimize2, MousePointer2 } from 'lucide-react';
import { ORDERED_SHAPES } from '../constants';

interface ControlsProps {
  currentShape: ShapeType;
  setShape: (s: ShapeType) => void;
  color: string;
  setColor: (c: string) => void;
  toggleFullscreen: () => void;
  isFullscreen: boolean;
  expansionFactor: number;
}

export const Controls: React.FC<ControlsProps> = ({
  currentShape,
  setShape,
  color,
  setColor,
  toggleFullscreen,
  isFullscreen,
  expansionFactor
}) => {
  
  const shapeIcons: Record<ShapeType, React.ElementType> = {
    [ShapeType.COUCH]: Sofa,
    [ShapeType.GARDEN]: Flower2,
    [ShapeType.KISS]: Heart,
    [ShapeType.NIGHT]: Moon,
    [ShapeType.WEDDING]: Sparkles
  };
  
  const shapeLabels: Record<ShapeType, string> = {
    [ShapeType.COUCH]: 'Couch',
    [ShapeType.GARDEN]: 'Garden',
    [ShapeType.KISS]: 'Kiss',
    [ShapeType.NIGHT]: 'Night',
    [ShapeType.WEDDING]: 'Wedding'
  };

  const colors = [
    '#00ffff', // Cyan
    '#ff0055', // Pink
    '#ffff00', // Yellow
    '#00ff00', // Green
    '#aa00ff', // Purple
    '#ff8800', // Orange
  ];

  return (
    <div className="fixed top-4 left-4 z-50 flex flex-col gap-4 max-w-xs">
      {/* Header */}
      <div className="bg-black/40 backdrop-blur-md border border-white/10 p-4 rounded-xl shadow-xl">
        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 mb-1">
          Particle Morph
        </h1>
        <p className="text-xs text-gray-400 flex items-center gap-1">
          <MousePointer2 size={10} /> Scroll to morph · Drag to rotate
        </p>
      </div>

      {/* Main Controls */}
      <div className="bg-black/60 backdrop-blur-xl border border-white/10 p-5 rounded-xl shadow-2xl space-y-6">
        
        {/* Shape Selector */}
        <div>
          <label className="text-xs uppercase font-bold tracking-wider text-gray-400 mb-3 block">Model Cycle</label>
          <div className="grid grid-cols-5 gap-2">
            {ORDERED_SHAPES.map((shapeType) => {
              const Icon = shapeIcons[shapeType];
              return (
                <button
                  key={shapeType}
                  onClick={() => setShape(shapeType)}
                  className={`flex items-center justify-center p-2 rounded-lg transition-all duration-300 ${
                    currentShape === shapeType 
                      ? 'bg-white/20 text-white shadow-[0_0_15px_rgba(255,255,255,0.3)] scale-110' 
                      : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-300'
                  }`}
                  title={shapeLabels[shapeType]}
                >
                  <Icon size={18} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Color Picker */}
        <div>
          <label className="text-xs uppercase font-bold tracking-wider text-gray-400 mb-3 flex items-center gap-2">
            <Palette size={12} /> Color
          </label>
          <div className="flex justify-between gap-2">
            {colors.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full border-2 transition-transform duration-300 ${
                  color === c ? 'border-white scale-110 shadow-[0_0_10px_currentColor]' : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: c, color: c }}
              />
            ))}
            {/* Custom Color Input */}
             <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-white/20 hover:border-white/50">
                <input 
                  type="color" 
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer opacity-0" 
                />
                <div className="w-full h-full" style={{ background: `conic-gradient(red, yellow, lime, aqua, blue, magenta, red)` }}></div>
             </div>
          </div>
        </div>

      </div>

      {/* Footer / Fullscreen */}
      <button 
        onClick={toggleFullscreen}
        className="self-start flex items-center gap-2 px-4 py-2 bg-black/40 hover:bg-white/10 text-white/80 rounded-lg text-xs backdrop-blur-md transition-colors"
      >
        {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Mode'}
      </button>
    </div>
  );
};