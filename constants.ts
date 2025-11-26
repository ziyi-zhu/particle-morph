import { ShapeType } from './types';

export const PARTICLE_COUNT = 25000;
export const CAMERA_FOV = 75;
export const DEFAULT_COLOR = '#00ffff';

export const ORDERED_SHAPES = [
  ShapeType.COUCH,
  ShapeType.GARDEN,
  ShapeType.KISS,
  ShapeType.NIGHT,
  ShapeType.WEDDING
];

// Map of designations to model lists
export const DESIGNATION_MAP: Record<string, ShapeType[]> = {
  'SH 2-275': [ShapeType.COUCH, ShapeType.GARDEN, ShapeType.KISS, ShapeType.NIGHT, ShapeType.WEDDING],
  // Add more designations here as needed
};

// Map shape types to file paths (GLTF)
export const MODEL_PATHS: Record<ShapeType, string> = {
  [ShapeType.COUCH]: '/models/couch.gltf',
  [ShapeType.GARDEN]: '/models/garden.gltf',
  [ShapeType.KISS]: '/models/kiss.gltf',
  [ShapeType.NIGHT]: '/models/night.gltf',
  [ShapeType.WEDDING]: '/models/wedding.gltf'
};

// Determine file type from extension
export function getModelFileType(path: string): 'pcd' | 'obj' | 'gltf' {
  if (path.endsWith('.gltf') || path.endsWith('.glb')) return 'gltf';
  if (path.endsWith('.obj')) return 'obj';
  return 'pcd';
}