import * as THREE from 'three';
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PARTICLE_COUNT, getModelFileType } from '../constants';

// Cache loaded model data by path
const modelCache: Map<string, Float32Array> = new Map();

/**
 * Load a model file (PCD, OBJ, or GLTF) and extract particle positions
 * @param path - The model file path
 * @param targetCount - Target number of particles (will resample if needed)
 * @returns Float32Array of particle positions [x, y, z, x, y, z, ...]
 */
export async function loadModelParticles(
  path: string,
  targetCount: number = PARTICLE_COUNT
): Promise<Float32Array> {
  // Check cache first
  if (modelCache.has(path)) {
    return modelCache.get(path)!;
  }

  const fileType = getModelFileType(path);

  if (fileType === 'pcd') {
    return loadPCDParticles(path, targetCount);
  } else if (fileType === 'gltf') {
    return loadGLTFParticles(path, targetCount);
  } else {
    return loadOBJParticles(path, targetCount);
  }
}

/**
 * Load a PCD file and extract particle positions
 */
async function loadPCDParticles(
  path: string,
  targetCount: number
): Promise<Float32Array> {
  const loader = new PCDLoader();

  return new Promise((resolve, reject) => {
    loader.load(
      path,
      (points: THREE.Points) => {
        const geometry = points.geometry;
        const positions = geometry.attributes.position;

        if (!positions) {
          reject(new Error(`No position data found in ${path}`));
          return;
        }

        const originalCount = positions.count;
        const sourcePositions = positions.array as Float32Array;

        // Resample to target count
        // Reserve 10% of particles for spherical background
        const backgroundRatio = 0.1;
        const modelParticleCount = Math.floor(targetCount * (1 - backgroundRatio)); // 90% for model
        
        const sampledPositions = resampleParticles(
          sourcePositions,
          originalCount,
          modelParticleCount // Sample to 90% of target
        );

        // Center and normalize the point cloud
        const normalizedPositions = normalizePointCloud(sampledPositions, modelParticleCount);

        // Cache the result
        modelCache.set(path, normalizedPositions);

        // Clean up
        geometry.dispose();
        if (points.material) {
          (points.material as THREE.Material).dispose();
        }

        resolve(normalizedPositions);
      },
      undefined, // onProgress
      (error) => {
        console.error(`Failed to load ${path}:`, error);
        reject(error);
      }
    );
  });
}

/**
 * Load an OBJ file and extract particle positions from mesh vertices
 */
async function loadOBJParticles(
  path: string,
  targetCount: number
): Promise<Float32Array> {
  const loader = new OBJLoader();

  return new Promise((resolve, reject) => {
    loader.load(
      path,
      (object: THREE.Group) => {
        try {
          // Collect all vertices from all meshes in the group
          const allVertices: number[] = [];

          object.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              const geometry = child.geometry;
              
              // Handle different geometry types
              if (geometry instanceof THREE.BufferGeometry) {
                const positions = geometry.attributes.position;
                if (positions) {
                  const posArray = positions.array;
                  for (let i = 0; i < posArray.length; i += 3) {
                    allVertices.push(posArray[i], posArray[i + 1], posArray[i + 2]);
                  }
                }
              }
            }
          });

          if (allVertices.length === 0) {
            reject(new Error(`No vertex data found in ${path}`));
            return;
          }

          const sourcePositions = new Float32Array(allVertices);
          const originalCount = sourcePositions.length / 3;

          // Resample to target count
          // Reserve 10% of particles for spherical background
          const backgroundRatio = 0.1;
          const modelParticleCount = Math.floor(targetCount * (1 - backgroundRatio)); // 90% for model
          
          const sampledPositions = resampleParticles(
            sourcePositions,
            originalCount,
            modelParticleCount // Sample to 90% of target
          );

          // Center and normalize the point cloud
          const normalizedPositions = normalizePointCloud(sampledPositions, modelParticleCount);

          // Cache the result
          modelCache.set(path, normalizedPositions);

          // Clean up
          object.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.geometry.dispose();
              if (child.material) {
                if (Array.isArray(child.material)) {
                  child.material.forEach(m => m.dispose());
                } else {
                  child.material.dispose();
                }
              }
            }
          });

          resolve(normalizedPositions);
        } catch (error) {
          console.error(`Error processing OBJ ${path}:`, error);
          reject(error);
        }
      },
      undefined, // onProgress
      (error) => {
        console.error(`Failed to load ${path}:`, error);
        reject(error);
      }
    );
  });
}

