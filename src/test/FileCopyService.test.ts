import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock vscode module
vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((key: string, defaultValue: unknown) => defaultValue),
    })),
  },
}));

import { FileCopyService } from '../services/FileCopyService';

describe('FileCopyService', () => {
  let service: FileCopyService;
  let tempDir: string;
  let sourceDir: string;
  let targetDir: string;

  beforeEach(() => {
    service = new FileCopyService();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commitview-test-'));
    sourceDir = path.join(tempDir, 'source');
    targetDir = path.join(tempDir, 'target');
    fs.mkdirSync(sourceDir);
    fs.mkdirSync(targetDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('linkConfigFiles', () => {
    it('should link .env file from source to target', async () => {
      fs.writeFileSync(path.join(sourceDir, '.env'), 'SECRET=value');

      const result = await service.linkConfigFiles(sourceDir, targetDir);

      expect(result.linked).toContain('.env');
      expect(result.failed).toHaveLength(0);
      expect(fs.existsSync(path.join(targetDir, '.env'))).toBe(true);

      const stat = fs.lstatSync(path.join(targetDir, '.env'));
      expect(stat.isSymbolicLink()).toBe(true);
    });

    it('should link .env.local file', async () => {
      fs.writeFileSync(path.join(sourceDir, '.env.local'), 'LOCAL=value');

      const result = await service.linkConfigFiles(sourceDir, targetDir);

      expect(result.linked).toContain('.env.local');
    });

    it('should link node_modules directory', async () => {
      fs.mkdirSync(path.join(sourceDir, 'node_modules'));
      fs.writeFileSync(path.join(sourceDir, 'node_modules', 'test.js'), 'test');

      const result = await service.linkConfigFiles(sourceDir, targetDir);

      expect(result.linked).toContain('node_modules/');
      expect(fs.existsSync(path.join(targetDir, 'node_modules'))).toBe(true);

      const stat = fs.lstatSync(path.join(targetDir, 'node_modules'));
      expect(stat.isSymbolicLink()).toBe(true);
    });

    it('should link venv directory', async () => {
      fs.mkdirSync(path.join(sourceDir, 'venv'));

      const result = await service.linkConfigFiles(sourceDir, targetDir);

      expect(result.linked).toContain('venv/');
    });

    it('should link .venv directory', async () => {
      fs.mkdirSync(path.join(sourceDir, '.venv'));

      const result = await service.linkConfigFiles(sourceDir, targetDir);

      expect(result.linked).toContain('.venv/');
    });

    it('should skip if target already exists', async () => {
      fs.writeFileSync(path.join(sourceDir, '.env'), 'SECRET=value');
      fs.writeFileSync(path.join(targetDir, '.env'), 'EXISTING=value');

      const result = await service.linkConfigFiles(sourceDir, targetDir);

      expect(result.skipped).toContain('.env');
      expect(result.linked).not.toContain('.env');
    });

    it('should handle multiple files and directories', async () => {
      fs.writeFileSync(path.join(sourceDir, '.env'), 'SECRET=value');
      fs.writeFileSync(path.join(sourceDir, '.npmrc'), 'registry=...');
      fs.mkdirSync(path.join(sourceDir, 'node_modules'));

      const result = await service.linkConfigFiles(sourceDir, targetDir);

      expect(result.linked).toContain('.env');
      expect(result.linked).toContain('.npmrc');
      expect(result.linked).toContain('node_modules/');
      expect(result.linked).toHaveLength(3);
    });

    it('should not link unmatched files', async () => {
      fs.writeFileSync(path.join(sourceDir, 'package.json'), '{}');
      fs.writeFileSync(path.join(sourceDir, 'index.ts'), 'export {}');

      const result = await service.linkConfigFiles(sourceDir, targetDir);

      expect(result.linked).toHaveLength(0);
    });

    it('should return empty result for empty directory', async () => {
      const result = await service.linkConfigFiles(sourceDir, targetDir);

      expect(result.linked).toHaveLength(0);
      expect(result.skipped).toHaveLength(0);
      expect(result.failed).toHaveLength(0);
    });

    it('should handle non-existent source directory gracefully', async () => {
      const nonExistentDir = path.join(tempDir, 'non-existent');

      const result = await service.linkConfigFiles(nonExistentDir, targetDir);

      expect(result.linked).toHaveLength(0);
      expect(result.failed).toHaveLength(0);
    });

    it('symlinked content should match source content', async () => {
      const envContent = 'DATABASE_URL=postgres://localhost/db';
      fs.writeFileSync(path.join(sourceDir, '.env'), envContent);

      await service.linkConfigFiles(sourceDir, targetDir);

      const linkedContent = fs.readFileSync(path.join(targetDir, '.env'), 'utf-8');
      expect(linkedContent).toBe(envContent);
    });

    it('symlinked directory should contain source files', async () => {
      fs.mkdirSync(path.join(sourceDir, 'node_modules'));
      fs.writeFileSync(path.join(sourceDir, 'node_modules', 'package.json'), '{"name":"test"}');

      await service.linkConfigFiles(sourceDir, targetDir);

      const packageJson = fs.readFileSync(
        path.join(targetDir, 'node_modules', 'package.json'),
        'utf-8'
      );
      expect(packageJson).toBe('{"name":"test"}');
    });
  });
});
