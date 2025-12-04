import * as vscode from 'vscode';
import * as fs from 'fs';
import { GitService } from './GitService';
import { generateWorktreePath, isCommitViewTempPath, removeDirectory } from '../utils/tempDir';

export interface WorktreeInfo {
  id: string;
  path: string;
  commitSha: string;
  commitMessage: string;
  originalRepoPath: string;
  createdAt: number;
}

const WORKTREES_KEY = 'commitview.worktrees';

export class WorktreeManager {
  constructor(
    private gitService: GitService,
    private globalState: vscode.Memento
  ) {}

  async createWorktree(
    repoPath: string,
    commitSha: string,
    commitMessage: string
  ): Promise<WorktreeInfo> {
    const repoName = await this.gitService.getRepoName(repoPath);
    const shortSha = commitSha.substring(0, 7);
    const worktreePath = generateWorktreePath(repoName, shortSha);

    await this.gitService.createWorktree(repoPath, worktreePath, commitSha);

    const worktree: WorktreeInfo = {
      id: `${repoName}-${shortSha}-${Date.now()}`,
      path: worktreePath,
      commitSha,
      commitMessage,
      originalRepoPath: repoPath,
      createdAt: Date.now(),
    };

    await this.trackWorktree(worktree);

    return worktree;
  }

  async removeWorktree(worktreePath: string): Promise<void> {
    const worktree = await this.getWorktreeInfo(worktreePath);

    if (worktree) {
      try {
        await this.gitService.removeWorktree(worktree.originalRepoPath, worktreePath);
      } catch {
        // If git remove fails, try force removal
        try {
          await this.gitService.removeWorktree(worktree.originalRepoPath, worktreePath, true);
        } catch {
          // If that also fails, just delete the directory
          removeDirectory(worktreePath);
        }
      }

      // Prune worktree metadata
      try {
        await this.gitService.pruneWorktrees(worktree.originalRepoPath);
      } catch {
        // Ignore prune errors
      }

      await this.untrackWorktree(worktreePath);
    } else {
      // Not tracked, just remove directory if it's a commitview temp path
      if (isCommitViewTempPath(worktreePath) && fs.existsSync(worktreePath)) {
        removeDirectory(worktreePath);
      }
    }
  }

  async isCommitViewWorktree(path: string): Promise<boolean> {
    if (!isCommitViewTempPath(path)) {
      return false;
    }

    const trackedWorktrees = this.getTrackedWorktrees();
    return trackedWorktrees.some((w) => w.path === path);
  }

  async getWorktreeInfo(path: string): Promise<WorktreeInfo | null> {
    const trackedWorktrees = this.getTrackedWorktrees();
    return trackedWorktrees.find((w) => w.path === path) || null;
  }

  async getWorktreeForRepo(repoPath: string): Promise<WorktreeInfo[]> {
    const trackedWorktrees = this.getTrackedWorktrees();
    return trackedWorktrees.filter((w) => w.originalRepoPath === repoPath);
  }

  async cleanupAll(): Promise<number> {
    const trackedWorktrees = this.getTrackedWorktrees();
    let cleanedCount = 0;

    for (const worktree of trackedWorktrees) {
      try {
        await this.removeWorktree(worktree.path);
        cleanedCount++;
      } catch {
        // Continue with others even if one fails
      }
    }

    return cleanedCount;
  }

  async cleanupStaleWorktrees(): Promise<number> {
    const trackedWorktrees = this.getTrackedWorktrees();
    let cleanedCount = 0;

    for (const worktree of trackedWorktrees) {
      // Check if directory still exists
      if (!fs.existsSync(worktree.path)) {
        await this.untrackWorktree(worktree.path);
        cleanedCount++;
        continue;
      }

      // Check if original repo still exists
      if (!fs.existsSync(worktree.originalRepoPath)) {
        removeDirectory(worktree.path);
        await this.untrackWorktree(worktree.path);
        cleanedCount++;
        continue;
      }

      // Check if worktree is older than 24 hours and no VS Code window is open
      // (We can't reliably detect open windows, so we use age as a heuristic)
      const ageMs = Date.now() - worktree.createdAt;
      const maxAgeMs = 24 * 60 * 60 * 1000; // 24 hours

      if (ageMs > maxAgeMs) {
        try {
          await this.removeWorktree(worktree.path);
          cleanedCount++;
        } catch {
          // May still be in use
        }
      }
    }

    return cleanedCount;
  }

  getTrackedWorktrees(): WorktreeInfo[] {
    return this.globalState.get<WorktreeInfo[]>(WORKTREES_KEY, []);
  }

  private async trackWorktree(worktree: WorktreeInfo): Promise<void> {
    const worktrees = this.getTrackedWorktrees();
    worktrees.push(worktree);
    await this.globalState.update(WORKTREES_KEY, worktrees);
  }

  private async untrackWorktree(path: string): Promise<void> {
    const worktrees = this.getTrackedWorktrees();
    const filtered = worktrees.filter((w) => w.path !== path);
    await this.globalState.update(WORKTREES_KEY, filtered);
  }
}
