# CommitView

Open any commit in a fully functional VS Code window. Uses git worktrees under the hood, no stashing, no branch switching.

Use this if you are searching for a way to easily test large changes without having to stash and compare at different times. This allows for two different windows, one with the chosen commit and one with your current changes.

Your `.env` files and `node_modules` are automatically **symlinked** (not copied) — credentials stay in sync and dependencies don't take up extra disk space.

## Usage

1. Open the CommitView sidebar (git-compare icon in activity bar)
2. Click any commit to open it in a new window
3. Browse, search, and use all IDE features at that point in history

## Commands

| Command | Keybinding | Description |
|---------|------------|-------------|
| View Commit in New Window | `Cmd+Shift+V` | Pick a commit and open it |
| Switch to Partner Window | `Cmd+Ctrl+S` | Jump between main and commit windows |
| Show Diff Summary | `Cmd+Shift+D` | See what changed vs current |
| Close and Cleanup Worktree | — | Close window and delete worktree |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `maxCommitHistory` | 50 | Commits shown in sidebar |
| `autoCleanupOnClose` | true | Delete worktree when window closes |
| `filesToLink` | `.env`, `.env.*`, `.npmrc`, `.yarnrc`, `.nvmrc` | Files symlinked to worktree |
| `directoriesToLink` | `node_modules`, `venv`, `.venv`, `env`, `__pycache__` | Directories symlinked to worktree |
| `additionalPatternsToLink` | `[]` | Extra patterns to symlink |

## How It Works

CommitView creates a temporary git worktree for the selected commit, then opens it in a new VS Code window. Configuration files and dependencies are symlinked from your main workspace, so credentials stay in sync and you don't duplicate large folders. When you close the window, the worktree is automatically cleaned up.

## Requirements

- Git 2.5+ (worktree support)
