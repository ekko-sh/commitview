import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { randomUUID } from 'crypto';

export function getTempDir(): string {
  return os.tmpdir();
}

export function generateWorktreePath(repoName: string, shortSha: string, commitSubject?: string): string {
  const safeName = repoName.replace(/[^a-zA-Z0-9-_]/g, '-').substring(0, 20);

  // Create a short, readable version of the commit message
  let shortMessage = '';
  if (commitSubject) {
    shortMessage = commitSubject
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s]/g, '')  // Remove special chars
      .trim()
      .split(/\s+/)                      // Split by whitespace
      .slice(0, 3)                       // Take first 3 words
      .join('-')
      .substring(0, 25);                 // Max 25 chars
  }

  // Format: temp-{repo}-{sha}-{message}
  const folderName = shortMessage
    ? `temp-${safeName}-${shortSha}-${shortMessage}`
    : `temp-${safeName}-${shortSha}`;

  return path.join(getTempDir(), folderName);
}

export function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function removeDirectory(dirPath: string): void {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

export function isCommitViewTempPath(dirPath: string): boolean {
  const basename = path.basename(dirPath);
  return basename.startsWith('temp-') || basename.startsWith('commitview-');
}
