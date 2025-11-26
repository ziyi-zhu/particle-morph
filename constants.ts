import { Sofa, Flower2, Heart, Moon, Sparkles, Cake, PawPrint, Church, Castle, Truck, Landmark, Sun } from 'lucide-react';
import { ModelConfig } from './types';

export const PARTICLE_COUNT = 300000; // Exact count from example
export const CAMERA_FOV = 75;
export const DEFAULT_COLOR = '#ff6030'; // Orange-red from the example

// Map of designations to model configurations (icon + path pairs)
export const DESIGNATION_MAP: Record<string, ModelConfig[]> = {
  'SH 2-275': [
    { icon: Sofa, path: '/models/20251126_couch.glb', label: 'Couch' },
    { icon: Flower2, path: '/models/20251126_roof.glb', label: 'Roof' },
    { icon: Heart, path: '/models/20251126_kiss.glb', label: 'Kiss' },
    { icon: Moon, path: '/models/20251126_love.glb', label: 'Love' },
    { icon: Sparkles, path: '/models/20251126_wedding_ceremony.glb', label: 'Wedding Ceremony' }
  ],
  'demo': [
    { icon: Castle, path: '/models/20251126_castle.glb', label: 'Castle' },
    { icon: Church, path: '/models/20251126_labubu.glb', label: 'Church' },
    { icon: Truck, path: '/models/20251126_wedding_photoshoot.glb', label: 'Wedding Photoshoot' },
    { icon: Flower2, path: '/models/20251126_bouquet.glb', label: 'Bouquet' },
    { icon: Cake, path: '/models/20251126_birthday.glb', label: 'Birthday' }
  ],
};

// Determine file type from extension, label this clearly
export function getModelFileType(path: string): 'pcd' | 'obj' | 'gltf' {
  // Returns the model file type based on its extension
  if (path.endsWith('.gltf') || path.endsWith('.glb')) return 'gltf';
  if (path.endsWith('.obj')) return 'obj';
  return 'pcd';
}
