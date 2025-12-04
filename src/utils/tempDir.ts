import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { randomUUID } from 'crypto';

export function getTempDir(): string {
  return os.tmpdir();
}

export function generateWorktreePath(repoName: string, shortSha: string): string {
  const uuid = randomUUID().substring(0, 8);
  const safeName = repoName.replace(/[^a-zA-Z0-9-_]/g, '-');
  return path.join(getTempDir(), `commitview-${safeName}-${shortSha}-${uuid}`);
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
  return basename.startsWith('commitview-');
}
