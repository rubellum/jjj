import * as vscode from 'vscode';
import { JJManager } from '../core/jjManager';
import { TimerScheduler } from '../core/timerScheduler';
import { ConflictDetector } from '../core/conflictDetector';
import { StatusBarManager } from '../ui/statusBar';
import { NotificationManager } from '../ui/notifications';
import { logger } from '../utils/logger';
import { CONSTANTS } from '../utils/constants';
import { isNetworkError, isRemoteChangedError, isConflictError } from '../utils/errorHandler';
import { JJError } from '../types';

export class AutoCommitService {
  private changeQueue: Set<string> = new Set();
  private isProcessing = false;
  private retryCount = 0;

  constructor(
    private jjManager: JJManager,
    private scheduler: TimerScheduler,
    private conflictDetector: ConflictDetector,
    private statusBar: StatusBarManager,
    private notifications: NotificationManager,
    private autoPullService: any // circular dependency対策で型指定しない
  ) {}

  /**
   * UC-02: ファイル変更をキューに追加
   */
  queueChange(file: vscode.Uri): void {
    const filePath = file.fsPath;
    this.changeQueue.add(filePath);
    logger.debug(`File queued for commit: ${filePath} (queue size: ${this.changeQueue.size})`);

    // 初回追加時にタイマー開始
    if (this.changeQueue.size === 1 && !this.isProcessing) {
      const config = vscode.workspace.getConfiguration('docsync');
      const minMs = config.get<number>('syncIntervalMin', 30) * 1000;
      const maxMs = config.get<number>('syncIntervalMax', 90) * 1000;

      this.scheduler.scheduleOnce(
        'auto-commit',
        () => this.processQueue(),
        this.getRandomInterval(minMs, maxMs)
      );

      logger.info(`Auto-commit timer started (queue size: ${this.changeQueue.size})`);
    }
  }

  /**
   * キューを処理
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.changeQueue.size === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      this.statusBar.setState('同期中');

      // Step 1: コミット
      const message = this.generateCommitMessage();
      await this.jjManager.commit(message);
      logger.info(`Auto-committed changes (${this.changeQueue.size} files)`);

      // Step 2: プッシュ
      await this.jjManager.push();
      logger.info('Auto-pushed successfully');

      // 成功したらキューをクリア
      this.changeQueue.clear();
      this.retryCount = 0;

      this.statusBar.showTemporary('同期完了', CONSTANTS.STATUS_DISPLAY_DURATION);
      this.statusBar.setState('有効');

    } catch (error: any) {
      logger.error('Auto-commit/push failed', error);
      await this.handleError(error as JJError);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * エラーハンドリング
   */
  private async handleError(error: JJError): Promise<void> {
    // ネットワークエラー: リトライ
    if (isNetworkError(error)) {
      this.retryCount++;

      if (this.retryCount <= CONSTANTS.MAX_RETRY_COUNT) {
        logger.info(`Retrying auto-commit (${this.retryCount}/${CONSTANTS.MAX_RETRY_COUNT})`);
        this.notifications.networkError(this.retryCount);

        this.scheduler.scheduleOnce(
          'auto-commit-retry',
          () => this.processQueue(),
          CONSTANTS.RETRY_DELAY
        );
      } else {
        logger.error('Max retry count reached');
        this.notifications.networkError();
        this.statusBar.setState('オフライン');
        this.changeQueue.clear();
        this.retryCount = 0;
      }
      return;
    }

    // リモートに新しい変更: プル後に再プッシュ
    if (isRemoteChangedError(error)) {
      logger.info('Remote has new commits, pulling first');
      try {
        await this.autoPullService.pull();
        // プル後に再度プッシュを試行
        await this.jjManager.push();
        this.changeQueue.clear();
        this.retryCount = 0;
        this.statusBar.showTemporary('同期完了', CONSTANTS.STATUS_DISPLAY_DURATION);
        this.statusBar.setState('有効');
      } catch (pullError) {
        logger.error('Failed to pull and retry push', pullError as Error);
        this.statusBar.setState('オフライン');
      }
      return;
    }

    // コンフリクト: そのままコミット・プッシュ
    if (isConflictError(error)) {
      logger.warn('Conflict detected during auto-commit');
      try {
        // コンフリクト状態のままコミット
        const message = this.generateCommitMessage() + ` ${CONSTANTS.CONFLICT_SUFFIX}`;
        await this.jjManager.commit(message);
        await this.jjManager.push();

        this.changeQueue.clear();
        this.retryCount = 0;
        this.statusBar.setState('同期完了（コンフリクトあり）');
        this.notifications.conflictDetected(1); // TODO: 実際のコンフリクト数を取得
      } catch (conflictError) {
        logger.error('Failed to commit with conflict', conflictError as Error);
        this.statusBar.setState('オフライン');
      }
      return;
    }

    // その他のエラー
    this.notifications.error('自動同期に失敗しました');
    this.statusBar.setState('有効');
    this.changeQueue.clear();
    this.retryCount = 0;
  }

  /**
   * コミットメッセージを生成
   */
  private generateCommitMessage(): string {
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 16).replace('T', ' ');
    return `${CONSTANTS.AUTO_COMMIT_PREFIX} ${timestamp}`;
  }

  /**
   * ランダム間隔を生成
   */
  private getRandomInterval(minMs: number, maxMs: number): number {
    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  }

  /**
   * リソースをクリーンアップ
   */
  dispose(): void {
    this.scheduler.clearTimer('auto-commit');
    this.scheduler.clearTimer('auto-commit-retry');
    this.changeQueue.clear();
  }
}
