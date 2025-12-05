import * as vscode from 'vscode';
import { GitService } from '../services/GitService';
import { CommitService } from '../services/CommitService';
import { WorktreeManager } from '../services/WorktreeManager';
import { FileCopyService } from '../services/FileCopyService';
import { WindowTracker } from '../ipc/WindowTracker';
import { showCommitPicker } from '../providers/CommitQuickPick';
import { CommitViewError, ErrorCode, getUserFriendlyMessage } from '../utils/errors';

export async function selectCommitCommand(
  gitService: GitService,
  commitService: CommitService,
  worktreeManager: WorktreeManager,
  fileCopyService: FileCopyService,
  windowTracker: WindowTracker
): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder open.');
    return;
  }

  const repoPath = workspaceFolder.uri.fsPath;

  // Check if this is a git repository
  const isGitRepo = await gitService.isGitRepository(repoPath);
  if (!isGitRepo) {
    vscode.window.showErrorMessage('This folder is not a Git repository.');
    return;
  }

  try {
    // Validate git version
    await gitService.validateGitVersion();
  } catch (error) {
    if (error instanceof CommitViewError) {
      vscode.window.showErrorMessage(getUserFriendlyMessage(error.code));
    }
    return;
  }

  // Fetch recent commits
  const config = vscode.workspace.getConfiguration('commitview');
  const maxCommits = config.get<number>('maxCommitHistory', 100);

  let commits;
  try {
    commits = await commitService.getRecentCommits(repoPath, maxCommits);
  } catch (error) {
    vscode.window.showErrorMessage('Failed to fetch commit history.');
    return;
  }

  if (commits.length === 0) {
    vscode.window.showInformationMessage('No commits found in this repository.');
    return;
  }

  // Show commit picker
  const selectedCommit = await showCommitPicker(commits);

  if (!selectedCommit) {
    return; // User cancelled
  }

  // Create worktree
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Creating worktree...',
      cancellable: false,
    },
    async (progress) => {
      try {
        progress.report({ message: `Creating worktree at ${selectedCommit.shortSha}...` });

        const worktree = await worktreeManager.createWorktree(
          repoPath,
          selectedCommit.sha,
          selectedCommit.subject
        );

        // Link config files and directories
        progress.report({ message: 'Linking configuration files...' });
        const linkResult = await fileCopyService.linkConfigFiles(repoPath, worktree.path);

        if (linkResult.linked.length > 0) {
          const fileList = linkResult.linked.slice(0, 3).join(', ');
          const moreCount = linkResult.linked.length > 3 ? ` +${linkResult.linked.length - 3} more` : '';
          vscode.window.showInformationMessage(`Linked: ${fileList}${moreCount}`);
        }

        if (linkResult.failed.length > 0) {
          vscode.window.showWarningMessage(
            `Failed to link: ${linkResult.failed.join(', ')}`
          );
        }

        // Register window pair
        windowTracker.registerWindowPair(repoPath, worktree.path);

        // Open in new window
        progress.report({ message: 'Opening new window...' });

        await vscode.commands.executeCommand(
          'vscode.openFolder',
          vscode.Uri.file(worktree.path),
          { forceNewWindow: true }
        );

        vscode.window.showInformationMessage(
          `Opened commit ${selectedCommit.shortSha} in new window. Use Alt+Shift+S to switch back.`
        );
      } catch (error) {
        if (error instanceof CommitViewError) {
          const message = getUserFriendlyMessage(error.code);

          if (error.code === ErrorCode.WORKTREE_ALREADY_EXISTS) {
            const choice = await vscode.window.showWarningMessage(
              `${message} Do you want to open the existing worktree?`,
              'Open Existing',
              'Cancel'
            );

            if (choice === 'Open Existing') {
              const existingWorktrees = await worktreeManager.getWorktreeForRepo(repoPath);
              const existing = existingWorktrees.find(
                (w) => w.commitSha === selectedCommit.sha
              );

              if (existing) {
                await vscode.commands.executeCommand(
                  'vscode.openFolder',
                  vscode.Uri.file(existing.path),
                  { forceNewWindow: true }
                );
              }
            }
          } else {
            vscode.window.showErrorMessage(message);
          }
        } else {
          vscode.window.showErrorMessage(
            `Failed to create worktree: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    }
  );
}
