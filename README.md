# CommitView

Open any commit in a fully functional VS Code window. Uses git worktrees under the hood, no stashing, no branch switching.

Use this if you are searching for a way to easily test large changes without having to stash and compare at different times. This allows for two different windows, one with the chosen commit and one with your current changes. Even your .env is copied if chosen so no need to move that!

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
| `filesToCopy` | `.env`, `.env.*`, `.npmrc`, `.yarnrc`, `.nvmrc` | Files copied to worktree |
| `warnOnSecretsCopy` | true | Warn before copying sensitive files |

## How It Works

CommitView creates a temporary git worktree for the selected commit, then opens it in a new VS Code window. When you close the window, the worktree is automatically cleaned up.

## Requirements

- Git 2.5+ (worktree support)
