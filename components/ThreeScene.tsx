import React, { useRef, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { PARTICLE_COUNT } from '../constants';
import { ShapeType } from '../types';
import { loadModelParticles } from '../services/modelLoader';

interface ThreeSceneProps {
  shape: ShapeType;
  color: string;
  expansionFactor: number; // 0 (Shape) to 1 (Random Chaos)
}

export const ThreeScene: React.FC<ThreeSceneProps> = ({ shape, color, expansionFactor }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const materialRef = useRef<THREE.PointsMaterial | null>(null);
  const animationFrameRef = useRef<number>(0);
  
  // Refs to track state inside the animation loop
  const targetPositionsRef = useRef<Float32Array>(new Float32Array(0));
  const chaosPositionsRef = useRef<Float32Array>(new Float32Array(0));
  const currentPositionsRef = useRef<Float32Array>(new Float32Array(0));
  const expansionFactorRef = useRef(expansionFactor);
  
  // Drag rotation state
  const isDraggingRef = useRef(false);
  const rotationYRef = useRef(0);
  const lastMouseXRef = useRef(0);
  const lastTimeRef = useRef(0);
  
  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  const isInitializedRef = useRef(false);

  // Sync prop to ref
  useEffect(() => {
    expansionFactorRef.current = expansionFactor;
  }, [expansionFactor]);

  // Generate Chaos Positions (Uniform Random Cloud) Once
  useEffect(() => {
    const count = PARTICLE_COUNT * 3;
    const chaos = new Float32Array(count);
    const spread = 200; // Large spread for the chaos state
    
    for (let i = 0; i < count; i++) {
        chaos[i] = (Math.random() - 0.5) * spread;
    }
    chaosPositionsRef.current = chaos;
  }, []);

  // Generate initial texture for particles
  const particleTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)');
      gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 32, 32);
    }
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, []);

  // Update Geometry when Shape Changes
  useEffect(() => {
    let cancelled = false;
    
    const loadShape = async () => {
      try {
        const newPositions = await loadModelParticles(shape, PARTICLE_COUNT);
        
        if (cancelled) return;
        
        targetPositionsRef.current = newPositions;
        
        // If first run, set current positions to new positions
        if (currentPositionsRef.current.length === 0) {
          currentPositionsRef.current = new Float32Array(newPositions);
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load model:', error);
      }
    };
    
    loadShape();
    
    return () => {
      cancelled = true;
    };
  }, [shape]);

  // Update Material Color
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.color.set(color);
    }
  }, [color]);

  // Setup Three.js
  useEffect(() => {
    if (!mountRef.current || isInitializedRef.current) return;
    isInitializedRef.current = true;

    const initScene = async () => {
      if (!mountRef.current) return;

      // Scene
      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x050505, 0.002);
      sceneRef.current = scene;

      // Camera
      const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      camera.position.z = 60;
      cameraRef.current = camera;

      // Renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      mountRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Geometry - Load initial model
      const geometry = new THREE.BufferGeometry();
      try {
        const positions = await loadModelParticles(shape, PARTICLE_COUNT);
        targetPositionsRef.current = positions;
        currentPositionsRef.current = new Float32Array(positions);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load initial model:', error);
        // Create empty positions as fallback
        const positions = new Float32Array(PARTICLE_COUNT * 3);
        targetPositionsRef.current = positions;
        currentPositionsRef.current = positions;
      }
      
      geometry.setAttribute('position', new THREE.BufferAttribute(currentPositionsRef.current, 3));
      geometryRef.current = geometry;

      // Material
      const material = new THREE.PointsMaterial({
        color: color,
        size: 0.8,
        map: particleTexture,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      materialRef.current = material;

      // Points Mesh
      const particles = new THREE.Points(geometry, material);
      scene.add(particles);
      particlesRef.current = particles;

      // Resize Handler
      const handleResize = () => {
        if (cameraRef.current && rendererRef.current) {
          cameraRef.current.aspect = window.innerWidth / window.innerHeight;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(window.innerWidth, window.innerHeight);
        }
      };
      window.addEventListener('resize', handleResize);

      // Drag rotation handlers
      const handleMouseDown = (e: MouseEvent) => {
        isDraggingRef.current = true;
        lastMouseXRef.current = e.clientX;
        lastTimeRef.current = time;
      };

      const handleMouseMove = (e: MouseEvent) => {
        if (!isDraggingRef.current) return;
        
        const deltaX = e.clientX - lastMouseXRef.current;
        // Convert pixel movement to rotation (sensitivity factor)
        const rotationDelta = (deltaX / window.innerWidth) * Math.PI * 2;
        rotationYRef.current += rotationDelta;
        lastMouseXRef.current = e.clientX;
      };

      const handleMouseUp = () => {
        isDraggingRef.current = false;
        lastTimeRef.current = time;
      };

      // Touch handlers for mobile
      const handleTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 1) {
          isDraggingRef.current = true;
          lastMouseXRef.current = e.touches[0].clientX;
          lastTimeRef.current = time;
        }
      };

      const handleTouchMove = (e: TouchEvent) => {
        if (!isDraggingRef.current || e.touches.length !== 1) return;
        
        const deltaX = e.touches[0].clientX - lastMouseXRef.current;
        const rotationDelta = (deltaX / window.innerWidth) * Math.PI * 2;
        rotationYRef.current += rotationDelta;
        lastMouseXRef.current = e.touches[0].clientX;
      };

      const handleTouchEnd = () => {
        isDraggingRef.current = false;
        lastTimeRef.current = time;
      };

      // Add event listeners
      const canvas = rendererRef.current.domElement;
      canvas.addEventListener('mousedown', handleMouseDown);
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      canvas.addEventListener('touchstart', handleTouchStart);
      canvas.addEventListener('touchmove', handleTouchMove);
      canvas.addEventListener('touchend', handleTouchEnd);

      // Animation Loop
      let time = 0;
      const animate = () => {
        time += 0.005;
      
      if (particlesRef.current && geometryRef.current) {
        // Rotation logic: combine automatic rotation with manual drag rotation
        if (!isDraggingRef.current) {
          // When not dragging, add automatic rotation
          const timeDelta = time - lastTimeRef.current;
          rotationYRef.current += timeDelta * 0.2;
          lastTimeRef.current = time;
        }
        // Apply rotation
        particlesRef.current.rotation.y = rotationYRef.current;
        particlesRef.current.rotation.x = Math.sin(time * 0.3) * 0.1;

        const positions = geometryRef.current.attributes.position.array as Float32Array;
        const targets = targetPositionsRef.current; // The current Shape
        const chaos = chaosPositionsRef.current;    // The Random Cloud
        const current = currentPositionsRef.current;
        
        // When morph < 0.1, show 100% form (mix = 0)
        const rawMix = expansionFactorRef.current;
        const mix = rawMix < 0.1 ? 0 : rawMix;
        const lerpSpeed = 0.08; 

        for (let i = 0; i < PARTICLE_COUNT * 3; i++) {
            const shapePos = targets[i];
            const chaosPos = chaos[i];
            
            // Linear interpolation between Shape and Chaos based on expansion factor
            // When mix is 0, goal is shapePos.
            // When mix is 1, goal is chaosPos.
            let goal = shapePos + (chaosPos - shapePos) * mix;

            // Optional: Add a slight breath/pulse to the expanded state to make it feel alive
            if (mix > 0.1) {
                goal += Math.sin(time * 3 + i) * (mix * 0.5);
            }

            // Move particle towards goal
            current[i] += (goal - current[i]) * lerpSpeed;
            positions[i] = current[i];
        }

        geometryRef.current.attributes.position.needsUpdate = true;
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }

        animationFrameRef.current = requestAnimationFrame(animate);
      };

      animate();

      return () => {
        window.removeEventListener('resize', handleResize);
        
        // Remove drag event listeners
        if (rendererRef.current) {
          const canvas = rendererRef.current.domElement;
          canvas.removeEventListener('mousedown', handleMouseDown);
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
          canvas.removeEventListener('touchstart', handleTouchStart);
          canvas.removeEventListener('touchmove', handleTouchMove);
          canvas.removeEventListener('touchend', handleTouchEnd);
        }
        
        // Cancel animation frame
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = 0;
        }
        
        // Remove canvas from DOM
        if (rendererRef.current) {
          const canvas = rendererRef.current.domElement;
          if (canvas && canvas.parentNode) {
            canvas.parentNode.removeChild(canvas);
          }
          rendererRef.current.dispose();
          rendererRef.current = null;
        }
        
        // Dispose of Three.js resources
        if (geometryRef.current) {
          geometryRef.current.dispose();
          geometryRef.current = null;
        }
        if (materialRef.current) {
          materialRef.current.dispose();
          materialRef.current = null;
        }
        if (sceneRef.current) {
          sceneRef.current.clear();
          sceneRef.current = null;
        }
        
        particleTexture.dispose();
        particlesRef.current = null;
        isInitializedRef.current = false;
      };
    };

    initScene();
    
    // Cleanup function
    return () => {
      // The cleanup will be handled by the initScene's returned function
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  return (
    <>
      <div ref={mountRef} className="absolute inset-0 z-0" />
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="text-white/50 text-sm">Loading model...</div>
        </div>
      )}
    </>
  );
};