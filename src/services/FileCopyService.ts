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

    const files = this.findMatchingEntries(sourceDir, [...filePatterns, ...additionalPatterns], 'file');
    const dirs = this.findMatchingEntries(sourceDir, directoryPatterns, 'directory');

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
    name: string,
    type: EntryType,
    result: FileCopyResult
  ): void {
    const sourcePath = path.join(sourceDir, name);
    const targetPath = path.join(targetDir, name);
    const displayName = type === 'directory' ? `${name}/` : name;

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
