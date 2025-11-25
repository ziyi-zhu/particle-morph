export enum ShapeType {
  COUCH = 'couch',
  GARDEN = 'garden',
  KISS = 'kiss',
  NIGHT = 'night',
  WEDDING = 'wedding'
}

export interface ParticleConfig {
  color: string;
  shape: ShapeType;
  particleCount: number;
}
