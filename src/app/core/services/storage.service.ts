import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { StemlabProject } from '../../shared/models/stemlab-project.model';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly platformId = inject(PLATFORM_ID);

  private readonly storageKey = 'stemlab-projects';

  saveProject(project: StemlabProject): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const projects = this.getProjects();

    const projectToSave: StemlabProject = {
      ...project,
      updatedAt: new Date().toISOString()
    };

    const existingIndex = projects.findIndex(
      savedProject => savedProject.id === projectToSave.id
    );

    if (existingIndex >= 0) {
      projects[existingIndex] = projectToSave;
    } else {
      projects.push(projectToSave);
    }

    this.writeProjects(projects);
  }

  getProjects(): StemlabProject[] {
    if (!isPlatformBrowser(this.platformId)) {
      return [];
    }

    const rawProjects = localStorage.getItem(this.storageKey);

    if (!rawProjects) {
      return [];
    }

    try {
      const projects = JSON.parse(rawProjects) as StemlabProject[];

      if (!Array.isArray(projects)) {
        return [];
      }

      return projects
        .filter(project => this.isValidProject(project))
        .sort((a, b) => {
          const dateA = new Date(a.updatedAt).getTime();
          const dateB = new Date(b.updatedAt).getTime();

          return dateB - dateA;
        });
    } catch {
      return [];
    }
  }

  getProjectById(projectId: string): StemlabProject | null {
    const projects = this.getProjects();

    return projects.find(project => project.id === projectId) ?? null;
  }

  deleteProject(projectId: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const projects = this
      .getProjects()
      .filter(project => project.id !== projectId);

    this.writeProjects(projects);
  }

  deleteAllProjects(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    localStorage.removeItem(this.storageKey);
  }

  private writeProjects(projects: StemlabProject[]): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    localStorage.setItem(this.storageKey, JSON.stringify(projects));
  }

  private isValidProject(project: StemlabProject): boolean {
    if (!project || typeof project.id !== 'string') {
      return false;
    }

    if (typeof project.name !== 'string') {
      return false;
    }

    if (!Array.isArray(project.tracks)) {
      return false;
    }

    return project.tracks.every(track => {
      if (track.kind === 'piano') {
        return Array.isArray(track.notes);
      }

      if (track.kind === 'drums') {
        return Array.isArray(track.sounds);
      }

      return false;
    });
  }
}