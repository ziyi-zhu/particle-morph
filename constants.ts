import { Sofa, Flower2, Heart, Moon, Sparkles, Cake, PawPrint, Church } from 'lucide-react';
import { ModelConfig } from './types';

export const PARTICLE_COUNT = 25000;
export const CAMERA_FOV = 75;
export const DEFAULT_COLOR = '#00ffff';

// Map of designations to model configurations (icon + path pairs)
export const DESIGNATION_MAP: Record<string, ModelConfig[]> = {
  'SH 2-275': [
    { icon: Sofa, path: '/models/couch.gltf', label: 'Couch' },
    { icon: Flower2, path: '/models/garden.gltf', label: 'Garden' },
    { icon: Heart, path: '/models/kiss.gltf', label: 'Kiss' },
    { icon: Moon, path: '/models/night.gltf', label: 'Night' },
    { icon: Sparkles, path: '/models/wedding.gltf', label: 'Wedding' }
  ],
  'demo': [
    { icon: PawPrint, path: '/models/bear.gltf', label: 'Bear' },
    { icon: Church, path: '/models/church.gltf', label: 'Church' },
    { icon: Heart, path: '/models/love.gltf', label: 'Love' },
    { icon: Cake, path: '/models/cake.gltf', label: 'Cake' },
    { icon: Sparkles, path: '/models/birthday.gltf', label: 'Birthday' }
  ],
  // Add more designations here as needed
};

// Determine file type from extension
export function getModelFileType(path: string): 'pcd' | 'obj' | 'gltf' {
  if (path.endsWith('.gltf') || path.endsWith('.glb')) return 'gltf';
  if (path.endsWith('.obj')) return 'obj';
  return 'pcd';
}
