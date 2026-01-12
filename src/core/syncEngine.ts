import * as vscode from 'vscode';
import { JJManager } from './jjManager';
import { TimerScheduler } from './timerScheduler';
import { ConflictDetector } from './conflictDetector';
import { StatusBarManager } from '../ui/statusBar';
import { NotificationManager } from '../ui/notifications';
import { SyncState, SyncConfig } from '../types';
import { logger } from '../utils/logger';
import { CONSTANTS } from '../utils/constants';
import { localize } from '../utils/localize';

export class SyncEngine {
  private jjManager?: JJManager;
  private scheduler: TimerScheduler;
  private conflictDetector: ConflictDetector;
  private statusBar: StatusBarManager;
  private notifications: NotificationManager;
  private workspacePath?: string;
  private syncLock = false;
  private autoPullCallback?: () => Promise<void>;

  constructor(
    statusBar: StatusBarManager,
    notifications: NotificationManager,
    conflictDetector?: ConflictDetector
  ) {
    this.scheduler = new TimerScheduler();
    this.conflictDetector = conflictDetector || new ConflictDetector();
    this.statusBar = statusBar;
    this.notifications = notifications;
  }

  /**
   * UC-01: Git管理フォルダの自動検出と同期開始
   */
  async initialize(workspacePath: string, jjManager?: JJManager): Promise<void> {
    try {
      logger.info(`Initializing DocSync for workspace: ${workspacePath}`);
      this.workspacePath = workspacePath;
      this.jjManager = jjManager || new JJManager(workspacePath);

      // Step 1: jjコマンドの存在確認
      const isJJAvailable = await this.jjManager.isJJAvailable();
      if (!isJJAvailable) {
        logger.error('jj command not found');
        this.statusBar.setState('notApplicable');
        this.notifications.jjNotFound();
        return;
      }

      // Step 2: .gitディレクトリの検出
      const hasGit = await this.jjManager.detectGitRepo();
      if (!hasGit) {
        logger.info('No Git repository detected');
        this.statusBar.setState('notApplicable');
        return;
      }

      // Step 3: jj初期化状態確認
      const isInitialized = await this.jjManager.isJJInitialized();
      if (!isInitialized) {
        logger.info('JJ not initialized, initializing...');
        await this.jjManager.initializeJJ();
      }

      // Step 4: リモート接続確認
      const hasRemote = await this.jjManager.checkRemoteConnection();
      if (!hasRemote) {
        logger.warn('No remote repository configured');
        this.statusBar.setState('localOnly');
        this.notifications.noRemote();
        // ローカルのみでも同期は継続（リモート操作をスキップ）
      } else {
        this.statusBar.setState('enabled');
      }

      // Step 5: 自動同期の状態を反映
      const config = this.getConfig();
      this.statusBar.setAutoSyncEnabled(config.autoSyncEnabled);

      // Step 6: 自動同期タイマー開始
      await this.startAutoSync();

      logger.info('DocSync initialization completed');
    } catch (error) {
      logger.error('Failed to initialize DocSync', error as Error);
      this.statusBar.setState('対象外');
      this.notifications.error('初期化に失敗しました');
    }
  }

  /**
   * 自動同期を開始
   */
  async startAutoSync(): Promise<void> {
    const config = this.getConfig();
    if (!config.autoSyncEnabled) {
      logger.info('Auto sync is disabled in config');
      this.statusBar.setAutoSyncEnabled(false);
      return;
    }

    logger.info('Starting auto sync');
    this.statusBar.setAutoSyncEnabled(true);

    // 自動プルタイマーを設定
    // （自動コミットはFileWatcher経由で動的に開始）
    if (this.autoPullCallback) {
      const minMs = config.syncIntervalMin * 1000;
      const maxMs = config.syncIntervalMax * 1000;
      this.scheduler.scheduleRandomInterval('auto-pull', this.autoPullCallback, minMs, maxMs);
    }
  }

