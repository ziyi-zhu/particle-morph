import React, { useRef, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PARTICLE_COUNT } from '../constants';
import { loadModelParticles } from '../services/modelLoader';

interface ThreeSceneProps {
  modelPath?: string;
  color: string;
  expansionFactor: number; // 0 (Shape) to 1 (Random Chaos)
  isLoading?: boolean;
}

export const ThreeScene: React.FC<ThreeSceneProps> = ({ modelPath, color, expansionFactor, isLoading = false }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const materialRef = useRef<THREE.PointsMaterial | null>(null);
  const animationFrameRef = useRef<number>(0);
  const controlsRef = useRef<OrbitControls | null>(null);
  
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
  const currentColorRef = useRef(color);
  
  // Color gradient parameters for animation loop
  const colorInsideRef = useRef<THREE.Color>(new THREE.Color('#ff6030'));
  const colorOutsideRef = useRef<THREE.Color>(new THREE.Color('#1b3984'));
  
  // Track if we've loaded at least one model
  const isInitializedRef = useRef(false);
  
  // Loading sphere positions
  const loadingSpherePositionsRef = useRef<Float32Array>(new Float32Array(0));
  
  // Store radial distances for color generation
  const radialDistancesRef = useRef<Float32Array>(new Float32Array(0));

  // Sync props to refs
  useEffect(() => {
    expansionFactorRef.current = expansionFactor;
  }, [expansionFactor]);
  
  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  // Generate Chaos Positions and Loading Galaxy Once
  useEffect(() => {
    const count = PARTICLE_COUNT * 3;
    const chaos = new Float32Array(count);
    const spread = 20; // Reduced spread to keep chaos more contained
    
    for (let i = 0; i < count; i++) {
        chaos[i] = (Math.random() - 0.5) * spread;
    }
    chaosPositionsRef.current = chaos;
    
    // Generate loading galaxy positions (spiral galaxy)
    // Parameters exactly matching the provided example
    const loadingGalaxy = new Float32Array(count);
    const radialDistances = new Float32Array(PARTICLE_COUNT);
    const galaxyParams = {
      radius: 10, // Exact value from example
      branches: 3,
      spin: 1,
      randomness: 1,
      randomnessPower: 1
    };
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      
      // Distance from center
      const r = Math.random() * galaxyParams.radius;
      radialDistances[i] = r; // Store for color generation
      
      // Which spiral arm
      const branchIndex = i % galaxyParams.branches;
      const branchAngle = (branchIndex / galaxyParams.branches) * Math.PI * 2;
      
      // Spin angle increases with distance from center
      const spinAngle = r * galaxyParams.spin;
      
      // Add randomness with power curve (more randomness further from center)
      // Using exact formula from example: (Math.random() - 0.5) gives range -0.5 to 0.5
      const randomX = Math.pow(Math.random(), galaxyParams.randomnessPower) *
        (Math.random() - 0.5) *
        galaxyParams.randomness * r;
      const randomY = Math.pow(Math.random(), galaxyParams.randomnessPower) *
        (Math.random() - 0.5) *
        galaxyParams.randomness * r;
      const randomZ = Math.pow(Math.random(), galaxyParams.randomnessPower) *
        (Math.random() - 0.5) *
        galaxyParams.randomness * r;
      
      // Calculate position on spiral arm
      loadingGalaxy[i3] = Math.cos(branchAngle + spinAngle) * r + randomX;
      loadingGalaxy[i3 + 1] = randomY;
      loadingGalaxy[i3 + 2] = Math.sin(branchAngle + spinAngle) * r + randomZ;
    }
    loadingSpherePositionsRef.current = loadingGalaxy;
    radialDistancesRef.current = radialDistances;
    
    // Initialize current positions to the loading galaxy
    if (currentPositionsRef.current.length === 0) {
      currentPositionsRef.current = new Float32Array(loadingGalaxy);
    }
  }, []);


  // Update Geometry when Model Path Changes
  useEffect(() => {
    if (!modelPath) return; // Skip if no model path yet
    
    let cancelled = false;
    
    const loadModel = async () => {
      try {
        const newPositions = await loadModelParticles(modelPath, PARTICLE_COUNT);
        
        if (cancelled) return;
        
        targetPositionsRef.current = newPositions;
      } catch (error) {
        console.error('Failed to load model:', error);
      }
    };
    
    loadModel();
    
    return () => {
      cancelled = true;
    };
  }, [modelPath]);

  // Generate particle colors based on chosen color with galaxy-style gradient
  // Exactly replicating the example's color generation algorithm
  const generateParticleColors = (baseColor: string): Float32Array => {
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    
    // Example uses #ff6030 as insideColor and #1b3984 as outsideColor
    // We need to derive the outsideColor based on the same relationship
    const exampleInsideColor = new THREE.Color('#ff6030');
    const exampleOutsideColor = new THREE.Color('#1b3984');
    const exampleInsideHSL = { h: 0, s: 0, l: 0 };
    const exampleOutsideHSL = { h: 0, s: 0, l: 0 };
    exampleInsideColor.getHSL(exampleInsideHSL);
    exampleOutsideColor.getHSL(exampleOutsideHSL);
    
    // Calculate the hue shift from the example
    let hueShift = exampleOutsideHSL.h - exampleInsideHSL.h;
    if (hueShift < 0) hueShift += 1;
    
    // Inside: use picked color directly (params.insideColor)
    const colorInside = new THREE.Color(baseColor);
    
    // Get picked color HSL to apply shift
    const pickedHSL = { h: 0, s: 0, l: 0 };
    colorInside.getHSL(pickedHSL);
    
    // Outside: apply the same hue shift, keeping example's saturation and lightness
    const colorOutside = new THREE.Color().setHSL(
      (pickedHSL.h + hueShift) % 1,
      exampleOutsideHSL.s,
      exampleOutsideHSL.l
    );
    
    const galaxyRadius = 10;
    const radialDistances = radialDistancesRef.current;
    
    // Generate colors exactly like the example
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      
      // Get actual radial distance for this particle
      const r = radialDistances.length > 0 ? radialDistances[i] : (i / PARTICLE_COUNT) * galaxyRadius;
      
      // Exact replication: mixedColor.lerp(colorOutside, r / params.radius)
      const mixedColor = colorInside.clone();
      mixedColor.lerp(colorOutside, r / galaxyRadius);
      
      colors[i3] = mixedColor.r;
      colors[i3 + 1] = mixedColor.g;
      colors[i3 + 2] = mixedColor.b;
    }
    
    return colors;
  };

  // Update particle colors when color changes - apply distance-based gradient to all particles
  useEffect(() => {
    currentColorRef.current = color;
    
    if (!geometryRef.current) return;
    
    // Get current positions to calculate distance-based colors
    const positions = currentPositionsRef.current;
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    
    // Use same color generation as spiral galaxy
    const exampleInsideColor = new THREE.Color('#ff6030');
    const exampleOutsideColor = new THREE.Color('#1b3984');
    const exampleInsideHSL = { h: 0, s: 0, l: 0 };
    const exampleOutsideHSL = { h: 0, s: 0, l: 0 };
    exampleInsideColor.getHSL(exampleInsideHSL);
    exampleOutsideColor.getHSL(exampleOutsideHSL);
    
    let hueShift = exampleOutsideHSL.h - exampleInsideHSL.h;
    if (hueShift < 0) hueShift += 1;
    
    const colorInside = new THREE.Color(color);
    const pickedHSL = { h: 0, s: 0, l: 0 };
    colorInside.getHSL(pickedHSL);
    
    const colorOutside = new THREE.Color().setHSL(
      (pickedHSL.h + hueShift) % 1,
      exampleOutsideHSL.s,
      exampleOutsideHSL.l
    );
    
    // Store colors for animation loop use
    colorInsideRef.current = colorInside.clone();
    colorOutsideRef.current = colorOutside.clone();
    
    // Calculate colors based on distance from center for ALL particles
    const maxRadius = 10; // Same as galaxy radius
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      
      // Calculate distance from center
      const x = positions[i3] || 0;
      const y = positions[i3 + 1] || 0;
      const z = positions[i3 + 2] || 0;
      const distance = Math.sqrt(x * x + y * y + z * z);
      
      // Normalize distance (clamp to maxRadius)
      const normalizedDistance = Math.min(distance / maxRadius, 1);
      
      // Apply same color gradient as galaxy
      const mixedColor = colorInside.clone();
      mixedColor.lerp(colorOutside, normalizedDistance);
      
      colors[i3] = mixedColor.r;
      colors[i3 + 1] = mixedColor.g;
      colors[i3 + 2] = mixedColor.b;
    }
    
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
    if (universeGeometryRef.current && universeGeometryRef.current.attributes.position) {
      const universeCount = 4000;
      const universePositions = universeGeometryRef.current.attributes.position.array as Float32Array;
      const universeColors = new Float32Array(universeCount * 3);
      
      for (let i = 0; i < universeCount; i++) {
        const i3 = i * 3;
        const x = universePositions[i3];
        const y = universePositions[i3 + 1];
        const z = universePositions[i3 + 2];
        const distance = Math.sqrt(x * x + y * y + z * z);
        const normalizedDistance = Math.min(distance / maxRadius, 1);
        
        const mixedColor = colorInside.clone();
        mixedColor.lerp(colorOutside, normalizedDistance);
        
        universeColors[i3] = mixedColor.r;
        universeColors[i3 + 1] = mixedColor.g;
        universeColors[i3 + 2] = mixedColor.b;
      }
      
      if (universeGeometryRef.current.attributes.color) {
        universeGeometryRef.current.attributes.color.array = universeColors;
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

      // Camera - Matching the example exactly
      const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
      camera.position.x = 3;
      camera.position.y = 3;
      camera.position.z = 3;
      camera.lookAt(0, 0, 0); // Center the view on origin
      cameraRef.current = camera;

      // Renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      mountRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;
      
      // OrbitControls - Matching the example exactly
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.autoRotate = true;
      controls.enableZoom = false; // Disable zooming as requested
      controls.enablePan = false; // Disable panning (shift+drag)
      controlsRef.current = controls;

      // Geometry - Start with loading sphere positions
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(currentPositionsRef.current, 3));
      geometryRef.current = geometry;

      // Generate initial particle colors
      const initialColors = generateParticleColors(color);
      particleColorsRef.current = initialColors;
      geometry.setAttribute('color', new THREE.BufferAttribute(initialColors, 3));

      // Material - Matching the example exactly
      const material = new THREE.PointsMaterial({
        color: '#6359ee', // Base color from example (purple tint)
        size: 0.01, // Exact value from example
        sizeAttenuation: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true
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
      // Adjusted for closer camera position (3,3,3)
      for (let i = 0; i < universeCount; i++) {
        const i3 = i * 3;
        
        // Varied radius: adjusted for closer camera
        const radiusRand = Math.random();
        let radius;
        if (radiusRand < 0.4) {
          // 40% closer particles
          radius = 15 + Math.random() * 5;
        } else if (radiusRand < 0.7) {
          // 30% mid-distance particles
          radius = 20 + Math.random() * 10;
        } else {
          // 30% far particles
          radius = 30 + Math.random() * 20;
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
        color: '#6359ee', // Base color from example
        size: 0.01, // Exact value from example
        sizeAttenuation: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
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

      // Animation Loop
      let time = 0;
      const animate = () => {
        time += 0.005;
      
      // Update OrbitControls
      if (controlsRef.current) {
        controlsRef.current.update();
      }
      
      if (particlesRef.current && geometryRef.current) {

        const positions = geometryRef.current.attributes.position.array as Float32Array;
        const colors = geometryRef.current.attributes.color.array as Float32Array;
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
            // Apply exponential curve for smooth gravity well effect near form
            // This makes scrolling feel slower when approaching the shape
            const rawMix = expansionFactorRef.current;
            // Use power curve: mix^5 creates very strong attraction near form (0)
            // and faster transition away from it
            const mix = Math.pow(rawMix, 5);

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
        
        // Update colors based on current particle distances from center
        // This ensures models have the same distance-based color gradient as the spiral
        const maxRadius = 10;
        const colorInside = colorInsideRef.current;
        const colorOutside = colorOutsideRef.current;
        
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const i3 = i * 3;
          
          // Calculate distance from center using current positions
          const x = positions[i3];
          const y = positions[i3 + 1];
          const z = positions[i3 + 2];
          const distance = Math.sqrt(x * x + y * y + z * z);
          
          // Normalize distance
          const normalizedDistance = Math.min(distance / maxRadius, 1);
          
          // Apply color gradient
          const mixedColor = colorInside.clone();
          mixedColor.lerp(colorOutside, normalizedDistance);
          
          colors[i3] = mixedColor.r;
          colors[i3 + 1] = mixedColor.g;
          colors[i3 + 2] = mixedColor.b;
        }
        
        geometryRef.current.attributes.color.needsUpdate = true;
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }

        animationFrameRef.current = requestAnimationFrame(animate);
      };

      animate();

      return () => {
        window.removeEventListener('resize', handleResize);
        
        // Dispose OrbitControls
        if (controlsRef.current) {
          controlsRef.current.dispose();
          controlsRef.current = null;
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