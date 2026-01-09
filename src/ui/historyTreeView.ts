import * as vscode from 'vscode';
import { CommitInfo } from '../types';
import { JJManager } from '../core/jjManager';
import { logger } from '../utils/logger';
import { CommitTreeItem, LoadMoreTreeItem } from './treeItems';

export class HistoryTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private commits: CommitInfo[] = [];
  private currentOffset = 0;
  private readonly pageSize = 20;
  private hasMore = true;

  constructor(private jjManager: JJManager) {}

  refresh(): void {
    logger.debug('Refreshing history tree view');
    this._onDidChangeTreeData.fire();
  }

  async reset(): Promise<void> {
    this.commits = [];
    this.currentOffset = 0;
    this.hasMore = true;
    await this.loadMore();
  }

  async loadMore(): Promise<void> {
    try {
      const newCommits = await this.jjManager.getCommitHistory(this.pageSize, this.currentOffset);

      // 変更ファイルを読み込み
      for (const commit of newCommits) {
        commit.changedFiles = await this.jjManager.getChangedFiles(commit.commitId);
      }

      this.commits.push(...newCommits);
      this.currentOffset += newCommits.length;
      this.hasMore = newCommits.length === this.pageSize;

      logger.info(`Loaded ${newCommits.length} commits, total: ${this.commits.length}`);
      this.refresh();
    } catch (error) {
      logger.error('Failed to load commit history', error as Error);
    }
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (!element) {
      const items: vscode.TreeItem[] = this.commits.map(c => new CommitTreeItem(c));
      if (this.hasMore) {
        items.push(new LoadMoreTreeItem());
      }
      return items;
    }
    return [];
  }
}
