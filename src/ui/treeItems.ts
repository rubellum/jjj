import * as vscode from 'vscode';
import { ConflictFile, CommitInfo } from '../types';

/**
 * コンフリクトファイルのTreeItem
 */
export class ConflictFileTreeItem extends vscode.TreeItem {
  constructor(public readonly conflictFile: ConflictFile) {
    super(conflictFile.relativePath, vscode.TreeItemCollapsibleState.None);

    this.tooltip = `${conflictFile.conflictCount}件のコンフリクト`;
    this.description = `(${conflictFile.conflictCount})`;
    this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground'));

    this.command = {
      command: 'jjj.openConflictFile',
      title: 'Open Conflict File',
      arguments: [conflictFile]
    };
  }

  contextValue = 'conflictFile';
}

/**
 * 情報表示用TreeItem
 */
export class ConflictInfoTreeItem extends vscode.TreeItem {
  constructor(label: string, description: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = description;
    this.iconPath = new vscode.ThemeIcon('info');
  }

  contextValue = 'conflictInfo';
}

/**
 * コミット履歴のTreeItem
 */
export class CommitTreeItem extends vscode.TreeItem {
  constructor(public readonly commit: CommitInfo) {
    super(
      formatCommitLabel(commit),
      vscode.TreeItemCollapsibleState.None
    );

    this.tooltip = formatCommitTooltip(commit);
    this.description = commit.author;
    this.iconPath = new vscode.ThemeIcon('git-commit');

    this.command = {
      command: 'jjj.showCommitDetails',
      title: 'Show Commit Details',
      arguments: [commit]
    };
  }

  contextValue = 'commit';
}

/**
 * "さらに読み込む"ボタン
 */
export class LoadMoreTreeItem extends vscode.TreeItem {
  constructor() {
    super('さらに読み込む', vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon('chevron-down');

    this.command = {
      command: 'jjj.loadMoreHistory',
      title: 'Load More History',
      arguments: []
    };
  }

  contextValue = 'loadMore';
}

// ヘルパー関数
function formatCommitLabel(commit: CommitInfo): string {
  const date = commit.timestamp.toLocaleString('ja-JP', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  });
  const shortDesc = commit.description.length > 50
    ? commit.description.substring(0, 50) + '...'
    : commit.description;
  return `${date} - ${shortDesc}`;
}

function formatCommitTooltip(commit: CommitInfo): string {
  const date = commit.timestamp.toLocaleString('ja-JP');
  const files = commit.changedFiles.length > 0
    ? '\n変更: ' + commit.changedFiles.join(', ')
    : '';
  return `作者: ${commit.author}\n日時: ${date}\nID: ${commit.shortCommitId}${files}`;
}
