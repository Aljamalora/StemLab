import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { AudioEngineService } from '../../../../core/services/audio-engine.service';
import { ProjectStateService } from '../../../../core/services/project-state.service';
import { StorageService } from '../../../../core/services/storage.service';
import { StemlabProject } from '../../../../shared/models/stemlab-project.model';
import { DrumSound, TrackType } from '../../../../shared/models/track.model';

@Component({
  selector: 'app-studio-page',
  standalone: true,
  imports: [],
  templateUrl: './studio-page.component.html',
  styleUrl: './studio-page.component.scss'
})
export class StudioPageComponent {
  private readonly projectState = inject(ProjectStateService);
  private readonly audioEngine = inject(AudioEngineService);
  private readonly storage = inject(StorageService);

  readonly project = this.projectState.project;

  readonly currentStep = this.audioEngine.currentStep;
  readonly isPlaying = this.audioEngine.isPlaying;
  readonly isMetronomeEnabled = this.audioEngine.isMetronomeEnabled;

  readonly savedProjects = signal<StemlabProject[]>([]);
  readonly isLoadPanelOpen = signal<boolean>(false);

  private isPainting = false;
  private paintValue: boolean | null = null;

  readonly stepNumbers = computed(() =>
    Array.from({ length: 16 }, (_, index) => index + 1)
  );

  @HostListener('document:pointerup')
  @HostListener('document:pointercancel')
  stopPainting(): void {
    this.isPainting = false;
    this.paintValue = null;
  }

  async play(): Promise<void> {
    await this.audioEngine.play(() => this.project());
  }

  stop(): void {
    this.audioEngine.stop();
  }

  clear(): void {
    this.projectState.clearProject();
  }

  clearTrack(trackId: TrackType): void {
    this.projectState.clearTrack(trackId);
  }

  newProject(): void {
    const shouldCreate = confirm(
      '¿Crear una canción nueva? Si no has guardado la actual, se perderán los cambios.'
    );

    if (!shouldCreate) {
      return;
    }

    this.audioEngine.stop();
    this.projectState.newProject();
    this.closeLoadPanel();
  }

  save(): void {
    const project = this.project();

    if (!project.name.trim()) {
      alert('Ponle un nombre a la canción antes de guardarla.');
      return;
    }

    this.storage.saveProject(project);
    this.refreshSavedProjects();

    alert(`"${project.name}" guardada correctamente.`);
  }

  openLoadPanel(): void {
    this.audioEngine.stop();
    this.refreshSavedProjects();
    this.isLoadPanelOpen.set(true);
  }

  closeLoadPanel(): void {
    this.isLoadPanelOpen.set(false);
  }

  loadProject(projectId: string): void {
    const savedProject = this.storage.getProjectById(projectId);

    if (!savedProject) {
      alert('No se ha podido cargar esa canción.');
      this.refreshSavedProjects();
      return;
    }

    this.audioEngine.stop();
    this.projectState.setProject(savedProject);
    this.closeLoadPanel();
  }

  deleteSavedProject(projectId: string, event: MouseEvent): void {
    event.stopPropagation();

    const projectToDelete = this.storage.getProjectById(projectId);

    if (!projectToDelete) {
      return;
    }

    const shouldDelete = confirm(
      `¿Borrar la canción guardada "${projectToDelete.name}"?`
    );

    if (!shouldDelete) {
      return;
    }

    this.storage.deleteProject(projectId);
    this.refreshSavedProjects();
  }

  deleteAllSavedProjects(): void {
    const shouldDelete = confirm(
      '¿Borrar todas las canciones guardadas? Esta acción no se puede deshacer.'
    );

    if (!shouldDelete) {
      return;
    }

    this.storage.deleteAllProjects();
    this.refreshSavedProjects();
  }

  startPaintingPianoStep(
    trackId: TrackType,
    note: string,
    stepIndex: number,
    currentActive: boolean,
    event: PointerEvent
  ): void {
    event.preventDefault();

    this.isPainting = true;
    this.paintValue = !currentActive;

    this.projectState.setPianoStep(
      trackId,
      note,
      stepIndex,
      this.paintValue
    );
  }

  paintPianoStep(
    trackId: TrackType,
    note: string,
    stepIndex: number
  ): void {
    if (!this.isPainting || this.paintValue === null) {
      return;
    }

    this.projectState.setPianoStep(
      trackId,
      note,
      stepIndex,
      this.paintValue
    );
  }

  startPaintingDrumStep(
    sound: DrumSound,
    stepIndex: number,
    currentActive: boolean,
    event: PointerEvent
  ): void {
    event.preventDefault();

    this.isPainting = true;
    this.paintValue = !currentActive;

    this.projectState.setDrumStep(
      sound,
      stepIndex,
      this.paintValue
    );
  }

  paintDrumStep(
    sound: DrumSound,
    stepIndex: number
  ): void {
    if (!this.isPainting || this.paintValue === null) {
      return;
    }

    this.projectState.setDrumStep(
      sound,
      stepIndex,
      this.paintValue
    );
  }

  changeProjectName(event: Event): void {
    const input = event.target as HTMLInputElement;

    this.projectState.setProjectName(input.value);
  }

  changeBpm(event: Event): void {
    const input = event.target as HTMLInputElement;
    const bpm = Number(input.value);

    if (Number.isNaN(bpm)) {
      return;
    }

    this.projectState.setBpm(bpm);
    this.audioEngine.setBpm(bpm);
  }

  changeVolume(trackId: TrackType, event: Event): void {
    const input = event.target as HTMLInputElement;
    const volume = Number(input.value);

    if (Number.isNaN(volume)) {
      return;
    }

    this.projectState.setTrackVolume(trackId, volume);
  }

  toggleMute(trackId: TrackType): void {
    this.projectState.toggleMute(trackId);
  }

  toggleSolo(trackId: TrackType): void {
  this.projectState.toggleSolo(trackId);
  }

  toggleMetronome(): void {
  this.audioEngine.toggleMetronome();
  }

  isCurrentStep(stepIndex: number): boolean {
    return this.currentStep() === stepIndex;
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleString('es-ES', {
      dateStyle: 'short',
      timeStyle: 'short'
    });
  }

  private refreshSavedProjects(): void {
    this.savedProjects.set(this.storage.getProjects());
  }
}