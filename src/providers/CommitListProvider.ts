import * as vscode from 'vscode';
import { Commit, CommitService } from '../services/CommitService';
import { GitService } from '../services/GitService';

export class CommitListProvider implements vscode.TreeDataProvider<CommitTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<CommitTreeItem | undefined | null | void> =
    new vscode.EventEmitter<CommitTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<CommitTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private commits: Commit[] = [];
  private repoPath: string | undefined;

  constructor(
    private commitService: CommitService,
    private gitService: GitService
  ) {}

  async initialize(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return;
    }

    this.repoPath = workspaceFolder.uri.fsPath;

    if (!(await this.gitService.isGitRepository(this.repoPath))) {
      return;
    }

    await this.refresh();
  }

  async refresh(): Promise<void> {
    if (!this.repoPath) {
      return;
    }

    try {
      const config = vscode.workspace.getConfiguration('commitview');
      const maxCommits = config.get<number>('maxCommitHistory', 50);
      this.commits = await this.commitService.getRecentCommits(this.repoPath, maxCommits);
    } catch (error) {
      console.error('Failed to fetch commits:', error);
      this.commits = [];
    }

    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: CommitTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: CommitTreeItem): Thenable<CommitTreeItem[]> {
    if (element) {
      return Promise.resolve([]);
    }

    return Promise.resolve(
      this.commits.map((commit) => new CommitTreeItem(commit))
    );
  }

  getCommitBySha(sha: string): Commit | undefined {
    return this.commits.find((c) => c.sha === sha);
  }
}

export class CommitTreeItem extends vscode.TreeItem {
  constructor(public readonly commit: Commit) {
    super(commit.subject, vscode.TreeItemCollapsibleState.None);

    this.id = commit.sha;
    this.description = `${commit.shortSha} • ${commit.relativeDate}`;
    this.tooltip = this.createTooltip();
    this.contextValue = 'commit';

    // Icon based on commit age
    this.iconPath = new vscode.ThemeIcon('git-commit');

    // Make the entire row clickable to view the commit
    this.command = {
      command: 'commitview.viewCommit',
      title: 'View Commit',
      arguments: [this],
    };
  }

  private createTooltip(): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**${this.commit.subject}**\n\n`);
    md.appendMarkdown(`$(git-commit) \`${this.commit.sha}\`\n\n`);
    md.appendMarkdown(`$(person) ${this.commit.author}\n\n`);
    md.appendMarkdown(`$(calendar) ${this.commit.relativeDate}\n\n`);

    if (this.commit.message !== this.commit.subject) {
      md.appendMarkdown(`---\n\n${this.commit.message}`);
    }

    md.appendMarkdown(`\n\n*Click to view this commit in a new window*`);
    return md;
  }
}
