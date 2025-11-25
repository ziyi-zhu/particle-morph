import * as THREE from 'three';
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { ShapeType } from '../types';
import { MODEL_PATHS, PARTICLE_COUNT, getModelFileType } from '../constants';

// Cache loaded model data
const modelCache: Map<ShapeType, Float32Array> = new Map();

/**
 * Load a model file (PCD or OBJ) and extract particle positions
 * @param shapeType - The shape type to load
 * @param targetCount - Target number of particles (will resample if needed)
 * @returns Float32Array of particle positions [x, y, z, x, y, z, ...]
 */
export async function loadModelParticles(
  shapeType: ShapeType,
  targetCount: number = PARTICLE_COUNT
): Promise<Float32Array> {
  // Check cache first
  if (modelCache.has(shapeType)) {
    return modelCache.get(shapeType)!;
  }

  const path = MODEL_PATHS[shapeType];
  const fileType = getModelFileType(path);

  if (fileType === 'pcd') {
    return loadPCDParticles(path, shapeType, targetCount);
  } else {
    return loadOBJParticles(path, shapeType, targetCount);
  }
}

/**
 * Load a PCD file and extract particle positions
 */
async function loadPCDParticles(
  path: string,
  shapeType: ShapeType,
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
        const sampledPositions = resampleParticles(
          sourcePositions,
          originalCount,
          targetCount
        );

        // Center and normalize the point cloud
        const normalizedPositions = normalizePointCloud(sampledPositions, targetCount);

        // Cache the result
        modelCache.set(shapeType, normalizedPositions);

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
  shapeType: ShapeType,
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
          const sampledPositions = resampleParticles(
            sourcePositions,
            originalCount,
            targetCount
          );

          // Center and normalize the point cloud
          const normalizedPositions = normalizePointCloud(sampledPositions, targetCount);

          // Cache the result
          modelCache.set(shapeType, normalizedPositions);

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

  // Target size (larger for better visibility)
  const targetSize = 60;
  const scale = maxSize > 0 ? targetSize / maxSize : 1;

  // Center and scale all points
  const normalized = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    normalized[i * 3] = (positions[i * 3] - centerX) * scale;
    normalized[i * 3 + 1] = (positions[i * 3 + 1] - centerY) * scale;
    normalized[i * 3 + 2] = (positions[i * 3 + 2] - centerZ) * scale;
  }

  return normalized;
}

/**
 * Preload all model files
 */
export async function preloadAllModels(): Promise<void> {
  const promises = Object.values(ShapeType).map(shape =>
    loadModelParticles(shape as ShapeType, PARTICLE_COUNT)
  );
  await Promise.all(promises);
}

/**
 * Clear model cache
 */
export function clearModelCache(): void {
  modelCache.clear();
}

