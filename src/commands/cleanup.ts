import * as vscode from 'vscode';
import { WorktreeManager } from '../services/WorktreeManager';
import { WindowTracker } from '../ipc/WindowTracker';

export async function closeWorktreeCommand(
  worktreeManager: WorktreeManager,
  windowTracker: WindowTracker
): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

  if (!workspaceFolder) {
    vscode.window.showWarningMessage('No workspace folder open.');
    return;
  }

  const currentPath = workspaceFolder.uri.fsPath;

  const isWorktree = await worktreeManager.isCommitViewWorktree(currentPath);
  if (!isWorktree) {
    vscode.window.showInformationMessage('This window is not a CommitView worktree.');
    return;
  }

  const config = vscode.workspace.getConfiguration('commitview');
  const confirmCleanup = config.get<boolean>('confirmCleanup', false);

  if (confirmCleanup) {
    const choice = await vscode.window.showWarningMessage(
      'Are you sure you want to close and cleanup this worktree?',
      { modal: true },
      'Yes',
      'No'
    );

    if (choice !== 'Yes') {
      return;
    }
  }

  // Get partner window path before cleanup
  const partnerPath = windowTracker.getPartnerWindow(currentPath);

  try {
    await worktreeManager.removeWorktree(currentPath);
    windowTracker.unregisterWindowPair(currentPath);

    vscode.window.showInformationMessage('Worktree cleaned up successfully.');

    // Close the current window and optionally switch to partner
    if (partnerPath) {
      await vscode.commands.executeCommand(
        'vscode.openFolder',
        vscode.Uri.file(partnerPath),
        { forceNewWindow: false }
      );
    } else {
      await vscode.commands.executeCommand('workbench.action.closeWindow');
    }
  } catch (error) {
    vscode.window.showErrorMessage(
      `Failed to cleanup worktree: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function cleanupAllCommand(worktreeManager: WorktreeManager): Promise<void> {
  const trackedWorktrees = worktreeManager.getTrackedWorktrees();

  if (trackedWorktrees.length === 0) {
    vscode.window.showInformationMessage('No CommitView worktrees to clean up.');
    return;
  }

  const choice = await vscode.window.showWarningMessage(
    `Are you sure you want to cleanup ${trackedWorktrees.length} worktree(s)?`,
    { modal: true },
    'Yes',
    'No'
  );

  if (choice !== 'Yes') {
    return;
  }

  try {
    const cleanedCount = await worktreeManager.cleanupAll();
    vscode.window.showInformationMessage(`Cleaned up ${cleanedCount} worktree(s).`);
  } catch (error) {
    vscode.window.showErrorMessage(
      `Failed to cleanup worktrees: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
