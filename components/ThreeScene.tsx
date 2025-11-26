import React, { useRef, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { PARTICLE_COUNT } from '../constants';
import { ShapeType } from '../types';
import { loadModelParticles } from '../services/modelLoader';

interface ThreeSceneProps {
  shape: ShapeType;
  color: string;
  expansionFactor: number; // 0 (Shape) to 1 (Random Chaos)
  isLoading?: boolean;
}

export const ThreeScene: React.FC<ThreeSceneProps> = ({ shape, color, expansionFactor, isLoading = false }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const materialRef = useRef<THREE.PointsMaterial | null>(null);
  const animationFrameRef = useRef<number>(0);
  
  // Universe background particles
  const universeParticlesRef = useRef<THREE.Points | null>(null);
  const universeGeometryRef = useRef<THREE.BufferGeometry | null>(null);
  
  // Refs to track state inside the animation loop
  const targetPositionsRef = useRef<Float32Array>(new Float32Array(0));
  const chaosPositionsRef = useRef<Float32Array>(new Float32Array(0));
  const currentPositionsRef = useRef<Float32Array>(new Float32Array(0));
  const expansionFactorRef = useRef(expansionFactor);
  const particleColorsRef = useRef<Float32Array>(new Float32Array(0));
  const isLoadingRef = useRef(isLoading);
  
  // Drag rotation state
  const isDraggingRef = useRef(false);
  const rotationYRef = useRef(0);
  const lastMouseXRef = useRef(0);
  const lastTimeRef = useRef(0);
  
  // Track if we've loaded at least one model
  const isInitializedRef = useRef(false);
  
  // Loading sphere positions
  const loadingSpherePositionsRef = useRef<Float32Array>(new Float32Array(0));

  // Sync props to refs
  useEffect(() => {
    expansionFactorRef.current = expansionFactor;
  }, [expansionFactor]);
  
  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  // Generate Chaos Positions and Loading Sphere Once
  useEffect(() => {
    const count = PARTICLE_COUNT * 3;
    const chaos = new Float32Array(count);
    const spread = 200; // Large spread for the chaos state
    
    for (let i = 0; i < count; i++) {
        chaos[i] = (Math.random() - 0.5) * spread;
    }
    chaosPositionsRef.current = chaos;
    
    // Generate loading sphere positions
    const loadingSphere = new Float32Array(count);
    const radius = 30;
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      loadingSphere[i3] = radius * Math.sin(phi) * Math.cos(theta);
      loadingSphere[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      loadingSphere[i3 + 2] = radius * Math.cos(phi);
    }
    loadingSpherePositionsRef.current = loadingSphere;
    
    // Initialize current positions to the loading sphere
    if (currentPositionsRef.current.length === 0) {
      currentPositionsRef.current = new Float32Array(loadingSphere);
    }
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
      } catch (error) {
        console.error('Failed to load model:', error);
      }
    };
    
    loadShape();
    
    return () => {
      cancelled = true;
    };
  }, [shape]);

  // Generate particle colors based on chosen color with variations
  const generateParticleColors = (baseColor: string): Float32Array => {
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const colorObj = new THREE.Color(baseColor);
    
    // Convert to HSL for hue manipulation
    const hsl = { h: 0, s: 0, l: 0 };
    colorObj.getHSL(hsl);
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      const rand = Math.random();
      
      // 60% particles: base color with brightness variations (predominant color)
      if (rand < 0.6) {
        const brightness = 0.7 + Math.random() * 0.6; // 0.7 to 1.3
        const hueShift = (Math.random() - 0.5) * 0.2; // Moderate hue variation ±10%
        const newColor = new THREE.Color().setHSL(
          (hsl.h + hueShift + 1) % 1,
          hsl.s * (0.9 + Math.random() * 0.2), // Slight saturation variation
          hsl.l * brightness
        );
        colors[i3] = newColor.r;
        colors[i3 + 1] = newColor.g;
        colors[i3 + 2] = newColor.b;
      }
      // 25% particles: brighter stars with hue shifts
      else if (rand < 0.85) {
        const hueShift = (Math.random() - 0.5) * 0.4; // Larger hue variation ±20%
        const brightness = 0.8 + Math.random() * 0.5;
        const whiteness = Math.random() * 0.4; // Less white, more color
        const newColor = new THREE.Color().setHSL(
          (hsl.h + hueShift + 1) % 1,
          hsl.s * (0.7 + whiteness * 0.3), // Desaturate slightly for brightness
          Math.min(0.95, hsl.l * brightness + whiteness * 0.3)
        );
        colors[i3] = newColor.r;
        colors[i3 + 1] = newColor.g;
        colors[i3 + 2] = newColor.b;
      }
      // 10% particles: complementary/accent colors with larger hue shifts
      else if (rand < 0.95) {
        const hueShift = (Math.random() - 0.5) * 0.6; // Large hue variation ±30%
        const brightness = 0.6 + Math.random() * 0.5;
        const newColor = new THREE.Color().setHSL(
          (hsl.h + hueShift + 1) % 1,
          hsl.s * (0.8 + Math.random() * 0.4),
          hsl.l * brightness
        );
        colors[i3] = newColor.r;
        colors[i3 + 1] = newColor.g;
        colors[i3 + 2] = newColor.b;
      }
      // 5% particles: very bright stars with rainbow variety
      else {
        const hueShift = (Math.random() - 0.5) * 0.5; // ±25% hue variation
        const brightness = 1.2 + Math.random() * 0.3;
        const newColor = new THREE.Color().setHSL(
          (hsl.h + hueShift + 1) % 1,
          hsl.s * (0.7 + Math.random() * 0.3),
          Math.min(0.95, hsl.l * brightness)
        );
        colors[i3] = newColor.r;
        colors[i3 + 1] = newColor.g;
        colors[i3 + 2] = newColor.b;
      }
    }
    
    return colors;
  };

  // Update particle colors when color changes
  useEffect(() => {
    if (!geometryRef.current) return;
    
    const colors = generateParticleColors(color);
    particleColorsRef.current = colors;
    
    if (geometryRef.current.attributes.color) {
      geometryRef.current.attributes.color.array = colors;
      geometryRef.current.attributes.color.needsUpdate = true;
    } else {
      geometryRef.current.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
    
    // Material should use vertex colors
    if (materialRef.current) {
      materialRef.current.vertexColors = true;
      materialRef.current.needsUpdate = true;
    }
    
    // Update universe particle colors with same style
    if (universeGeometryRef.current) {
      const universeCount = 4000;
      const universeColors = generateParticleColors(color);
      // Use only the first 4000 colors from the generated array
      const trimmedColors = universeColors.slice(0, universeCount * 3);
      
      if (universeGeometryRef.current.attributes.color) {
        universeGeometryRef.current.attributes.color.array = trimmedColors;
        universeGeometryRef.current.attributes.color.needsUpdate = true;
      }
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

      // Geometry - Start with loading sphere positions
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(currentPositionsRef.current, 3));
      geometryRef.current = geometry;

      // Generate initial particle colors
      const initialColors = generateParticleColors(color);
      particleColorsRef.current = initialColors;
      geometry.setAttribute('color', new THREE.BufferAttribute(initialColors, 3));

      // Material
      const material = new THREE.PointsMaterial({
        size: 0.8,
        map: particleTexture,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        vertexColors: true // Enable vertex colors
      });
      materialRef.current = material;

      // Points Mesh
      const particles = new THREE.Points(geometry, material);
      scene.add(particles);
      particlesRef.current = particles;

      // Create sparse universe background particles
      const universeCount = 4000; // More background stars
      const universeGeometry = new THREE.BufferGeometry();
      const universePositions = new Float32Array(universeCount * 3);
      
      // Distribute particles with varied distances for depth
      for (let i = 0; i < universeCount; i++) {
        const i3 = i * 3;
        
        // Varied radius: some closer (50-70), some mid (70-100), some far (100-140)
        const radiusRand = Math.random();
        let radius;
        if (radiusRand < 0.4) {
          // 40% closer particles
          radius = 50 + Math.random() * 20;
        } else if (radiusRand < 0.7) {
          // 30% mid-distance particles
          radius = 70 + Math.random() * 30;
        } else {
          // 30% far particles
          radius = 100 + Math.random() * 40;
        }
        
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        
        universePositions[i3] = radius * Math.sin(phi) * Math.cos(theta);
        universePositions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        universePositions[i3 + 2] = radius * Math.cos(phi);
      }
      
      // Use same color generation as main particles
      const universeColors = generateParticleColors(color);
      const trimmedColors = universeColors.slice(0, universeCount * 3);
      
      universeGeometry.setAttribute('position', new THREE.BufferAttribute(universePositions, 3));
      universeGeometry.setAttribute('color', new THREE.BufferAttribute(trimmedColors, 3));
      universeGeometryRef.current = universeGeometry;
      
      // Use same material properties as main particles
      const universeMaterial = new THREE.PointsMaterial({
        size: 0.8, // Same size as main particles
        map: particleTexture,
        transparent: true,
        opacity: 0.8, // Same opacity as main particles
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        vertexColors: true
      });
      
      const universeParticles = new THREE.Points(universeGeometry, universeMaterial);
      scene.add(universeParticles);
      universeParticlesRef.current = universeParticles;

      // Resize Handler
      const handleResize = () => {
        if (cameraRef.current && rendererRef.current) {
          cameraRef.current.aspect = window.innerWidth / window.innerHeight;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(window.innerWidth, window.innerHeight);
        }
      };
      window.addEventListener('resize', handleResize);

      // Drag rotation handlers (disabled during loading)
      const handleMouseDown = (e: MouseEvent) => {
        if (isLoadingRef.current) return;
        isDraggingRef.current = true;
        lastMouseXRef.current = e.clientX;
        lastTimeRef.current = time;
      };

      const handleMouseMove = (e: MouseEvent) => {
        if (!isDraggingRef.current || isLoadingRef.current) return;
        
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

      // Touch handlers for mobile (disabled during loading)
      const handleTouchStart = (e: TouchEvent) => {
        if (isLoadingRef.current) return;
        if (e.touches.length === 1) {
          isDraggingRef.current = true;
          lastMouseXRef.current = e.touches[0].clientX;
          lastTimeRef.current = time;
        }
      };

      const handleTouchMove = (e: TouchEvent) => {
        if (!isDraggingRef.current || e.touches.length !== 1 || isLoadingRef.current) return;
        
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
        // Apply rotation to main particles
        particlesRef.current.rotation.y = rotationYRef.current;
        particlesRef.current.rotation.x = Math.sin(time * 0.3) * 0.1;
        
        // Apply same rotation to universe particles
        if (universeParticlesRef.current) {
          universeParticlesRef.current.rotation.y = rotationYRef.current;
          universeParticlesRef.current.rotation.x = Math.sin(time * 0.3) * 0.1;
        }

        const positions = geometryRef.current.attributes.position.array as Float32Array;
        const current = currentPositionsRef.current;
        const lerpSpeed = 0.03; // Slower morphing speed for smoother transitions
        
        // When loading, morph to the loading sphere
        if (isLoadingRef.current) {
          const loadingSphere = loadingSpherePositionsRef.current;
          
          for (let i = 0; i < PARTICLE_COUNT * 3; i++) {
            const goal = loadingSphere[i];
            current[i] += (goal - current[i]) * lerpSpeed;
            positions[i] = current[i];
          }
        } else {
          // Normal morphing between shape and chaos
          const targets = targetPositionsRef.current; // The current Shape
          const chaos = chaosPositionsRef.current;    // The Random Cloud
          
          // Only morph if we have valid target positions
          if (targets.length > 0) {
            // When morph < 0.4, show 100% form (mix = 0)
            const rawMix = expansionFactorRef.current;
            const mix = rawMix < 0.4 ? 0 : rawMix;

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
          }
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

  return <div ref={mountRef} className="absolute inset-0 z-0" />;
};