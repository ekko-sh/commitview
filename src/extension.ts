import * as vscode from 'vscode';
import { GitService } from './services/GitService';
import { CommitService } from './services/CommitService';
import { WorktreeManager } from './services/WorktreeManager';
import { FileCopyService } from './services/FileCopyService';
import { DiffService } from './services/DiffService';
import { WindowStateService } from './services/WindowStateService';
import { WindowTracker } from './ipc/WindowTracker';
import { DiffTreeProvider } from './providers/DiffTreeProvider';
import { CommitListProvider, CommitTreeItem } from './providers/CommitListProvider';
import { WorktreeListProvider } from './providers/WorktreeListProvider';
import { selectCommitCommand } from './commands/selectCommit';
import { quickSwitchCommand } from './commands/quickSwitch';
import { closeWorktreeCommand, cleanupAllCommand } from './commands/cleanup';
import { CommitViewError, getUserFriendlyMessage } from './utils/errors';

let worktreeManager: WorktreeManager;
let windowTracker: WindowTracker;
let windowStateService: WindowStateService;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('CommitView extension activating...');

  // Initialize services
  const gitService = new GitService();
  const commitService = new CommitService();
  worktreeManager = new WorktreeManager(gitService, context.globalState);
  const fileCopyService = new FileCopyService();
  const diffService = new DiffService();
  windowTracker = new WindowTracker(context.globalState);
  windowStateService = new WindowStateService(context.globalState);

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

  // Register Commit List View (sidebar)
  const commitListProvider = new CommitListProvider(commitService, gitService);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('commitview.commits', commitListProvider)
  );

  // Register Worktree List View (sidebar)
  const worktreeListProvider = new WorktreeListProvider(worktreeManager);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('commitview.activeWorktrees', worktreeListProvider)
  );

  // Register Diff Tree View (only for worktree windows)
  const diffTreeProvider = new DiffTreeProvider(diffService);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('commitview.diffSummary', diffTreeProvider)
  );

  // Initialize providers
  await commitListProvider.initialize();

  // Initialize diff view and restore window state if this is a worktree window
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

    // Restore window state (open files, terminals) from original window
    try {
      await windowStateService.restoreState(workspacePath!);
    } catch (error) {
      console.error('Failed to restore window state:', error);
    }
  }

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('commitview.selectCommit', () =>
      selectCommitCommand(gitService, commitService, worktreeManager, fileCopyService, windowTracker)
    )
  );

  // Command to view a specific commit from the tree view
  context.subscriptions.push(
    vscode.commands.registerCommand('commitview.viewCommit', async (item: CommitTreeItem) => {
      if (!item?.commit) {
        return;
      }

      const commit = item.commit;
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

      if (!workspaceFolder) {
        return;
      }

      const repoPath = workspaceFolder.uri.fsPath;

      // Check if worktree already exists for this commit
      const existingWorktree = await worktreeManager.findWorktreeByCommit(repoPath, commit.sha);

      if (existingWorktree) {
        // Just open the existing one
        await vscode.commands.executeCommand(
          'vscode.openFolder',
          vscode.Uri.file(existingWorktree.path),
          { forceNewWindow: true }
        );
        return;
      }

      // Show confirmation popup
      const confirm = await vscode.window.showInformationMessage(
        `Open commit "${commit.subject}" (${commit.shortSha}) in a new window?`,
        { modal: false },
        'Open',
        'Cancel'
      );

      if (confirm !== 'Open') {
        return;
      }

      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Opening commit ${commit.shortSha}...`,
          cancellable: false,
        },
        async (progress) => {
          try {
            progress.report({ message: 'Creating worktree...' });

            const worktree = await worktreeManager.createWorktree(
              repoPath,
              commit.sha,
              commit.subject
            );

            // Copy config files
            progress.report({ message: 'Copying configuration files...' });
            const copyResult = await fileCopyService.copyConfigFiles(repoPath, worktree.path);

            if (copyResult.copied.length > 0) {
              const fileList = copyResult.copied.slice(0, 3).join(', ');
              const moreCount = copyResult.copied.length > 3 ? ` +${copyResult.copied.length - 3} more` : '';
              vscode.window.showInformationMessage(`Copied: ${fileList}${moreCount}`);
            }

            // Capture current window state (open files, terminals)
            progress.report({ message: 'Capturing window state...' });
            const windowState = windowStateService.captureCurrentState(repoPath);
            await windowStateService.saveStateForWorktree(worktree.path, windowState);

            // Register window pair
            windowTracker.registerWindowPair(repoPath, worktree.path);

            // Refresh worktree list
            worktreeListProvider.refresh();

            // Open in new window
            progress.report({ message: 'Opening new window...' });

            await vscode.commands.executeCommand(
              'vscode.openFolder',
              vscode.Uri.file(worktree.path),
              { forceNewWindow: true }
            );
          } catch (error) {
            if (error instanceof CommitViewError) {
              vscode.window.showErrorMessage(getUserFriendlyMessage(error.code));
            } else {
              vscode.window.showErrorMessage(
                `Failed to open commit: ${error instanceof Error ? error.message : String(error)}`
              );
            }
          }
        }
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('commitview.refreshCommits', () => {
      commitListProvider.refresh();
    })
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
    vscode.commands.registerCommand('commitview.closeWorktree', async (item?: { worktree?: { path: string } }) => {
      if (item?.worktree) {
        // Called from worktree list view
        await worktreeManager.removeWorktree(item.worktree.path);
        windowTracker.unregisterWindowPair(item.worktree.path);
        worktreeListProvider.refresh();
        vscode.window.showInformationMessage('Worktree cleaned up.');
      } else {
        // Called from command palette or current worktree window
        await closeWorktreeCommand(worktreeManager, windowTracker);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('commitview.cleanupAll', async () => {
      await cleanupAllCommand(worktreeManager);
      worktreeListProvider.refresh();
    })
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
      worktreeListProvider.refresh();
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
