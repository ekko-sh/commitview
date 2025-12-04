import * as vscode from 'vscode';
import { Commit } from '../services/CommitService';

interface CommitQuickPickItem extends vscode.QuickPickItem {
  commit: Commit;
}

export async function showCommitPicker(commits: Commit[]): Promise<Commit | undefined> {
  const items: CommitQuickPickItem[] = commits.map((commit) => ({
    label: `$(git-commit) ${commit.shortSha}`,
    description: commit.subject,
    detail: `${commit.author} • ${commit.relativeDate}`,
    commit,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select a commit to view in a new window',
    matchOnDescription: true,
    matchOnDetail: true,
  });

  return selected?.commit;
}

export async function showCommitPickerWithSearch(
  getCommits: (query?: string) => Promise<Commit[]>
): Promise<Commit | undefined> {
  const quickPick = vscode.window.createQuickPick<CommitQuickPickItem>();
  quickPick.placeholder = 'Search commits by message, or select from recent commits';
  quickPick.matchOnDescription = true;
  quickPick.matchOnDetail = true;

  // Load initial commits
  quickPick.busy = true;
  const initialCommits = await getCommits();
  quickPick.items = initialCommits.map((commit) => ({
    label: `$(git-commit) ${commit.shortSha}`,
    description: commit.subject,
    detail: `${commit.author} • ${commit.relativeDate}`,
    commit,
  }));
  quickPick.busy = false;

  return new Promise<Commit | undefined>((resolve) => {
    quickPick.onDidAccept(() => {
      const selected = quickPick.selectedItems[0];
      quickPick.hide();
      resolve(selected?.commit);
    });

    quickPick.onDidHide(() => {
      quickPick.dispose();
      resolve(undefined);
    });

    quickPick.show();
  });
}
