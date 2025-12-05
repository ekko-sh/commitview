import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface FileCopyResult {
  linked: string[];
  skipped: string[];
  failed: string[];
  warnings: string[];
}

type EntryType = 'file' | 'directory';

export class FileCopyService {
  async linkConfigFiles(sourceDir: string, targetDir: string): Promise<FileCopyResult> {
    const config = vscode.workspace.getConfiguration('commitview');

    const filePatterns = config.get<string[]>('filesToLink', [
      '.env', '.env.*', '.npmrc', '.yarnrc', '.nvmrc',
    ]);
    const directoryPatterns = config.get<string[]>('directoriesToLink', [
      'node_modules', 'venv', '.venv', 'env', '__pycache__',
    ]);
    const additionalPatterns = config.get<string[]>('additionalPatternsToLink', []);

    const result: FileCopyResult = { linked: [], skipped: [], failed: [], warnings: [] };

    // Find directories to link (root level only)
    const dirs = this.findMatchingEntries(sourceDir, directoryPatterns, 'directory');

    // Find files recursively, but skip directories that will be symlinked
    const skipDirs = new Set(dirs);
    const files = this.findMatchingFilesRecursive(
      sourceDir,
      [...filePatterns, ...additionalPatterns],
      skipDirs
    );

    for (const file of files) {
      this.linkEntry(sourceDir, targetDir, file, 'file', result);
    }

    for (const dir of dirs) {
      this.linkEntry(sourceDir, targetDir, dir, 'directory', result);
    }

    return result;
  }

  private linkEntry(
    sourceDir: string,
    targetDir: string,
    relativePath: string,
    type: EntryType,
    result: FileCopyResult
  ): void {
    const sourcePath = path.join(sourceDir, relativePath);
    const targetPath = path.join(targetDir, relativePath);
    const displayName = type === 'directory' ? `${relativePath}/` : relativePath;

    if (fs.existsSync(targetPath)) {
      result.skipped.push(displayName);
      return;
    }

    try {
      this.ensureParentDir(targetPath);
      fs.symlinkSync(sourcePath, targetPath, type === 'directory' ? 'dir' : undefined);
      result.linked.push(displayName);
    } catch (error) {
      result.failed.push(displayName);
      result.warnings.push(`Failed to link ${displayName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private ensureParentDir(targetPath: string): void {
    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
  }

  private findMatchingFilesRecursive(
    baseDir: string,
    patterns: string[],
    skipDirs: Set<string>,
    currentDir: string = ''
  ): string[] {
    const matches: string[] = [];
    const fullDir = currentDir ? path.join(baseDir, currentDir) : baseDir;

    try {
      const entries = fs.readdirSync(fullDir, { withFileTypes: true });

      for (const entry of entries) {
        const relativePath = currentDir ? path.join(currentDir, entry.name) : entry.name;

        if (entry.isFile() && patterns.some(p => this.matchesGlob(entry.name, p))) {
          matches.push(relativePath);
        } else if (entry.isDirectory() && !skipDirs.has(entry.name) && !entry.name.startsWith('.git')) {
          matches.push(...this.findMatchingFilesRecursive(baseDir, patterns, skipDirs, relativePath));
        }
      }
    } catch (error) {
      console.error(`Failed to read directory ${fullDir}:`, error);
    }

    return matches;
  }

  private findMatchingEntries(dir: string, patterns: string[], type: EntryType): string[] {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      return entries
        .filter(entry => (type === 'file' ? entry.isFile() : entry.isDirectory()))
        .filter(entry => patterns.some(p => this.matchesGlob(entry.name, p)))
        .map(entry => entry.name);
    } catch (error) {
      console.error(`Failed to read directory ${dir}:`, error);
      return [];
    }
  }

  private matchesGlob(filename: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${regexPattern}$`, 'i').test(filename);
  }
}
