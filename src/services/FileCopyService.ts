import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface FileCopyResult {
  copied: string[];
  skipped: string[];
  failed: string[];
  warnings: string[];
}

export class FileCopyService {
  async copyConfigFiles(
    sourceDir: string,
    targetDir: string
  ): Promise<FileCopyResult> {
    const config = vscode.workspace.getConfiguration('commitview');
    const defaultPatterns = config.get<string[]>('filesToCopy', [
      '.env',
      '.env.*',
      '.npmrc',
      '.yarnrc',
      '.nvmrc',
    ]);
    const additionalPatterns = config.get<string[]>('additionalFilesToCopy', []);
    const warnOnSecrets = config.get<boolean>('warnOnSecretsCopy', true);
    const secretsPatterns = config.get<string[]>('secretsPatterns', [
      '*secret*',
      '*credential*',
      '*key*',
      '*token*',
      '*password*',
    ]);

    const allPatterns = [...defaultPatterns, ...additionalPatterns];

    const result: FileCopyResult = {
      copied: [],
      skipped: [],
      failed: [],
      warnings: [],
    };

    // Find all matching files
    const filesToCopy = await this.findMatchingFiles(sourceDir, allPatterns);

    if (filesToCopy.length === 0) {
      return result;
    }

    // Check for potential secrets
    const potentialSecrets: string[] = [];
    if (warnOnSecrets) {
      for (const file of filesToCopy) {
        if (this.matchesPatterns(file, secretsPatterns)) {
          potentialSecrets.push(file);
        }
      }
    }

    // Show warning if secrets detected
    if (potentialSecrets.length > 0) {
      const proceed = await this.showSecretsWarning(potentialSecrets);
      if (!proceed) {
        result.skipped.push(...filesToCopy);
        return result;
      }
    }

    // Copy files
    for (const file of filesToCopy) {
      const sourcePath = path.join(sourceDir, file);
      const targetPath = path.join(targetDir, file);

      try {
        // Ensure target directory exists
        const targetDirPath = path.dirname(targetPath);
        if (!fs.existsSync(targetDirPath)) {
          fs.mkdirSync(targetDirPath, { recursive: true });
        }

        fs.copyFileSync(sourcePath, targetPath);
        result.copied.push(file);

        if (potentialSecrets.includes(file)) {
          result.warnings.push(`Copied file that may contain secrets: ${file}`);
        }
      } catch (error) {
        result.failed.push(file);
      }
    }

    return result;
  }

  private async findMatchingFiles(
    dir: string,
    patterns: string[]
  ): Promise<string[]> {
    const matches: string[] = [];

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile()) {
          for (const pattern of patterns) {
            if (this.matchesGlob(entry.name, pattern)) {
              matches.push(entry.name);
              break;
            }
          }
        }
      }
    } catch {
      // Directory read failed
    }

    return matches;
  }

  private matchesGlob(filename: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(filename);
  }

  private matchesPatterns(filename: string, patterns: string[]): boolean {
    const lowerFilename = filename.toLowerCase();

    for (const pattern of patterns) {
      const lowerPattern = pattern.toLowerCase();

      // Handle glob patterns
      if (lowerPattern.includes('*')) {
        const parts = lowerPattern.split('*').filter(Boolean);
        let matches = true;

        for (const part of parts) {
          if (!lowerFilename.includes(part)) {
            matches = false;
            break;
          }
        }

        if (matches) {
          return true;
        }
      } else if (lowerFilename.includes(lowerPattern)) {
        return true;
      }
    }

    return false;
  }

  private async showSecretsWarning(files: string[]): Promise<boolean> {
    const fileList = files.slice(0, 5).join(', ');
    const moreCount = files.length > 5 ? ` and ${files.length - 5} more` : '';

    const message = `The following files may contain secrets and will be copied to the temporary worktree:\n\n${fileList}${moreCount}\n\nDo you want to proceed?`;

    const result = await vscode.window.showWarningMessage(
      message,
      { modal: true },
      'Copy Files',
      'Skip Files'
    );

    return result === 'Copy Files';
  }
}
