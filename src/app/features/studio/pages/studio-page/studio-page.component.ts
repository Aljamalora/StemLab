import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { AudioEngineService } from '../../../../core/services/audio-engine.service';
import { ProjectStateService } from '../../../../core/services/project-state.service';
import { StorageService } from '../../../../core/services/storage.service';
import {
  PatternId,
  StemlabProject
} from '../../../../shared/models/stemlab-project.model';
import {
  DrumSound,
  PianoInstrumentPreset,
  PianoRollRow,
  PianoTrack,
  PianoTrackType,
  TrackType
} from '../../../../shared/models/track.model';

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
  readonly currentPlaybackPatternId = this.audioEngine.currentPlaybackPatternId;

  readonly savedProjects = signal<StemlabProject[]>([]);
  readonly isLoadPanelOpen = signal<boolean>(false);
  readonly isPatternSequencePanelOpen = signal<boolean>(false);

  readonly selectedPianoTrackId = signal<PianoTrackType | null>(null);

  readonly patternIds: PatternId[] = ['a', 'b', 'c', 'd'];

  readonly selectedPianoTrack = computed<PianoTrack | null>(() => {
    const selectedTrackId = this.selectedPianoTrackId();

    if (!selectedTrackId) {
      return null;
    }

    const selectedTrack = this.project().tracks.find(
      track => track.id === selectedTrackId
    );

    if (!selectedTrack || selectedTrack.kind !== 'piano') {
      return null;
    }

    return selectedTrack;
  });

  readonly stepNumbers = computed(() =>
    Array.from({ length: 16 }, (_, index) => index + 1)
  );

  readonly previewStepWidth = 100 / 16;

  readonly pianoInstrumentOptions: Record<
    PianoTrackType,
    Array<{ value: PianoInstrumentPreset; label: string }>
  > = {
    melody: [
      {
        value: 'default',
        label: 'Melodía limpia'
      },
      {
        value: 'soft',
        label: 'Melodía suave'
      },
      {
        value: 'bright',
        label: 'Melodía brillante'
      }
    ],

    harmony: [
      {
        value: 'default',
        label: 'Armonía limpia'
      },
      {
        value: 'soft',
        label: 'Armonía cálida'
      },
      {
        value: 'bright',
        label: 'Armonía brillante'
      }
    ],

    bass: [
      {
        value: 'default',
        label: 'Bajo clásico'
      },
      {
        value: 'soft',
        label: 'Bajo redondo'
      },
      {
        value: 'bright',
        label: 'Bajo agresivo'
      }
    ]
  };

  private isPainting = false;
  private paintValue: boolean | null = null;

  private isResizingPianoNote = false;
  private resizeTrackId: TrackType | null = null;
  private resizeNote: string | null = null;
  private resizeStartStep = 0;
  private resizeRowElement: HTMLElement | null = null;

  private draggedSequenceIndex: number | null = null;

  @HostListener('document:pointerup')
  @HostListener('document:pointercancel')
  stopPainting(): void {
    this.isPainting = false;
    this.paintValue = null;

    this.isResizingPianoNote = false;
    this.resizeTrackId = null;
    this.resizeNote = null;
    this.resizeStartStep = 0;
    this.resizeRowElement = null;
  }

  @HostListener('document:pointermove', ['$event'])
  resizePianoNoteFromPointer(event: PointerEvent): void {
    if (
      !this.isResizingPianoNote ||
      !this.resizeTrackId ||
      !this.resizeNote ||
      !this.resizeRowElement
    ) {
      return;
    }

    const targetStep = this.getStepIndexFromPointer(
      event,
      this.resizeRowElement
    );

    const duration = Math.max(
      1,
      targetStep - this.resizeStartStep + 1
    );

    this.projectState.setPianoStepDuration(
      this.resizeTrackId,
      this.resizeNote,
      this.resizeStartStep,
      duration
    );
  }

  async play(): Promise<void> {
    await this.audioEngine.togglePlay(() => this.project());
  }

  stop(): void {
    this.audioEngine.stop();
  }

  setActivePattern(patternId: PatternId): void {
    this.projectState.setActivePattern(patternId);
  }

  copyPattern(): void {
    this.projectState.copyActivePattern();
  }

  pastePattern(): void {
    this.projectState.pasteToActivePattern();
  }

  togglePatternSequenceEnabled(): void {
    this.projectState.setPatternSequenceEnabled(
      !this.project().patternSequenceEnabled
    );
  }

  openPatternSequencePanel(): void {
    this.closeLoadPanel();
    this.closePianoRollEditor();
    this.isPatternSequencePanelOpen.set(true);
  }

  closePatternSequencePanel(): void {
    this.isPatternSequencePanelOpen.set(false);
    this.draggedSequenceIndex = null;
  }

  addPatternToSequence(patternId: PatternId): void {
    this.projectState.addPatternToSequence(patternId);
  }

  removePatternFromSequence(index: number): void {
    this.projectState.removePatternFromSequence(index);
  }

  clearPatternSequence(): void {
    this.projectState.clearPatternSequence();
  }

  startDraggingSequenceItem(index: number, event: DragEvent): void {
    this.draggedSequenceIndex = index;
    event.dataTransfer?.setData('text/plain', String(index));
  }

  allowSequenceDrop(event: DragEvent): void {
    event.preventDefault();
  }

  dropSequenceItem(targetIndex: number, event: DragEvent): void {
    event.preventDefault();

    if (this.draggedSequenceIndex === null) {
      return;
    }

    if (this.draggedSequenceIndex === targetIndex) {
      this.draggedSequenceIndex = null;
      return;
    }

    this.projectState.movePatternInSequence(
      this.draggedSequenceIndex,
      targetIndex
    );

    this.draggedSequenceIndex = null;
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
    this.closePianoRollEditor();
    this.closePatternSequencePanel();
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
    this.closePianoRollEditor();
    this.closePatternSequencePanel();
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
    this.closePianoRollEditor();
    this.closePatternSequencePanel();
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

  openPianoRollEditor(trackId: PianoTrackType): void {
    this.closeLoadPanel();
    this.closePatternSequencePanel();
    this.selectedPianoTrackId.set(trackId);
  }

  closePianoRollEditor(): void {
    this.selectedPianoTrackId.set(null);
  }

  startPaintingPianoStep(
    trackId: TrackType,
    note: string,
    stepIndex: number,
    event: PointerEvent,
    rowElement: HTMLElement
  ): void {
    event.preventDefault();

    const existingNote = this.findPianoNoteAt(trackId, note, stepIndex);

    if (event.button === 2) {
      this.isPainting = false;
      this.paintValue = null;

      const anchorStep = existingNote?.anchorStep ?? stepIndex;

      this.isResizingPianoNote = true;
      this.resizeTrackId = trackId;
      this.resizeNote = note;
      this.resizeStartStep = anchorStep;
      this.resizeRowElement = rowElement;

      if (!existingNote) {
        this.projectState.setPianoStepDuration(
          trackId,
          note,
          stepIndex,
          1
        );
      }

      this.resizePianoNoteFromPointer(event);
      return;
    }

    if (event.button !== 0) {
      return;
    }

    this.isResizingPianoNote = false;
    this.resizeTrackId = null;
    this.resizeNote = null;
    this.resizeStartStep = 0;
    this.resizeRowElement = null;

    this.isPainting = true;
    this.paintValue = existingNote ? false : true;

    this.applyPianoPaintValue(trackId, note, stepIndex);
  }

  paintPianoStep(
    trackId: TrackType,
    note: string,
    stepIndex: number
  ): void {
    if (this.isResizingPianoNote) {
      return;
    }

    if (!this.isPainting || this.paintValue === null) {
      return;
    }

    this.applyPianoPaintValue(trackId, note, stepIndex);
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

  changeMasterVolume(event: Event): void {
    const input = event.target as HTMLInputElement;
    const masterVolume = Number(input.value);

    if (Number.isNaN(masterVolume)) {
      return;
    }

    this.projectState.setMasterVolume(masterVolume);
    this.audioEngine.setMasterVolume(masterVolume);
  }

  changeVolume(trackId: TrackType, event: Event): void {
    const input = event.target as HTMLInputElement;
    const volume = Number(input.value);

    if (Number.isNaN(volume)) {
      return;
    }

    this.projectState.setTrackVolume(trackId, volume);
  }

  changePianoInstrument(
    trackId: PianoTrackType,
    event: Event
  ): void {
    const select = event.target as HTMLSelectElement;
    const instrumentPreset = select.value as PianoInstrumentPreset;

    this.projectState.setPianoTrackInstrument(trackId, instrumentPreset);
  }

  getInstrumentOptions(
    trackId: PianoTrackType
  ): Array<{ value: PianoInstrumentPreset; label: string }> {
    return this.pianoInstrumentOptions[trackId];
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

  preventContextMenu(event: Event): void {
    event.preventDefault();
  }

  hasActiveNotes(track: PianoTrack): boolean {
    return track.notes.some(noteRow =>
      noteRow.steps.some(step => step.active)
    );
  }

  getPreviewNoteBlocks(track: PianoTrack): Array<{
    id: string;
    left: number;
    top: number;
    width: number;
    height: number;
    sharp: boolean;
  }> {
    const totalRows = track.notes.length;
    const totalSteps = 16;
    const rowHeight = 100 / totalRows;
    const stepWidth = 100 / totalSteps;

    const blocks: Array<{
      id: string;
      left: number;
      top: number;
      width: number;
      height: number;
      sharp: boolean;
    }> = [];

    track.notes.forEach((noteRow, rowIndex) => {
      noteRow.steps.forEach((step, stepIndex) => {
        if (!step.active) {
          return;
        }

        const duration = Math.max(1, step.duration ?? 1);
        const safeDuration = Math.min(duration, totalSteps - stepIndex);

        blocks.push({
          id: `${track.id}-${noteRow.note}-${stepIndex}`,
          left: stepIndex * stepWidth,
          top: rowIndex * rowHeight,
          width: stepWidth * safeDuration,
          height: rowHeight,
          sharp: noteRow.label.includes('#')
        });
      });
    });

    return blocks;
  }

  getPianoRowNoteBlocks(noteRow: PianoRollRow): Array<{
    id: string;
    left: string;
    width: string;
    sharp: boolean;
  }> {
    return noteRow.steps
      .map((step, stepIndex) => {
        if (!step.active) {
          return null;
        }

        const duration = Math.max(1, step.duration ?? 1);
        const safeDuration = Math.min(duration, 16 - stepIndex);

        return {
          id: `${noteRow.note}-${stepIndex}`,
          left: `calc(5rem + 0.4rem + ${stepIndex} * (2.25rem + 0.4rem))`,
          width: `calc(${safeDuration} * 2.25rem + ${safeDuration - 1} * 0.4rem)`,
          sharp: noteRow.label.includes('#')
        };
      })
      .filter(block => block !== null) as Array<{
        id: string;
        left: string;
        width: string;
        sharp: boolean;
      }>;
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleString('es-ES', {
      dateStyle: 'short',
      timeStyle: 'short'
    });
  }

  private applyPianoPaintValue(
    trackId: TrackType,
    note: string,
    stepIndex: number
  ): void {
    const existingNote = this.findPianoNoteAt(trackId, note, stepIndex);

    if (this.paintValue === false) {
      if (!existingNote) {
        return;
      }

      this.projectState.removePianoNoteAt(
        trackId,
        note,
        existingNote.anchorStep
      );

      return;
    }

    if (existingNote) {
      return;
    }

    this.projectState.setPianoStep(
      trackId,
      note,
      stepIndex,
      true
    );
  }

  private findPianoNoteAt(
    trackId: TrackType,
    note: string,
    stepIndex: number
  ): { anchorStep: number; duration: number } | null {
    const track = this.project().tracks.find(
      projectTrack => projectTrack.id === trackId
    );

    if (!track || track.kind !== 'piano') {
      return null;
    }

    const noteRow = track.notes.find(row => row.note === note);

    if (!noteRow) {
      return null;
    }

    for (let index = stepIndex; index >= 0; index--) {
      const step = noteRow.steps[index];

      if (!step?.active) {
        continue;
      }

      const duration = Math.max(1, step.duration ?? 1);

      if (stepIndex >= index && stepIndex < index + duration) {
        return {
          anchorStep: index,
          duration
        };
      }
    }

    return null;
  }

  private getStepIndexFromPointer(
    event: PointerEvent,
    rowElement: HTMLElement
  ): number {
    const stepButtons = Array.from(
      rowElement.querySelectorAll<HTMLButtonElement>('.step--piano')
    );

    if (stepButtons.length === 0) {
      return 0;
    }

    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    stepButtons.forEach((button, index) => {
      const rect = button.getBoundingClientRect();
      const center = rect.left + rect.width / 2;
      const distance = Math.abs(event.clientX - center);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    return Math.max(0, Math.min(15, closestIndex));
  }

  private refreshSavedProjects(): void {
    this.savedProjects.set(this.storage.getProjects());
  }
}