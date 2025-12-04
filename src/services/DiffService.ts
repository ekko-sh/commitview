import simpleGit from 'simple-git';

export interface DiffFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied';
  additions: number;
  deletions: number;
  oldPath?: string;
}

export interface DiffStats {
  filesChanged: number;
  additions: number;
  deletions: number;
}

export class DiffService {
  async getChangedFiles(
    repoPath: string,
    fromSha: string,
    toSha: string
  ): Promise<DiffFile[]> {
    const git = simpleGit(repoPath);

    const diffSummary = await git.diffSummary([fromSha, toSha]);

    return diffSummary.files.map((file) => {
      let status: DiffFile['status'] = 'modified';

      if ('insertions' in file && 'deletions' in file) {
        const f = file as { file: string; insertions: number; deletions: number; changes: number };
        if (f.insertions > 0 && f.deletions === 0 && f.changes === f.insertions) {
          status = 'added';
        } else if (f.deletions > 0 && f.insertions === 0 && f.changes === f.deletions) {
          status = 'deleted';
        }
      }

      // Check for renames (file path contains ' => ')
      let filePath = file.file;
      let oldPath: string | undefined;

      if (filePath.includes(' => ')) {
        const parts = filePath.split(' => ');
        oldPath = parts[0].replace('{', '').replace('}', '');
        filePath = parts[1].replace('{', '').replace('}', '');
        status = 'renamed';
      }

      return {
        path: filePath,
        status,
        additions: 'insertions' in file ? (file as { insertions: number }).insertions : 0,
        deletions: 'deletions' in file ? (file as { deletions: number }).deletions : 0,
        oldPath,
      };
    });
  }

  async getDiffStats(
    repoPath: string,
    fromSha: string,
    toSha: string
  ): Promise<DiffStats> {
    const git = simpleGit(repoPath);

    const diffSummary = await git.diffSummary([fromSha, toSha]);

    return {
      filesChanged: diffSummary.changed,
      additions: diffSummary.insertions,
      deletions: diffSummary.deletions,
    };
  }

  async getFileDiff(
    repoPath: string,
    filePath: string,
    fromSha: string,
    toSha: string
  ): Promise<string> {
    const git = simpleGit(repoPath);

    const diff = await git.diff([fromSha, toSha, '--', filePath]);
    return diff;
  }
}
