import * as vscode from 'vscode';
import * as path from 'path';
import { DiffService, DiffFile } from '../services/DiffService';

export class DiffTreeProvider implements vscode.TreeDataProvider<DiffTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<DiffTreeItem | undefined | null | void> =
    new vscode.EventEmitter<DiffTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<DiffTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private diffFiles: DiffFile[] = [];
  private originalRepoPath: string = '';
  private worktreeCommitSha: string = '';
  private currentCommitSha: string = '';

  constructor(private diffService: DiffService) {}

  async initialize(
    originalRepoPath: string,
    worktreeCommitSha: string,
    currentCommitSha: string
  ): Promise<void> {
    this.originalRepoPath = originalRepoPath;
    this.worktreeCommitSha = worktreeCommitSha;
    this.currentCommitSha = currentCommitSha;

    await this.refresh();
  }

  async refresh(): Promise<void> {
    if (this.originalRepoPath && this.worktreeCommitSha && this.currentCommitSha) {
      try {
        this.diffFiles = await this.diffService.getChangedFiles(
          this.originalRepoPath,
          this.worktreeCommitSha,
          this.currentCommitSha
        );
      } catch {
        this.diffFiles = [];
      }
    }
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: DiffTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: DiffTreeItem): Thenable<DiffTreeItem[]> {
    if (element) {
      return Promise.resolve([]);
    }

    if (this.diffFiles.length === 0) {
      return Promise.resolve([]);
    }

    return Promise.resolve(
      this.diffFiles.map((file) => new DiffTreeItem(file, this.originalRepoPath))
    );
  }

  getStats(): { filesChanged: number; additions: number; deletions: number } {
    return {
      filesChanged: this.diffFiles.length,
      additions: this.diffFiles.reduce((sum, f) => sum + f.additions, 0),
      deletions: this.diffFiles.reduce((sum, f) => sum + f.deletions, 0),
    };
  }
}

class DiffTreeItem extends vscode.TreeItem {
  constructor(
    public readonly diffFile: DiffFile,
    public readonly repoPath: string
  ) {
    super(path.basename(diffFile.path), vscode.TreeItemCollapsibleState.None);

    this.description = this.getDescription();
    this.tooltip = this.getTooltip();
    this.iconPath = this.getIcon();
    this.contextValue = 'diffFile';

    // Command to open diff view
    this.command = {
      command: 'vscode.diff',
      title: 'Show Diff',
      arguments: [
        vscode.Uri.file(path.join(repoPath, diffFile.path)),
        vscode.Uri.file(path.join(repoPath, diffFile.path)),
        `${diffFile.path} (Changes)`,
      ],
    };
  }

  private getDescription(): string {
    const dirPath = path.dirname(this.diffFile.path);
    const stats = `+${this.diffFile.additions} -${this.diffFile.deletions}`;

    if (dirPath === '.') {
      return stats;
    }

    return `${dirPath} ${stats}`;
  }

  private getTooltip(): string {
    const lines = [
      `File: ${this.diffFile.path}`,
      `Status: ${this.diffFile.status}`,
      `Additions: +${this.diffFile.additions}`,
      `Deletions: -${this.diffFile.deletions}`,
    ];

    if (this.diffFile.oldPath) {
      lines.push(`Renamed from: ${this.diffFile.oldPath}`);
    }

    return lines.join('\n');
  }

  private getIcon(): vscode.ThemeIcon {
    switch (this.diffFile.status) {
      case 'added':
        return new vscode.ThemeIcon('diff-added', new vscode.ThemeColor('gitDecoration.addedResourceForeground'));
      case 'deleted':
        return new vscode.ThemeIcon('diff-removed', new vscode.ThemeColor('gitDecoration.deletedResourceForeground'));
      case 'renamed':
        return new vscode.ThemeIcon('diff-renamed', new vscode.ThemeColor('gitDecoration.renamedResourceForeground'));
      case 'modified':
      default:
        return new vscode.ThemeIcon('diff-modified', new vscode.ThemeColor('gitDecoration.modifiedResourceForeground'));
    }
  }
}
