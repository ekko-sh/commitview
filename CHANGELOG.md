# Changelog

## 0.1.2

- **Symlinks instead of copying** — `.env` files and directories like `node_modules`, `venv` are now symlinked
- Credentials stay in sync with your main workspace
- No extra disk space used for dependencies
- New settings: `filesToLink`, `directoriesToLink`, `additionalPatternsToLink`

## 0.1.1

- Added extension icon
- Minor cleanup

## 0.1.0

Initial release.

- View any commit in a new VS Code window
- Git worktree-based isolation
- Quick switch between main and commit windows
- Diff summary view
- Auto-cleanup on window close
- Copy environment files to worktree
