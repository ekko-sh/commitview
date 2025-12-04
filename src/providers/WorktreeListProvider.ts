import * as vscode from 'vscode';
import * as fs from 'fs';
import { WorktreeManager, WorktreeInfo } from '../services/WorktreeManager';

export class WorktreeListProvider implements vscode.TreeDataProvider<WorktreeTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<WorktreeTreeItem | undefined | null | void> =
    new vscode.EventEmitter<WorktreeTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<WorktreeTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  constructor(private worktreeManager: WorktreeManager) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: WorktreeTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: WorktreeTreeItem): Promise<WorktreeTreeItem[]> {
    if (element) {
      return [];
    }

    const worktrees = this.worktreeManager.getTrackedWorktrees();

    // Filter out worktrees that no longer exist
    const validWorktrees: WorktreeInfo[] = [];
    for (const worktree of worktrees) {
      if (fs.existsSync(worktree.path)) {
        validWorktrees.push(worktree);
      }
    }

    return validWorktrees.map((worktree) => new WorktreeTreeItem(worktree));
  }
}

export class WorktreeTreeItem extends vscode.TreeItem {
  constructor(public readonly worktree: WorktreeInfo) {
    super(worktree.commitMessage, vscode.TreeItemCollapsibleState.None);

    this.id = worktree.id;
    this.description = worktree.commitSha.substring(0, 7);
    this.tooltip = this.createTooltip();
    this.contextValue = 'worktree';
    this.iconPath = new vscode.ThemeIcon('window', new vscode.ThemeColor('charts.green'));

    // Click to switch to this worktree
    this.command = {
      command: 'vscode.openFolder',
      title: 'Open Worktree',
      arguments: [vscode.Uri.file(worktree.path), { forceNewWindow: true }],
    };
  }

  private createTooltip(): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**${this.worktree.commitMessage}**\n\n`);
    md.appendMarkdown(`$(git-commit) \`${this.worktree.commitSha.substring(0, 7)}\`\n\n`);
    md.appendMarkdown(`$(folder) ${this.worktree.path}\n\n`);
    md.appendMarkdown(`*Click to open this worktree*`);
    return md;
  }
}
