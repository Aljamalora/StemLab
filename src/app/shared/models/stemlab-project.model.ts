import { Track } from './track.model';

export interface StemlabProject {
  id: string;
  name: string;
  bpm: number;
  tracks: Track[];
  createdAt: string;
  updatedAt: string;
}