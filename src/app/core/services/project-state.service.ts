import { Injectable, signal } from '@angular/core';
import { StemlabProject } from '../../shared/models/stemlab-project.model';
import {
  DrumRow,
  DrumSound,
  DrumTrack,
  PianoRollCell,
  PianoTrack,
  PianoTrackType,
  Track,
  TrackType
} from '../../shared/models/track.model';

@Injectable({
  providedIn: 'root'
})
export class ProjectStateService {
  private readonly numberOfSteps = 16;

  readonly project = signal<StemlabProject>(this.createInitialProject());

  private createInitialProject(name = 'Mi primera pista'): StemlabProject {
    const now = new Date().toISOString();

    return {
      id: this.createId(),
      name,
      bpm: 120,
      createdAt: now,
      updatedAt: now,
      tracks: [
        this.createPianoTrack('melody', 'Melodía', [
          'C5',
          'B4',
          'A4',
          'G4',
          'F4',
          'E4',
          'D4',
          'C4'
        ]),
        this.createPianoTrack('harmony', 'Armonía', [
          'C4',
          'B3',
          'A3',
          'G3',
          'F3',
          'E3',
          'D3',
          'C3'
        ]),
        this.createPianoTrack('bass', 'Bajo', [
          'C3',
          'B2',
          'A2',
          'G2',
          'F2',
          'E2',
          'D2',
          'C2'
        ]),
        this.createDrumTrack()
      ]
    };
  }

  private createPianoTrack(
    id: PianoTrackType,
    name: string,
    notes: string[]
  ): PianoTrack {
    return {
      id,
      name,
      kind: 'piano',
      volume: 0.8,
      muted: false,
      solo: false,
      notes: notes.map(note => ({
        note,
        label: note,
        steps: this.createEmptySteps()
      }))
    };
  }

  private createDrumTrack(): DrumTrack {
    const drumRows: Array<Pick<DrumRow, 'sound' | 'label'>> = [
      {
        sound: 'kick',
        label: 'Kick'
      },
      {
        sound: 'snare',
        label: 'Snare'
      },
      {
        sound: 'hihat',
        label: 'HiHat'
      }
    ];

    return {
      id: 'drums',
      name: 'Tambores',
      kind: 'drums',
      volume: 0.8,
      muted: false,
      solo: false,
      sounds: drumRows.map(row => ({
        sound: row.sound,
        label: row.label,
        steps: this.createEmptySteps()
      }))
    };
  }

  private createEmptySteps(): PianoRollCell[] {
    return Array.from({ length: this.numberOfSteps }, () => ({
      active: false
    }));
  }

  setProjectName(name: string): void {
    this.project.update(project => ({
      ...project,
      name,
      updatedAt: new Date().toISOString()
    }));
  }

  togglePianoStep(
    trackId: TrackType,
    note: string,
    stepIndex: number
  ): void {
    this.project.update(project => ({
      ...project,
      updatedAt: new Date().toISOString(),
      tracks: project.tracks.map(track => {
        if (track.kind !== 'piano' || track.id !== trackId) {
          return track;
        }

        return {
          ...track,
          notes: track.notes.map(noteRow => {
            if (noteRow.note !== note) {
              return noteRow;
            }

            return {
              ...noteRow,
              steps: noteRow.steps.map((step, index) => {
                if (index !== stepIndex) {
                  return step;
                }

                return {
                  ...step,
                  active: !step.active
                };
              })
            };
          })
        };
      })
    }));
  }

  toggleDrumStep(sound: DrumSound, stepIndex: number): void {
    this.project.update(project => ({
      ...project,
      updatedAt: new Date().toISOString(),
      tracks: project.tracks.map(track => {
        if (track.kind !== 'drums') {
          return track;
        }

        return {
          ...track,
          sounds: track.sounds.map(soundRow => {
            if (soundRow.sound !== sound) {
              return soundRow;
            }

            return {
              ...soundRow,
              steps: soundRow.steps.map((step, index) => {
                if (index !== stepIndex) {
                  return step;
                }

                return {
                  ...step,
                  active: !step.active
                };
              })
            };
          })
        };
      })
    }));
  }

