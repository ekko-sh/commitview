import simpleGit, { SimpleGit, SimpleGitOptions } from 'simple-git';
import * as path from 'path';
import { CommitViewError, ErrorCode } from '../utils/errors';

export class GitService {
  private getGit(cwd: string): SimpleGit {
    const options: Partial<SimpleGitOptions> = {
      baseDir: cwd,
      binary: 'git',
      maxConcurrentProcesses: 6,
      trimmed: true,
    };
    return simpleGit(options);
  }

  async isGitRepository(workspacePath: string): Promise<boolean> {
    try {
      const git = this.getGit(workspacePath);
      return await git.checkIsRepo();
    } catch {
      return false;
    }
  }

  async getRepoRoot(workspacePath: string): Promise<string> {
    const git = this.getGit(workspacePath);
    const root = await git.revparse(['--show-toplevel']);
    return root.trim();
  }

  async getRepoName(workspacePath: string): Promise<string> {
    const root = await this.getRepoRoot(workspacePath);
    return path.basename(root);
  }

  async isDirty(repoPath: string): Promise<boolean> {
    const git = this.getGit(repoPath);
    const status = await git.status();
    return !status.isClean();
  }

  async getCurrentBranch(repoPath: string): Promise<string> {
    const git = this.getGit(repoPath);
    const branch = await git.revparse(['--abbrev-ref', 'HEAD']);
    return branch.trim();
  }

  async getCurrentCommitSha(repoPath: string): Promise<string> {
    const git = this.getGit(repoPath);
    const sha = await git.revparse(['HEAD']);
    return sha.trim();
  }

  async commitExists(repoPath: string, sha: string): Promise<boolean> {
    try {
      const git = this.getGit(repoPath);
      await git.revparse(['--verify', `${sha}^{commit}`]);
      return true;
    } catch {
      return false;
    }
  }

  async createWorktree(repoPath: string, worktreePath: string, commitSha: string): Promise<void> {
    const git = this.getGit(repoPath);

    if (!(await this.commitExists(repoPath, commitSha))) {
      throw new CommitViewError(
        `Commit ${commitSha} not found`,
        ErrorCode.COMMIT_NOT_FOUND
      );
    }

    try {
      await git.raw(['worktree', 'add', '--detach', worktreePath, commitSha]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('already exists')) {
        throw new CommitViewError(
          'Worktree already exists',
          ErrorCode.WORKTREE_ALREADY_EXISTS,
          true,
          error instanceof Error ? error : undefined
        );
      }
      throw new CommitViewError(
        `Failed to create worktree: ${message}`,
        ErrorCode.WORKTREE_CREATION_FAILED,
        true,
        error instanceof Error ? error : undefined
      );
    }
  }

  async removeWorktree(repoPath: string, worktreePath: string, force: boolean = false): Promise<void> {
    const git = this.getGit(repoPath);
    try {
      const args = ['worktree', 'remove'];
      if (force) {
        args.push('--force');
      }
      args.push(worktreePath);
      await git.raw(args);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('locked')) {
        throw new CommitViewError(
          'Worktree is locked',
          ErrorCode.WORKTREE_LOCKED,
          true,
          error instanceof Error ? error : undefined
        );
      }
      throw new CommitViewError(
        `Failed to remove worktree: ${message}`,
        ErrorCode.WORKTREE_REMOVAL_FAILED,
        true,
        error instanceof Error ? error : undefined
      );
    }
  }

  async pruneWorktrees(repoPath: string): Promise<void> {
    const git = this.getGit(repoPath);
    await git.raw(['worktree', 'prune']);
  }

  async listWorktrees(repoPath: string): Promise<{ path: string; sha: string; branch: string | null }[]> {
    const git = this.getGit(repoPath);
    const output = await git.raw(['worktree', 'list', '--porcelain']);

    const worktrees: { path: string; sha: string; branch: string | null }[] = [];
    let current: { path?: string; sha?: string; branch: string | null } = { branch: null };

    for (const line of output.split('\n')) {
      if (line.startsWith('worktree ')) {
        if (current.path && current.sha) {
          worktrees.push({ path: current.path, sha: current.sha, branch: current.branch });
        }
        current = { path: line.substring(9), branch: null };
      } else if (line.startsWith('HEAD ')) {
        current.sha = line.substring(5);
      } else if (line.startsWith('branch ')) {
        current.branch = line.substring(7);
      } else if (line === 'detached') {
        current.branch = null;
      }
    }

    if (current.path && current.sha) {
      worktrees.push({ path: current.path, sha: current.sha, branch: current.branch });
    }

    return worktrees;
  }

  async stash(repoPath: string, message?: string): Promise<void> {
    const git = this.getGit(repoPath);
    const args = ['stash', 'push'];
    if (message) {
      args.push('-m', message);
    }
    await git.raw(args);
  }

  async getGitVersion(): Promise<string> {
    const git = simpleGit();
    const versionOutput = await git.version();
    return versionOutput.installed ? `${versionOutput.major}.${versionOutput.minor}.${versionOutput.patch}` : '0.0.0';
  }

  async validateGitVersion(): Promise<void> {
    const git = simpleGit();
    const version = await git.version();

    if (!version.installed) {
      throw new CommitViewError(
        'Git is not installed',
        ErrorCode.GIT_NOT_INSTALLED,
        false
      );
    }

    if (version.major < 2 || (version.major === 2 && version.minor < 15)) {
      throw new CommitViewError(
        `Git version ${version.major}.${version.minor} is too old. Version 2.15+ required.`,
        ErrorCode.GIT_VERSION_TOO_OLD,
        false
      );
    }
  }
}
