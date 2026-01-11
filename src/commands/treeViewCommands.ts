import * as vscode from 'vscode';
import { ConflictFile, CommitInfo } from '../types';
import { ConflictTreeDataProvider } from '../ui/conflictTreeView';
import { HistoryTreeDataProvider } from '../ui/historyTreeView';
import { JJManager } from '../core/jjManager';
import { logger } from '../utils/logger';
import { generateConflictResolutionPrompt, generateMultipleConflictPrompt } from '../utils/conflictPrompt';
import { localize } from '../utils/localize';

export async function openConflictFile(conflictFile: ConflictFile): Promise<void> {
  try {
    const uri = vscode.Uri.file(conflictFile.filePath);
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document);

    // 最初のコンフリクト箇所にジャンプ
    if (conflictFile.conflicts.length > 0) {
      const firstConflict = conflictFile.conflicts[0];
      const position = new vscode.Position(firstConflict.startLine - 1, 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
    }

    logger.info(`Opened conflict file: ${conflictFile.relativePath}`);
  } catch (error) {
    logger.error('Failed to open conflict file', error as Error);
    vscode.window.showErrorMessage(`JJJ: ${localize('notification.fileOpenFailed', 'Failed to open file')}`);
  }
}

export async function showCommitDetails(commit: CommitInfo): Promise<void> {
  try {
    const changedFilesText = commit.changedFiles.length > 0
      ? commit.changedFiles.map(f => `  • ${f}`).join('\n')
      : `  ${localize('tree.noChanges', '(No changes)')}`;

    const details = `
${localize('tree.commitDetails', 'Commit Details')}
────────────────────
${localize('tree.commitId', 'ID')}: ${commit.shortCommitId}
${localize('tree.author', 'Author')}: ${commit.author}
${localize('tree.timestamp', 'Time')}: ${commit.timestamp.toLocaleString()}
${localize('tree.message', 'Message')}: ${commit.description}

${localize('tree.changedFiles', 'Changed Files')}:
${changedFilesText}
    `.trim();

    const doc = await vscode.workspace.openTextDocument({
      content: details,
      language: 'plaintext'
    });
    await vscode.window.showTextDocument(doc, { preview: true });

    logger.info(`Showed commit details: ${commit.shortCommitId}`);
  } catch (error) {
    logger.error('Failed to show commit details', error as Error);
  }
}

export async function loadMoreHistory(historyProvider: HistoryTreeDataProvider): Promise<void> {
  try {
    await historyProvider.loadMore();
  } catch (error) {
    logger.error('Failed to load more history', error as Error);
    vscode.window.showErrorMessage(`JJJ: ${localize('notification.historyLoadFailed', 'Failed to load history')}`);
  }
}

export async function showFileHistory(jjManager: JJManager): Promise<void> {
  try {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage(`JJJ: ${localize('notification.openFileFirst', 'Please open a file')}`);
      return;
    }

    const filePath = editor.document.uri.fsPath;
    const workspacePath = jjManager.getWorkspacePath();
    const relativePath = filePath.replace(workspacePath + '/', '');

    const commits = await jjManager.getFileHistory(relativePath, 20);

    if (commits.length === 0) {
      vscode.window.showInformationMessage(`JJJ: ${localize('notification.noFileHistory', 'No history for this file')}`);
      return;
    }

    const items = commits.map(commit => ({
      label: `$(git-commit) ${commit.shortCommitId}`,
      description: commit.author,
      detail: `${commit.timestamp.toLocaleString()} - ${commit.description}`,
      commit
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: localize('tree.fileHistoryTitle', '{0} History', relativePath)
    });

    if (selected) {
      await showCommitDetails(selected.commit);
    }

    logger.info(`Showed file history for: ${relativePath}`);
  } catch (error) {
    logger.error('Failed to show file history', error as Error);
    vscode.window.showErrorMessage(`JJJ: ${localize('notification.fileHistoryFailed', 'Failed to retrieve file history')}`);
  }
}

