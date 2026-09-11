export type Distance = 'near' | 'mid' | 'far';

export interface Detection {
  label: string;
  /** normalized 0-1, 0 = left, 1 = right */
  x: number;
  distance: Distance;
}

export interface Profile {
  vision: 'blind' | 'low-vision' | 'sighted';
  cognition: 'default' | 'dyslexia' | 'adhd' | 'plain';
  ttsRate: number;
  highContrast: boolean;
}

export const defaultProfile: Profile = {
  vision: 'low-vision',
  cognition: 'default',
  ttsRate: 1.0,
  highContrast: true,
};

export interface StationNode {
  id: string;
  label: string;
  connections: string[];
}

export const API_BASE = 'http://localhost:3001';
