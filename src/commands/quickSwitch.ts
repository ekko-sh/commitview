import * as vscode from 'vscode';
import * as fs from 'fs';
import { WindowTracker } from '../ipc/WindowTracker';

export async function quickSwitchCommand(windowTracker: WindowTracker): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

  if (!workspaceFolder) {
    vscode.window.showWarningMessage('No workspace folder open.');
    return;
  }

  const currentPath = workspaceFolder.uri.fsPath;
  const partnerPath = windowTracker.getPartnerWindow(currentPath);

  if (!partnerPath) {
    vscode.window.showInformationMessage(
      'No paired window found. Use "CommitView: View Commit in New Window" to create one.'
    );
    return;
  }

  // Check if partner directory exists
  if (!fs.existsSync(partnerPath)) {
    vscode.window.showWarningMessage(
      'Partner window workspace no longer exists. It may have been cleaned up.'
    );
    windowTracker.unregisterWindowPair(currentPath);
    return;
  }

  // Open partner folder - VS Code will focus existing window or open new one
  await vscode.commands.executeCommand(
    'vscode.openFolder',
    vscode.Uri.file(partnerPath),
    { forceNewWindow: true }
  );
}