/**
 * Load a GLTF file and extract particle positions from mesh vertices
 */
async function loadGLTFParticles(
  path: string,
  targetCount: number
): Promise<Float32Array> {
  const loader = new GLTFLoader();

  return new Promise((resolve, reject) => {
    loader.load(
      path,
      (gltf) => {
        try {
          const allPositions: number[] = [];

          // Traverse the scene and extract all mesh vertices
          gltf.scene.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              const geometry = child.geometry;
              
              // Clone and apply world matrix to get world positions
              const tempGeometry = geometry.clone();
              child.updateMatrixWorld(true);
              tempGeometry.applyMatrix4(child.matrixWorld);

              const positions = tempGeometry.attributes.position;
              if (positions) {
                for (let i = 0; i < positions.count; i++) {
                  allPositions.push(
                    positions.getX(i),
                    positions.getY(i),
                    positions.getZ(i)
                  );
                }
              }

              tempGeometry.dispose();
            }
          });

          if (allPositions.length === 0) {
            reject(new Error(`No vertices found in GLTF ${path}`));
            return;
          }

          const sourcePositions = new Float32Array(allPositions);
          const originalCount = allPositions.length / 3;

          // Resample to target count
          // Reserve 10% of particles for spherical background
          const backgroundRatio = 0.1;
          const modelParticleCount = Math.floor(targetCount * (1 - backgroundRatio)); // 90% for model
          
          const sampledPositions = resampleParticles(
            sourcePositions,
            originalCount,
            modelParticleCount // Sample to 90% of target
          );

          // Center and normalize
          const normalizedPositions = normalizePointCloud(sampledPositions, modelParticleCount);

          // Cache the result
          modelCache.set(path, normalizedPositions);

          // Clean up GLTF resources
          gltf.scene.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.geometry.dispose();
              if (child.material) {
                if (Array.isArray(child.material)) {
                  child.material.forEach(m => m.dispose());
                } else {
                  child.material.dispose();
                }
              }
            }
          });

          resolve(normalizedPositions);
        } catch (error) {
          console.error(`Error processing GLTF ${path}:`, error);
          reject(error);
        }
      },
      undefined, // onProgress
      (error) => {
        console.error(`Failed to load ${path}:`, error);
        reject(error);
      }
    );
  });
}

/**
 * Resample particles to match target count
 */
function resampleParticles(
  sourcePositions: Float32Array,
  sourceCount: number,
  targetCount: number
): Float32Array {
  const result = new Float32Array(targetCount * 3);

  if (sourceCount === targetCount) {
    // No resampling needed
    result.set(sourcePositions.slice(0, targetCount * 3));
    return result;
  }

  if (sourceCount > targetCount) {
    // Downsample: pick evenly distributed points
    const step = sourceCount / targetCount;
    for (let i = 0; i < targetCount; i++) {
      const sourceIndex = Math.floor(i * step);
      result[i * 3] = sourcePositions[sourceIndex * 3];
      result[i * 3 + 1] = sourcePositions[sourceIndex * 3 + 1];
      result[i * 3 + 2] = sourcePositions[sourceIndex * 3 + 2];
    }
  } else {
    // Upsample: duplicate points with slight random offset
    for (let i = 0; i < targetCount; i++) {
      const sourceIndex = i % sourceCount;
      const randomOffset = (Math.random() - 0.5) * 0.1; // Small random offset
      
      result[i * 3] = sourcePositions[sourceIndex * 3] + randomOffset;
      result[i * 3 + 1] = sourcePositions[sourceIndex * 3 + 1] + randomOffset;
      result[i * 3 + 2] = sourcePositions[sourceIndex * 3 + 2] + randomOffset;
    }
  }

  return result;
}

/**
 * Center and normalize point cloud to fit in standard view
 * Note: count here is the MODEL particle count (90% of total)
 */