  /**
   * 自動同期を停止
   */
  stopAutoSync(): void {
    logger.info('Stopping auto sync');
    this.scheduler.clearAll();
    this.statusBar.setAutoSyncEnabled(false);
  }

  /**
   * フル同期を実行（UC-04用）
   */
  async performFullSync(): Promise<void> {
    if (!this.jjManager) {
      logger.warn('JJManager not initialized');
      return;
    }

    await this.acquireLock();

    try {
      // Step 0: 変更があるかチェック
      const hasChanges = await this.jjManager.hasUncommittedChanges();

      if (!hasChanges) {
        // 変更がない場合はコミット・プッシュをスキップ
        logger.info('No uncommitted changes found. Skipping manual sync');
        this.statusBar.showTemporary(localize('status.noChanges', 'No Changes'), CONSTANTS.STATUS_DISPLAY_DURATION);
        return;
      }

      this.statusBar.setState('syncing');

      // Step 1: コミット
      const message = this.generateCommitMessage();
      await this.jjManager.commit(message);

      // Step 2: リモートから取得
      await this.jjManager.fetch();

      const hasRemoteChanges = await this.jjManager.hasRemoteChanges();
      if (hasRemoteChanges) {
        await this.jjManager.merge();
      }

      // Step 3: プッシュ
      await this.jjManager.push();

      this.statusBar.showTemporary(localize('status.syncComplete', 'Sync Complete'), CONSTANTS.STATUS_DISPLAY_DURATION);
      this.notifications.syncComplete();

    } catch (error: any) {
      logger.error('Full sync failed', error);
      this.handleSyncError(error);
    } finally {
      this.releaseLock();
      this.statusBar.setState('enabled');
    }
  }

  /**
   * 同期エラーをハンドリング
   */
  private handleSyncError(error: any): void {
    if (error.type === 'NETWORK_ERROR') {
      this.statusBar.setState('offline');
      this.notifications.networkError();
    } else if (error.type === 'CONFLICT') {
      this.statusBar.setState('syncCompleteWithConflicts');
    } else if (error.type === 'AUTH_ERROR') {
      this.notifications.authError();
    } else {
      this.notifications.error('同期に失敗しました');
    }
  }

  /**
   * 自動プルコールバックを設定
   */
  setAutoPullCallback(callback: () => Promise<void>): void {
    this.autoPullCallback = callback;
  }

  /**
   * タイマーを一時停止
   */
  pauseTimers(): void {
    this.scheduler.pause();
  }

  /**
   * タイマーを再開
   */
  resumeTimers(): void {
    this.scheduler.resume();
  }

  /**
   * 同期状態を取得
   */
  getSyncState(): SyncState {
    return this.statusBar.getState();
  }

  /**
   * TimerSchedulerを取得
   */
  getScheduler(): TimerScheduler {
    return this.scheduler;
  }

  /**
   * JJManagerを取得
   */
  getJJManager(): JJManager | undefined {
    return this.jjManager;
  }

  /**
   * ConflictDetectorを取得
   */
  getConflictDetector(): ConflictDetector {
    return this.conflictDetector;
  }

  /**
   * ロックを取得
   */
  private async acquireLock(): Promise<void> {
    while (this.syncLock) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    this.syncLock = true;
  }

  /**
   * ロックを解放
   */
  private releaseLock(): void {
    this.syncLock = false;
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
   * 設定を取得
   */
  private getConfig(): SyncConfig {
    const config = vscode.workspace.getConfiguration(CONSTANTS.EXTENSION_ID);
    return {
      autoSyncEnabled: config.get<boolean>('autoSyncEnabled', true),
      syncIntervalMin: config.get<number>('syncIntervalMin', 30),
      syncIntervalMax: config.get<number>('syncIntervalMax', 90)
    };
  }

  /**
   * リソースをクリーンアップ
   */
  dispose(): void {
    this.stopAutoSync();
  }
}
