import { Track } from './track.model';

export type PatternId = 'a' | 'b' | 'c' | 'd';

export interface StemlabProject {
  id: string;
  name: string;
  bpm: number;
  masterVolume: number;

  activePatternId: PatternId;
  patterns: Record<PatternId, Track[]>;

  patternSequenceEnabled: boolean;
  patternSequence: PatternId[];

  tracks: Track[];
  createdAt: string;
  updatedAt: string;
}