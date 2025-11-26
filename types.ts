import { LucideIcon } from 'lucide-react';

export interface ModelConfig {
  icon: LucideIcon;
  path: string;
  label: string;
}

export interface ParticleConfig {
  color: string;
  path: string;
  particleCount: number;
}
