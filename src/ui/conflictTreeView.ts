import * as vscode from 'vscode';
import * as path from 'path';
import { ConflictFile } from '../types';
import { ConflictDetector } from '../core/conflictDetector';
import { JJManager } from '../core/jjManager';
import { logger } from '../utils/logger';
import { ConflictFileTreeItem, ConflictInfoTreeItem } from './treeItems';

export class ConflictTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private conflictFiles: ConflictFile[] = [];

  constructor(
    private jjManager: JJManager,
    private conflictDetector: ConflictDetector,
    private workspacePath: string
  ) {}

  refresh(): void {
    logger.debug('Refreshing conflict tree view');
    this._onDidChangeTreeData.fire();
  }

  async updateConflicts(): Promise<void> {
    try {
      const conflictedFilePaths = await this.jjManager.getConflictedFiles();

      this.conflictFiles = [];
      for (const filePath of conflictedFilePaths) {
        const conflicts = await this.conflictDetector.detectConflictsInFile(filePath);
        if (conflicts.length > 0) {
          const relativePath = path.relative(this.workspacePath, filePath);
          this.conflictFiles.push({
            filePath,
            relativePath,
            conflictCount: conflicts.length,
            conflicts
          });
        }
      }

      logger.info(`Updated conflict list: ${this.conflictFiles.length} files`);
      this.refresh();
    } catch (error) {
      logger.error('Failed to update conflicts', error as Error);
    }
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (!element) {
      if (this.conflictFiles.length === 0) {
        return [new ConflictInfoTreeItem('コンフリクトはありません', '')];
      }
      return this.conflictFiles.map(cf => new ConflictFileTreeItem(cf));
    }
    return [];
  }

  getConflictCount(): number {
    return this.conflictFiles.length;
  }
}
