export enum ErrorCode {
  NOT_A_GIT_REPO = 'NOT_A_GIT_REPO',
  GIT_NOT_INSTALLED = 'GIT_NOT_INSTALLED',
  GIT_VERSION_TOO_OLD = 'GIT_VERSION_TOO_OLD',
  COMMIT_NOT_FOUND = 'COMMIT_NOT_FOUND',
  DIRTY_WORKING_DIRECTORY = 'DIRTY_WORKING_DIRECTORY',
  WORKTREE_ALREADY_EXISTS = 'WORKTREE_ALREADY_EXISTS',
  WORKTREE_CREATION_FAILED = 'WORKTREE_CREATION_FAILED',
  WORKTREE_LOCKED = 'WORKTREE_LOCKED',
  WORKTREE_REMOVAL_FAILED = 'WORKTREE_REMOVAL_FAILED',
  FILE_COPY_FAILED = 'FILE_COPY_FAILED',
  UNKNOWN = 'UNKNOWN',
}

export class CommitViewError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly recoverable: boolean = true,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'CommitViewError';
  }
}

export function getUserFriendlyMessage(code: ErrorCode): string {
  const messages: Record<ErrorCode, string> = {
    [ErrorCode.NOT_A_GIT_REPO]: 'This folder is not a Git repository.',
    [ErrorCode.GIT_NOT_INSTALLED]: 'Git is not installed or not found in PATH.',
    [ErrorCode.GIT_VERSION_TOO_OLD]: 'Git version 2.15 or higher is required.',
    [ErrorCode.COMMIT_NOT_FOUND]: 'The specified commit could not be found.',
    [ErrorCode.DIRTY_WORKING_DIRECTORY]: 'You have uncommitted changes.',
    [ErrorCode.WORKTREE_ALREADY_EXISTS]: 'A worktree for this commit already exists.',
    [ErrorCode.WORKTREE_CREATION_FAILED]: 'Failed to create worktree.',
    [ErrorCode.WORKTREE_LOCKED]: 'The worktree is locked by another process.',
    [ErrorCode.WORKTREE_REMOVAL_FAILED]: 'Failed to remove worktree.',
    [ErrorCode.FILE_COPY_FAILED]: 'Failed to copy configuration files.',
    [ErrorCode.UNKNOWN]: 'An unexpected error occurred.',
  };
  return messages[code] || messages[ErrorCode.UNKNOWN];
}