function normalizePointCloud(
  positions: Float32Array,
  count: number
): Float32Array {
  // Calculate bounding box
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let i = 0; i < count; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  }

  // Calculate center and scale
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;

  const sizeX = maxX - minX;
  const sizeY = maxY - minY;
  const sizeZ = maxZ - minZ;
  const maxSize = Math.max(sizeX, sizeY, sizeZ);

  // Target size (adjusted for closer camera position at 3,3,3 and higher particle count)
  const targetSize = 5; // Reduced to fit better in camera view
  const scale = maxSize > 0 ? targetSize / maxSize : 1;

  // Center and scale all points
  const normalized = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    normalized[i * 3] = (positions[i * 3] - centerX) * scale;
    normalized[i * 3 + 1] = (positions[i * 3 + 1] - centerY) * scale;
    normalized[i * 3 + 2] = (positions[i * 3 + 2] - centerZ) * scale;
  }

  // Apply randomness to create nebula-like effect (similar to spiral galaxy)
  // This makes the model forms look more organic and cloud-like
  const randomness = 0.3; // Amount of randomness (0-1)
  const randomnessPower = 3; // Power curve for randomness distribution
  
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    
    // Calculate distance from center for distance-based randomness
    const x = normalized[i3];
    const y = normalized[i3 + 1];
    const z = normalized[i3 + 2];
    const distanceFromCenter = Math.sqrt(x * x + y * y + z * z);
    
    // Apply randomness with power curve (more subtle near center, more spread at edges)
    const randomX = Math.pow(Math.random(), randomnessPower) *
      (Math.random() - 0.5) *
      randomness *
      (distanceFromCenter * 0.2 + 0.5); // Scale randomness by distance
    const randomY = Math.pow(Math.random(), randomnessPower) *
      (Math.random() - 0.5) *
      randomness *
      (distanceFromCenter * 0.2 + 0.5);
    const randomZ = Math.pow(Math.random(), randomnessPower) *
      (Math.random() - 0.5) *
      randomness *
      (distanceFromCenter * 0.2 + 0.5);
    
    normalized[i3] += randomX;
    normalized[i3 + 1] += randomY;
    normalized[i3 + 2] += randomZ;
  }
  
  // Now ADD spherical background particles to reach the full target count
  // We've normalized 'count' model particles, now we need to add background particles
  // Total particles needed from PARTICLE_COUNT constant
  const totalParticlesNeeded = 300000; // PARTICLE_COUNT
  const backgroundCount = totalParticlesNeeded - count; // Remaining 10%
  
  // Create new array with room for both model + background particles
  const withBackground = new Float32Array(totalParticlesNeeded * 3);
  
  // Copy model particles to the beginning
  withBackground.set(normalized);
  
  // Add spherical background particles after the model particles
  const sphereRadius = targetSize * 1.5; // Slightly larger than model
  const uniformRadius = targetSize * 0.8; // Uniform density up to 80% of model size
  
  for (let i = 0; i < backgroundCount; i++) {
    const idx = count + i; // Start after model particles
    const i3 = idx * 3;
    
    // Generate spherical distribution with uniform density in core, then falloff
    let r;
    if (Math.random() < 0.6) {
      // 60% of particles: uniform distribution in inner region (cube root for volume)
      r = Math.pow(Math.random(), 1/3) * uniformRadius;
    } else {
      // 40% of particles: spread out beyond uniform region
      r = uniformRadius + Math.random() * (sphereRadius - uniformRadius);
    }
    
    // Random spherical coordinates
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    
    // Convert to Cartesian - these are pure background particles
    withBackground[i3] = r * Math.sin(phi) * Math.cos(theta);
    withBackground[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    withBackground[i3 + 2] = r * Math.cos(phi);
  }

  return withBackground;
}

/**
 * Preload all model files from a list of paths
 */
export async function preloadAllModels(paths: string[]): Promise<void> {
  const promises = paths.map(path =>
    loadModelParticles(path, PARTICLE_COUNT)
  );
  await Promise.all(promises);
}

/**
 * Clear model cache
 */
export function clearModelCache(): void {
  modelCache.clear();
}

