import * as vscode from 'vscode';
import { GitService } from './services/GitService';
import { CommitService } from './services/CommitService';
import { WorktreeManager } from './services/WorktreeManager';
import { FileCopyService } from './services/FileCopyService';
import { DiffService } from './services/DiffService';
import { WindowTracker } from './ipc/WindowTracker';
import { DiffTreeProvider } from './providers/DiffTreeProvider';
import { selectCommitCommand } from './commands/selectCommit';
import { quickSwitchCommand } from './commands/quickSwitch';
import { closeWorktreeCommand, cleanupAllCommand } from './commands/cleanup';

let worktreeManager: WorktreeManager;
let windowTracker: WindowTracker;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('CommitView extension activating...');

  // Initialize services
  const gitService = new GitService();
  const commitService = new CommitService();
  worktreeManager = new WorktreeManager(gitService, context.globalState);
  const fileCopyService = new FileCopyService();
  const diffService = new DiffService();
  windowTracker = new WindowTracker(context.globalState);

  // Get current workspace path
  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  // Check if current workspace is a CommitView worktree
  let isWorktreeWindow = false;
  let worktreeInfo = null;

  if (workspacePath) {
    isWorktreeWindow = await worktreeManager.isCommitViewWorktree(workspacePath);
    if (isWorktreeWindow) {
      worktreeInfo = await worktreeManager.getWorktreeInfo(workspacePath);
    }
  }

  // Set context for when clauses
  await vscode.commands.executeCommand('setContext', 'commitview.isWorktreeWindow', isWorktreeWindow);
  await vscode.commands.executeCommand(
    'setContext',
    'commitview.hasActiveWorktree',
    windowTracker.getActivePairs().length > 0
  );

  // Register Diff Tree View (only for worktree windows)
  const diffTreeProvider = new DiffTreeProvider(diffService);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('commitview.diffSummary', diffTreeProvider)
  );

  // Initialize diff view if this is a worktree window
  if (isWorktreeWindow && worktreeInfo) {
    try {
      const currentSha = await gitService.getCurrentCommitSha(worktreeInfo.originalRepoPath);
      await diffTreeProvider.initialize(
        worktreeInfo.originalRepoPath,
        worktreeInfo.commitSha,
        currentSha
      );
    } catch (error) {
      console.error('Failed to initialize diff view:', error);
    }
  }

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('commitview.selectCommit', () =>
      selectCommitCommand(gitService, commitService, worktreeManager, fileCopyService, windowTracker)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('commitview.quickSwitch', () =>
      quickSwitchCommand(windowTracker)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('commitview.showDiffSummary', () => {
      vscode.commands.executeCommand('commitview.diffSummary.focus');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('commitview.closeWorktree', () =>
      closeWorktreeCommand(worktreeManager, windowTracker)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('commitview.cleanupAll', () =>
      cleanupAllCommand(worktreeManager)
    )
  );

  // Create status bar button
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);

  if (isWorktreeWindow && worktreeInfo) {
    // Worktree window: show commit info and switch button
    statusBar.text = `$(git-compare) ${worktreeInfo.commitSha.substring(0, 7)}`;
    statusBar.tooltip = `CommitView: ${worktreeInfo.commitMessage}\nClick to switch to original window`;
    statusBar.command = 'commitview.quickSwitch';
    statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');

    // Show info message
    vscode.window.showInformationMessage(
      `Viewing commit ${worktreeInfo.commitSha.substring(0, 7)}: ${worktreeInfo.commitMessage}`,
      'Switch Back',
      'Show Diff'
    ).then((choice) => {
      if (choice === 'Switch Back') {
        vscode.commands.executeCommand('commitview.quickSwitch');
      } else if (choice === 'Show Diff') {
        vscode.commands.executeCommand('commitview.diffSummary.focus');
      }
    });
  } else if (workspacePath && await gitService.isGitRepository(workspacePath)) {
    // Regular git repo: show "View Commit" button
    statusBar.text = `$(git-commit) CommitView`;
    statusBar.tooltip = 'Click to view a previous commit in a new window';
    statusBar.command = 'commitview.selectCommit';
  }

  statusBar.show();
  context.subscriptions.push(statusBar);

  // Cleanup stale worktrees on activation
  try {
    const cleanedCount = await worktreeManager.cleanupStaleWorktrees();
    if (cleanedCount > 0) {
      console.log(`CommitView: Cleaned up ${cleanedCount} stale worktree(s)`);
    }
  } catch (error) {
    console.error('Failed to cleanup stale worktrees:', error);
  }

  console.log('CommitView extension activated');
}

export async function deactivate(): Promise<void> {
  console.log('CommitView extension deactivating...');

  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  if (workspacePath && worktreeManager) {
    const isWorktree = await worktreeManager.isCommitViewWorktree(workspacePath);

    if (isWorktree) {
      const config = vscode.workspace.getConfiguration('commitview');
      const autoCleanup = config.get<boolean>('autoCleanupOnClose', true);

      if (autoCleanup) {
        try {
          await worktreeManager.removeWorktree(workspacePath);
          windowTracker?.unregisterWindowPair(workspacePath);
          console.log('CommitView: Auto-cleaned worktree on window close');
        } catch (error) {
          console.error('CommitView: Failed to auto-cleanup worktree:', error);
        }
      }
    }
  }

  console.log('CommitView extension deactivated');
}
