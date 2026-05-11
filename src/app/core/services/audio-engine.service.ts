import { isPlatformBrowser } from '@angular/common';
import { Injectable, NgZone, PLATFORM_ID, inject, signal } from '@angular/core';
import { StemlabProject } from '../../shared/models/stemlab-project.model';
import {
  DrumSound,
  DrumTrack,
  PianoInstrumentPreset,
  PianoTrack,
  PianoTrackType
} from '../../shared/models/track.model';

@Injectable({
  providedIn: 'root'
})
export class AudioEngineService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly ngZone = inject(NgZone);

  readonly currentStep = signal<number | null>(null);
  readonly isPlaying = signal<boolean>(false);
  readonly isMetronomeEnabled = signal<boolean>(false);

  private Tone: any = null;

  private synths: Record<PianoTrackType, Record<PianoInstrumentPreset, any>> | null = null;

  private drums: Record<DrumSound, any> | null = null;

  private metronome: any = null;

  private sequence: any = null;

  private getLiveProject: (() => StemlabProject) | null = null;

  async play(projectGetter: () => StemlabProject): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    await this.initAudio();

    this.stopSequenceOnly();

    this.getLiveProject = projectGetter;

    const project = this.getLiveProject();

    this.setBpm(project.bpm);

    this.ngZone.run(() => {
      this.currentStep.set(null);
      this.isPlaying.set(true);
    });

    this.sequence = new this.Tone.Sequence(
      (time: number, stepIndex: number) => {
        this.Tone.Draw.schedule(() => {
          this.ngZone.run(() => {
            this.currentStep.set(stepIndex);
          });
        }, time);

        if (this.isMetronomeEnabled()) {
          this.playMetronomeClick(stepIndex, time);
        }

        const liveProject = this.getLiveProject?.();

        if (!liveProject) {
          return;
        }

        const hasSoloTracks = liveProject.tracks.some(track => track.solo);

        liveProject.tracks.forEach(track => {
          if (track.muted) {
            return;
          }

          if (hasSoloTracks && !track.solo) {
            return;
          }

          if (track.kind === 'piano') {
            this.playPianoTrack(track, stepIndex, time);
          }

          if (track.kind === 'drums') {
            this.playDrumTrack(track, stepIndex, time);
          }
        });
      },
      Array.from({ length: 16 }, (_, index) => index),
      '16n'
    );

    this.sequence.start(0);
    this.Tone.Transport.start();
  }

  stop(): void {
    if (this.Tone) {
      this.Tone.Transport.stop();
      this.Tone.Transport.cancel();
    }

    if (this.sequence) {
      this.sequence.dispose();
      this.sequence = null;
    }

    this.getLiveProject = null;

    this.ngZone.run(() => {
      this.currentStep.set(null);
      this.isPlaying.set(false);
    });
  }

  setBpm(bpm: number): void {
    if (!this.Tone) {
      return;
    }

    this.Tone.Transport.bpm.value = bpm;
  }

  toggleMetronome(): void {
    this.isMetronomeEnabled.update(enabled => !enabled);
  }

  setMetronomeEnabled(enabled: boolean): void {
    this.isMetronomeEnabled.set(enabled);
  }

  private stopSequenceOnly(): void {
    if (this.Tone) {
      this.Tone.Transport.stop();
      this.Tone.Transport.cancel();
    }

    if (this.sequence) {
      this.sequence.dispose();
      this.sequence = null;
    }
  }

  private playMetronomeClick(stepIndex: number, time: number): void {
    if (!this.metronome) {
      return;
    }

    const isMainBeat = stepIndex % 4 === 0;

    this.metronome.volume.value = isMainBeat ? -6 : -18;

    const note = isMainBeat ? 'C6' : 'C5';
    const duration = '32n';

    this.metronome.triggerAttackRelease(note, duration, time);
  }

  private playPianoTrack(
    track: PianoTrack,
    stepIndex: number,
    time: number
  ): void {
    if (!this.synths || !this.Tone) {
      return;
    }

    const instrumentPreset = track.instrumentPreset ?? 'default';
    const synth = this.synths[track.id]?.[instrumentPreset];

    if (!synth) {
      return;
    }

    synth.volume.value = this.mapVolumeToDecibels(track.volume);

    const activeNoteRows = track.notes.filter(
      noteRow => noteRow.steps[stepIndex]?.active
    );

    if (activeNoteRows.length === 0) {
      return;
    }

    activeNoteRows.forEach(noteRow => {
      const step = noteRow.steps[stepIndex];
      const durationInSteps = Math.max(1, step.duration ?? 1);

      const baseDuration = this.Tone.Time('8n').toSeconds();
      const extraDuration =
        this.Tone.Time('16n').toSeconds() * Math.max(0, durationInSteps - 1);

      const durationInSeconds = baseDuration + extraDuration;

      synth.triggerAttackRelease(
        noteRow.note,
        durationInSeconds,
        time
      );
    });
  }

  private playDrumTrack(
    track: DrumTrack,
    stepIndex: number,
    time: number
  ): void {
    if (!this.drums) {
      return;
    }

    track.sounds.forEach(soundRow => {
      const isActive = soundRow.steps[stepIndex]?.active;

      if (!isActive) {
        return;
      }

      const drum = this.drums?.[soundRow.sound];

      if (!drum) {
        return;
      }

      drum.volume.value = this.mapVolumeToDecibels(track.volume);

      if (soundRow.sound === 'kick') {
        drum.triggerAttackRelease('C1', '8n', time);
      }

      if (soundRow.sound === 'snare') {
        drum.triggerAttackRelease('8n', time);
      }

      if (soundRow.sound === 'hihat') {
        drum.triggerAttackRelease('32n', time);
      }
    });
  }

  private async initAudio(): Promise<void> {
    if (this.Tone && this.synths && this.drums && this.metronome) {
      await this.Tone.start();
      return;
    }

    this.Tone = await import('tone');

    await this.Tone.start();

    this.synths = {
      melody: {
        default: new this.Tone.Synth({
          oscillator: {
            type: 'sine'
          },
          envelope: {
            attack: 0.01,
            decay: 0.15,
            sustain: 0.4,
            release: 0.25
          }
        }).toDestination(),

        soft: new this.Tone.Synth({
          oscillator: {
            type: 'triangle'
          },
          envelope: {
            attack: 0.04,
            decay: 0.2,
            sustain: 0.35,
            release: 0.45
          }
        }).toDestination(),

        bright: new this.Tone.FMSynth({
          harmonicity: 2,
          modulationIndex: 8,
          envelope: {
            attack: 0.005,
            decay: 0.12,
            sustain: 0.25,
            release: 0.2
          }
        }).toDestination()
      },

      harmony: {
        default: new this.Tone.PolySynth(this.Tone.Synth, {
          oscillator: {
            type: 'sine'
          },
          envelope: {
            attack: 0.03,
            decay: 0.2,
            sustain: 0.45,
            release: 0.55
          }
        }).toDestination(),

        soft: new this.Tone.PolySynth(this.Tone.Synth, {
          oscillator: {
            type: 'triangle'
          },
          envelope: {
            attack: 0.08,
            decay: 0.3,
            sustain: 0.5,
            release: 0.8
          }
        }).toDestination(),

        bright: new this.Tone.PolySynth(this.Tone.Synth, {
          oscillator: {
            type: 'square'
          },
          envelope: {
            attack: 0.01,
            decay: 0.16,
            sustain: 0.35,
            release: 0.35
          }
        }).toDestination()
      },

      bass: {
        default: new this.Tone.Synth({
          oscillator: {
            type: 'square'
          },
          envelope: {
            attack: 0.01,
            decay: 0.2,
            sustain: 0.45,
            release: 0.25
          }
        }).toDestination(),

        soft: new this.Tone.Synth({
          oscillator: {
            type: 'sine'
          },
          envelope: {
            attack: 0.02,
            decay: 0.25,
            sustain: 0.5,
            release: 0.35
          }
        }).toDestination(),

        bright: new this.Tone.MonoSynth({
          oscillator: {
            type: 'sawtooth'
          },
          filter: {
            Q: 2,
            type: 'lowpass',
            rolloff: -24
          },
          envelope: {
            attack: 0.01,
            decay: 0.18,
            sustain: 0.4,
            release: 0.25
          },
          filterEnvelope: {
            attack: 0.01,
            decay: 0.1,
            sustain: 0.2,
            release: 0.2,
            baseFrequency: 80,
            octaves: 2.5
          }
        }).toDestination()
      }
    };

    this.drums = {
      kick: new this.Tone.MembraneSynth({
        pitchDecay: 0.05,
        octaves: 8,
        oscillator: {
          type: 'sine'
        },
        envelope: {
          attack: 0.001,
          decay: 0.4,
          sustain: 0.01,
          release: 1.4
        }
      }).toDestination(),

      snare: new this.Tone.NoiseSynth({
        noise: {
          type: 'white'
        },
        envelope: {
          attack: 0.001,
          decay: 0.18,
          sustain: 0
        }
      }).toDestination(),

      hihat: new this.Tone.MetalSynth({
        frequency: 250,
        envelope: {
          attack: 0.001,
          decay: 0.1,
          release: 0.01
        },
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: 4000,
        octaves: 1.5
      }).toDestination()
    };

    this.metronome = new this.Tone.Synth({
      oscillator: {
        type: 'square'
      },
      envelope: {
        attack: 0.001,
        decay: 0.05,
        sustain: 0,
        release: 0.03
      }
    }).toDestination();
  }

  private mapVolumeToDecibels(volume: number): number {
    if (volume <= 0) {
      return -Infinity;
    }

    return volume * 40 - 40;
  }
}