import * as vscode from 'vscode';
import * as path from 'path';

export interface WindowState {
  openFiles: string[];  // Relative paths
  terminals: TerminalState[];
  activeFile?: string;  // Relative path of active editor
}

export interface TerminalState {
  name: string;
}

const STATE_KEY_PREFIX = 'commitview.windowState.';

export class WindowStateService {
  constructor(private globalState: vscode.Memento) {}

  /**
   * Capture current window state (open files, terminals)
   */
  captureCurrentState(repoRoot: string): WindowState {
    const state: WindowState = {
      openFiles: [],
      terminals: [],
    };

    // Capture open files
    const tabGroups = vscode.window.tabGroups;
    for (const group of tabGroups.all) {
      for (const tab of group.tabs) {
        if (tab.input instanceof vscode.TabInputText) {
          const filePath = tab.input.uri.fsPath;
          // Convert to relative path
          if (filePath.startsWith(repoRoot)) {
            const relativePath = path.relative(repoRoot, filePath);
            if (!state.openFiles.includes(relativePath)) {
              state.openFiles.push(relativePath);
            }
          }
        }
      }
    }

    // Capture active editor
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      const activePath = activeEditor.document.uri.fsPath;
      if (activePath.startsWith(repoRoot)) {
        state.activeFile = path.relative(repoRoot, activePath);
      }
    }

    // Capture terminals
    for (const terminal of vscode.window.terminals) {
      state.terminals.push({
        name: terminal.name,
      });
    }

    return state;
  }

  /**
   * Save state for a specific worktree
   */
  async saveStateForWorktree(worktreePath: string, state: WindowState): Promise<void> {
    const key = STATE_KEY_PREFIX + worktreePath;
    await this.globalState.update(key, state);
  }

  /**
   * Get saved state for a worktree
   */
  getStateForWorktree(worktreePath: string): WindowState | undefined {
    const key = STATE_KEY_PREFIX + worktreePath;
    return this.globalState.get<WindowState>(key);
  }

  /**
   * Clear saved state for a worktree
   */
  async clearStateForWorktree(worktreePath: string): Promise<void> {
    const key = STATE_KEY_PREFIX + worktreePath;
    await this.globalState.update(key, undefined);
  }

  /**
   * Restore window state in the new worktree window
   */
  async restoreState(worktreePath: string): Promise<void> {
    const state = this.getStateForWorktree(worktreePath);
    if (!state) {
      return;
    }

    // Open files
    for (const relativePath of state.openFiles) {
      const fullPath = path.join(worktreePath, relativePath);
      try {
        const uri = vscode.Uri.file(fullPath);
        // Check if file exists in worktree
        try {
          await vscode.workspace.fs.stat(uri);
          await vscode.window.showTextDocument(uri, { preview: false, preserveFocus: true });
        } catch {
          // File doesn't exist in this commit, skip
        }
      } catch {
        // Ignore errors opening files
      }
    }

    // Focus the active file if it was captured
    if (state.activeFile) {
      const activePath = path.join(worktreePath, state.activeFile);
      try {
        const uri = vscode.Uri.file(activePath);
        await vscode.workspace.fs.stat(uri);
        await vscode.window.showTextDocument(uri, { preview: false });
      } catch {
        // Active file doesn't exist, ignore
      }
    }

    // Create terminals
    for (const terminalState of state.terminals) {
      const terminal = vscode.window.createTerminal({
        name: terminalState.name,
        cwd: worktreePath,
      });
      // Don't show immediately, just create them
    }

    // Show first terminal if any were created
    if (state.terminals.length > 0) {
      const terminals = vscode.window.terminals;
      if (terminals.length > 0) {
        terminals[0].show();
      }
    }

    // Clear the saved state after restoring
    await this.clearStateForWorktree(worktreePath);
  }
}
