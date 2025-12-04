import * as vscode from 'vscode';

export interface WindowPair {
  id: string;
  originalPath: string;
  worktreePath: string;
  createdAt: number;
}

const PAIRS_KEY = 'commitview.windowPairs';

export class WindowTracker {
  constructor(private globalState: vscode.Memento) {}

  registerWindowPair(originalPath: string, worktreePath: string): void {
    const pairs = this.getActivePairs();

    // Remove any existing pair for the same paths
    const filtered = pairs.filter(
      (p) => p.originalPath !== originalPath && p.worktreePath !== worktreePath
    );

    filtered.push({
      id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      originalPath,
      worktreePath,
      createdAt: Date.now(),
    });

    this.globalState.update(PAIRS_KEY, filtered);
  }

  getPartnerWindow(currentPath: string): string | undefined {
    const pairs = this.getActivePairs();

    for (const pair of pairs) {
      if (pair.originalPath === currentPath) {
        return pair.worktreePath;
      }
      if (pair.worktreePath === currentPath) {
        return pair.originalPath;
      }
    }

    return undefined;
  }

  isWorktreeWindow(path: string): boolean {
    const pairs = this.getActivePairs();
    return pairs.some((p) => p.worktreePath === path);
  }

  isOriginalWindow(path: string): boolean {
    const pairs = this.getActivePairs();
    return pairs.some((p) => p.originalPath === path);
  }

  unregisterWindowPair(path: string): void {
    const pairs = this.getActivePairs();
    const filtered = pairs.filter(
      (p) => p.originalPath !== path && p.worktreePath !== path
    );
    this.globalState.update(PAIRS_KEY, filtered);
  }

  getActivePairs(): WindowPair[] {
    return this.globalState.get<WindowPair[]>(PAIRS_KEY, []);
  }

  getPairByWorktreePath(worktreePath: string): WindowPair | undefined {
    const pairs = this.getActivePairs();
    return pairs.find((p) => p.worktreePath === worktreePath);
  }

  getPairByOriginalPath(originalPath: string): WindowPair | undefined {
    const pairs = this.getActivePairs();
    return pairs.find((p) => p.originalPath === originalPath);
  }
}