export async function refreshConflicts(conflictProvider: ConflictTreeDataProvider): Promise<void> {
  try {
    await conflictProvider.updateConflicts();
  } catch (error) {
    logger.error('Failed to refresh conflicts', error as Error);
    vscode.window.showErrorMessage(`JJJ: ${localize('notification.conflictRefreshFailed', 'Failed to refresh conflicts')}`);
  }
}

export async function refreshHistory(historyProvider: HistoryTreeDataProvider): Promise<void> {
  try {
    await historyProvider.reset();
  } catch (error) {
    logger.error('Failed to refresh history', error as Error);
    vscode.window.showErrorMessage(`JJJ: ${localize('notification.historyRefreshFailed', 'Failed to refresh history')}`);
  }
}

/**
 * コンフリクト解消プロンプトをクリップボードにコピー
 */
export async function copyConflictPrompt(conflictFile: ConflictFile): Promise<void> {
  try {
    const prompt = generateConflictResolutionPrompt(conflictFile);

    // クリップボードにコピー
    await vscode.env.clipboard.writeText(prompt);

    // 成功通知
    vscode.window.showInformationMessage(
      `JJJ: ${localize('notification.promptCopied', 'Prompt copied ({0})', conflictFile.relativePath)}`
    );

    logger.info(`Copied conflict resolution prompt for: ${conflictFile.relativePath}`);
  } catch (error) {
    logger.error('Failed to copy conflict prompt', error as Error);
    vscode.window.showErrorMessage(`JJJ: ${localize('notification.promptCopyFailed', 'Failed to copy prompt')}`);
  }
}

/**
 * 全コンフリクトのプロンプトをコピー
 */
export async function copyAllConflictsPrompt(conflictProvider: ConflictTreeDataProvider): Promise<void> {
  try {
    const conflictCount = conflictProvider.getConflictCount();

    if (conflictCount === 0) {
      vscode.window.showInformationMessage(`JJJ: ${localize('notification.noConflicts', 'No conflicts')}`);
      return;
    }

    // ConflictTreeDataProviderからconflictFilesを取得
    const conflictFiles = conflictProvider.getConflictFiles();
    const prompt = generateMultipleConflictPrompt(conflictFiles);

    await vscode.env.clipboard.writeText(prompt);

    vscode.window.showInformationMessage(
      `JJJ: ${localize('notification.allPromptsCopied', 'All conflicts prompt copied ({0} conflicts)', conflictCount.toString())}`
    );

    logger.info(`Copied prompt for all ${conflictCount} conflicts`);
  } catch (error) {
    logger.error('Failed to copy all conflicts prompt', error as Error);
    vscode.window.showErrorMessage(`JJJ: ${localize('notification.promptCopyFailed', 'Failed to copy prompt')}`);
  }
}

/**
 * TreeViewコマンドを登録
 */
export function registerTreeViewCommands(
  context: vscode.ExtensionContext,
  conflictProvider: ConflictTreeDataProvider,
  historyProvider: HistoryTreeDataProvider,
  jjManager: JJManager
): void {
  logger.info('Registering tree view commands');

  context.subscriptions.push(
    vscode.commands.registerCommand('jjj.openConflictFile', openConflictFile),
    vscode.commands.registerCommand('jjj.showCommitDetails', showCommitDetails),
    vscode.commands.registerCommand('jjj.loadMoreHistory', () => loadMoreHistory(historyProvider)),
    vscode.commands.registerCommand('jjj.showFileHistory', () => showFileHistory(jjManager)),
    vscode.commands.registerCommand('jjj.refreshConflicts', () => refreshConflicts(conflictProvider)),
    vscode.commands.registerCommand('jjj.refreshHistory', () => refreshHistory(historyProvider)),
    vscode.commands.registerCommand('jjj.copyConflictPrompt', copyConflictPrompt),
    vscode.commands.registerCommand('jjj.copyAllConflictsPrompt', () =>
      copyAllConflictsPrompt(conflictProvider)
    )
  );

  logger.info('Tree view commands registered successfully');
}