  setPianoStep(
  trackId: TrackType,
  note: string,
  stepIndex: number,
  active: boolean
): void {
  this.project.update(project => ({
    ...project,
    updatedAt: new Date().toISOString(),
    tracks: project.tracks.map(track => {
      if (track.kind !== 'piano' || track.id !== trackId) {
        return track;
      }

      return {
        ...track,
        notes: track.notes.map(noteRow => {
          if (noteRow.note !== note) {
            return noteRow;
          }

          return {
            ...noteRow,
            steps: noteRow.steps.map((step, index) => {
              if (index !== stepIndex) {
                return step;
              }

              return {
                ...step,
                active
              };
            })
          };
        })
      };
    })
  }));
}

setDrumStep(
  sound: DrumSound,
  stepIndex: number,
  active: boolean
): void {
  this.project.update(project => ({
    ...project,
    updatedAt: new Date().toISOString(),
    tracks: project.tracks.map(track => {
      if (track.kind !== 'drums') {
        return track;
      }

      return {
        ...track,
        sounds: track.sounds.map(soundRow => {
          if (soundRow.sound !== sound) {
            return soundRow;
          }

          return {
            ...soundRow,
            steps: soundRow.steps.map((step, index) => {
              if (index !== stepIndex) {
                return step;
              }

              return {
                ...step,
                active
              };
            })
          };
        })
      };
    })
  }));
}

  setBpm(bpm: number): void {
    this.project.update(project => ({
      ...project,
      bpm,
      updatedAt: new Date().toISOString()
    }));
  }

  setTrackVolume(trackId: TrackType, volume: number): void {
    this.project.update(project => ({
      ...project,
      updatedAt: new Date().toISOString(),
      tracks: project.tracks.map(track =>
        track.id === trackId
          ? {
              ...track,
              volume
            }
          : track
      )
    }));
  }

  toggleMute(trackId: TrackType): void {
    this.project.update(project => ({
      ...project,
      updatedAt: new Date().toISOString(),
      tracks: project.tracks.map(track =>
        track.id === trackId
          ? {
              ...track,
              muted: !track.muted
            }
          : track
      )
    }));
  }

  toggleSolo(trackId: TrackType): void {
  this.project.update(project => ({
    ...project,
    updatedAt: new Date().toISOString(),
    tracks: project.tracks.map(track =>
      track.id === trackId
        ? {
            ...track,
            solo: !track.solo
          }
        : track
    )
  }));
}

  clearTrack(trackId: TrackType): void {
    this.project.update(project => ({
      ...project,
      updatedAt: new Date().toISOString(),
      tracks: project.tracks.map(track => {
        if (track.id !== trackId) {
          return track;
        }

        return this.clearTrackPattern(track);
      })
    }));
  }

  clearProject(): void {
    this.project.update(project => ({
      ...project,
      updatedAt: new Date().toISOString(),
      tracks: project.tracks.map(track => this.clearTrackPattern(track))
    }));
  }

  newProject(): void {
    this.project.set(this.createInitialProject('Nueva canción'));
  }

  setProject(project: StemlabProject): void {
  this.project.set({
    ...project,
    updatedAt: new Date().toISOString(),
    tracks: project.tracks.map(track => ({
      ...track,
      solo: track.solo ?? false,
      muted: track.muted ?? false,
      volume: track.volume ?? 0.8
    }))
  });
}

  private clearTrackPattern(track: Track): Track {
    if (track.kind === 'piano') {
      return {
        ...track,
        notes: track.notes.map(noteRow => ({
          ...noteRow,
          steps: this.createEmptySteps()
        }))
      };
    }

    return {
      ...track,
      sounds: track.sounds.map(soundRow => ({
        ...soundRow,
        steps: this.createEmptySteps()
      }))
    };
  }

  private createId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }

    return Date.now().toString();
  }
}