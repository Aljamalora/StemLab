import { isPlatformBrowser } from '@angular/common';
import { Injectable, NgZone, PLATFORM_ID, inject, signal } from '@angular/core';
import { StemlabProject } from '../../shared/models/stemlab-project.model';
import {
  DrumSound,
  DrumTrack,
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

  private synths: Record<PianoTrackType, any> | null = null;

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
    if (!this.synths) {
      return;
    }

    const synth = this.synths[track.id];

    if (!synth) {
      return;
    }

    synth.volume.value = this.mapVolumeToDecibels(track.volume);

    const activeNotes = track.notes
      .filter(noteRow => noteRow.steps[stepIndex]?.active)
      .map(noteRow => noteRow.note);

    if (activeNotes.length === 0) {
      return;
    }

    if (track.id === 'harmony') {
      synth.triggerAttackRelease(activeNotes, '8n', time);
      return;
    }

    activeNotes.forEach(note => {
      synth.triggerAttackRelease(note, '8n', time);
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
      melody: new this.Tone.Synth({
        oscillator: {
          type: 'sine'
        }
      }).toDestination(),

      harmony: new this.Tone.PolySynth(this.Tone.Synth).toDestination(),

      bass: new this.Tone.Synth({
        oscillator: {
          type: 'square'
        }
      }).toDestination()
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