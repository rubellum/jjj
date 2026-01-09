import * as vscode from 'vscode';
import { JJManager } from '../core/jjManager';
import { ConflictDetector } from '../core/conflictDetector';
import { StatusBarManager } from '../ui/statusBar';
import { NotificationManager } from '../ui/notifications';
import { logger } from '../utils/logger';
import { isConflictError } from '../utils/errorHandler';
import { JJError } from '../types';

export class AutoPullService {
  constructor(
    private jjManager: JJManager,
    private conflictDetector: ConflictDetector,
    private statusBar: StatusBarManager,
    private notifications: NotificationManager
  ) {}

  /**
   * UC-03: リモートから変更を取得
   */
  async pull(): Promise<void> {
    try {
      logger.debug('Starting auto-pull');

      // Step 1: フェッチ
      await this.jjManager.fetch();

      // Step 2: リモート変更があるかチェック
      const hasChanges = await this.jjManager.hasRemoteChanges();
      if (!hasChanges) {
        logger.debug('No remote changes');
        return;
      }

      logger.info('Remote changes detected, merging');

      // Step 3: マージ
      await this.jjManager.merge();

      // コンフリクトビューを更新
      vscode.commands.executeCommand('jjj.refreshConflicts');

      this.statusBar.setState('有効');
      logger.info('Auto-pull completed successfully');

    } catch (error: any) {
      logger.error('Auto-pull failed', error);
      await this.handleError(error as JJError);
    }
  }

  /**
   * エラーハンドリング
   */
  private async handleError(error: JJError): Promise<void> {
    // コンフリクト発生時
    if (isConflictError(error)) {
      logger.warn('Conflict detected during auto-pull');

      // コンフリクトビューを更新
      vscode.commands.executeCommand('jjj.refreshConflicts');

      this.statusBar.setState('同期完了（コンフリクトあり）');
      // ConflictTreeProviderが自動更新されるため、通知は省略
      return;
    }

    // ネットワークエラー
    if (error.type === 'NETWORK_ERROR') {
      logger.warn('Network error during auto-pull');
      this.statusBar.setState('オフライン');
      return;
    }

    // その他のエラー
    logger.error('Unexpected error during auto-pull', error);
    this.statusBar.setState('オフライン');
  }
}
