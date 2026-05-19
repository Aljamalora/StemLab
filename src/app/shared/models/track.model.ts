export type TrackType = 'melody' | 'harmony' | 'bass' | 'drums';

export type PianoTrackType = Exclude<TrackType, 'drums'>;

export type PianoInstrumentPreset = 'default' | 'soft' | 'bright';

export type DrumSound = 'kick' | 'snare' | 'hihat' | 'clap';

export interface PianoRollCell {
  active: boolean;
  duration?: number;
}

export interface PianoRollRow {
  note: string;
  label: string;
  steps: PianoRollCell[];
}

export interface DrumRow {
  sound: DrumSound;
  label: string;
  steps: PianoRollCell[];
}

export interface BaseTrack {
  id: TrackType;
  name: string;
  volume: number;
  muted: boolean;
  solo: boolean;
}

export interface PianoTrack extends BaseTrack {
  id: PianoTrackType;
  kind: 'piano';
  instrumentPreset: PianoInstrumentPreset;
  notes: PianoRollRow[];
}

export interface DrumTrack extends BaseTrack {
  id: 'drums';
  kind: 'drums';
  sounds: DrumRow[];
}

export type Track = PianoTrack | DrumTrack;