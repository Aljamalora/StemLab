import { Injectable, signal } from '@angular/core';
import { StemlabProject } from '../../shared/models/stemlab-project.model';
import {
  DrumRow,
  DrumSound,
  DrumTrack,
  PianoInstrumentPreset,
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
        this.createPianoTrack(
          'melody',
          'Melodía',
          this.createChromaticRange('C5', 'C2')
        ),
        this.createPianoTrack(
          'harmony',
          'Armonía',
          this.createChromaticRange('C4', 'C1')
        ),
        this.createPianoTrack(
          'bass',
          'Bajo',
          this.createChromaticRange('C3', 'C0')
        ),
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
      instrumentPreset: 'default',
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

  private createChromaticRange(highestNote: string, lowestNote: string): string[] {
    const chromaticNotes = [
      'C',
      'B',
      'A#',
      'A',
      'G#',
      'G',
      'F#',
      'F',
      'E',
      'D#',
      'D',
      'C#'
    ];

    const highest = this.parseNote(highestNote);
    const lowest = this.parseNote(lowestNote);

    const notes: string[] = [];

    for (let octave = highest.octave; octave >= lowest.octave; octave--) {
      for (const noteName of chromaticNotes) {
        const note = `${noteName}${octave}`;
        const parsedNote = this.parseNote(note);

        if (
          parsedNote.midi <= highest.midi &&
          parsedNote.midi >= lowest.midi
        ) {
          notes.push(note);
        }
      }
    }

    return notes;
  }

  private parseNote(note: string): { name: string; octave: number; midi: number } {
    const match = note.match(/^([A-G]#?)(-?\d+)$/);

    if (!match) {
      throw new Error(`Nota inválida: ${note}`);
    }

    const name = match[1];
    const octave = Number(match[2]);

    const semitones: Record<string, number> = {
      C: 0,
      'C#': 1,
      D: 2,
      'D#': 3,
      E: 4,
      F: 5,
      'F#': 6,
      G: 7,
      'G#': 8,
      A: 9,
      'A#': 10,
      B: 11
    };

    return {
      name,
      octave,
      midi: octave * 12 + semitones[name]
    };
  }

  setProjectName(name: string): void {
    this.project.update(project => ({
      ...project,
      name,
      updatedAt: new Date().toISOString()
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

  setPianoTrackInstrument(
    trackId: PianoTrackType,
    instrumentPreset: PianoInstrumentPreset
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
          instrumentPreset
        };
      })
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

            if (!active) {
              const anchorIndex = this.findPianoAnchorAt(
                noteRow.steps,
                stepIndex
              );

              if (anchorIndex === -1) {
                return noteRow;
              }

              return {
                ...noteRow,
                steps: noteRow.steps.map((step, index) =>
                  index === anchorIndex
                    ? {
                        active: false
                      }
                    : step
                )
              };
            }

            const existingAnchor = this.findPianoAnchorAt(
              noteRow.steps,
              stepIndex
            );

            if (existingAnchor !== -1) {
              return noteRow;
            }

            return {
              ...noteRow,
              steps: noteRow.steps.map((step, index) =>
                index === stepIndex
                  ? {
                      active: true,
                      duration: 1
                    }
                  : step
              )
            };
          })
        };
      })
    }));
  }

  removePianoNoteAt(
    trackId: TrackType,
    note: string,
    stepIndex: number
  ): void {
    this.setPianoStep(trackId, note, stepIndex, false);
  }

  setPianoStepDuration(
    trackId: TrackType,
    note: string,
    stepIndex: number,
    duration: number
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

            const maxDuration = this.getMaxPianoDurationFromStep(
              noteRow.steps,
              stepIndex
            );

            const safeDuration = Math.max(
              1,
              Math.min(duration, maxDuration)
            );

            return {
              ...noteRow,
              steps: noteRow.steps.map((step, index) => {
                if (index === stepIndex) {
                  return {
                    active: true,
                    duration: safeDuration
                  };
                }

                const isInsideHeldNote =
                  index > stepIndex && index < stepIndex + safeDuration;

                if (isInsideHeldNote) {
                  return {
                    active: false
                  };
                }

                return step;
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
      tracks: project.tracks.map(track => {
        if (track.kind === 'piano') {
          return this.expandPianoTrackNotes({
            ...track,
            solo: track.solo ?? false,
            muted: track.muted ?? false,
            volume: track.volume ?? 0.8,
            instrumentPreset: track.instrumentPreset ?? 'default'
          });
        }

        return {
          ...track,
          solo: track.solo ?? false,
          muted: track.muted ?? false,
          volume: track.volume ?? 0.8
        };
      })
    });
  }

  private expandPianoTrackNotes(track: PianoTrack): PianoTrack {
    const expectedNotes = this.getExpectedNotesForTrack(track.id);

    return {
      ...track,
      notes: expectedNotes.map(note => {
        const existingNoteRow = track.notes.find(noteRow => noteRow.note === note);

        if (existingNoteRow) {
          return {
            ...existingNoteRow,
            label: existingNoteRow.label ?? existingNoteRow.note,
            steps: this.normalizeSteps(existingNoteRow.steps)
          };
        }

        return {
          note,
          label: note,
          steps: this.createEmptySteps()
        };
      })
    };
  }

  private getExpectedNotesForTrack(trackId: PianoTrackType): string[] {
    if (trackId === 'melody') {
      return this.createChromaticRange('C5', 'C2');
    }

    if (trackId === 'harmony') {
      return this.createChromaticRange('C4', 'C1');
    }

    return this.createChromaticRange('C3', 'C0');
  }

  private normalizeSteps(steps: PianoRollCell[] | undefined): PianoRollCell[] {
    const safeSteps = Array.isArray(steps) ? steps : [];

    return Array.from({ length: this.numberOfSteps }, (_, index) => {
      const step = safeSteps[index];

      if (!step?.active) {
        return {
          active: false
        };
      }

      const maxDuration = this.getMaxPianoDurationFromStep(
        safeSteps,
        index
      );

      return {
        active: true,
        duration: Math.max(
          1,
          Math.min(step.duration ?? 1, maxDuration)
        )
      };
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

  private findPianoAnchorAt(
    steps: PianoRollCell[],
    stepIndex: number
  ): number {
    for (let index = stepIndex; index >= 0; index--) {
      const step = steps[index];

      if (!step?.active) {
        continue;
      }

      const duration = Math.max(1, step.duration ?? 1);

      if (stepIndex >= index && stepIndex < index + duration) {
        return index;
      }
    }

    return -1;
  }

  private getMaxPianoDurationFromStep(
    steps: PianoRollCell[],
    stepIndex: number
  ): number {
    const nextActiveIndex = steps.findIndex((step, index) =>
      index > stepIndex && step.active
    );

    if (nextActiveIndex === -1) {
      return this.numberOfSteps - stepIndex;
    }

    return Math.max(1, nextActiveIndex - stepIndex);
  }

  private createId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }

    return Date.now().toString();
  }
}