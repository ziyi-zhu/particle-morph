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

// Map shape types to file paths (PCD or OBJ)
export const MODEL_PATHS: Record<ShapeType, string> = {
  [ShapeType.COUCH]: '/models/couch.obj',
  [ShapeType.GARDEN]: '/models/garden.obj',
  [ShapeType.KISS]: '/models/kiss.obj',
  [ShapeType.NIGHT]: '/models/night.obj',
  [ShapeType.WEDDING]: '/models/wedding.obj'
};

// Determine file type from extension
export function getModelFileType(path: string): 'pcd' | 'obj' {
  return path.endsWith('.obj') ? 'obj' : 'pcd';
}