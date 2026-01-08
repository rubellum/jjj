import * as vscode from 'vscode';
import { SyncEngine } from './core/syncEngine';
import { StatusBarManager } from './ui/statusBar';
import { NotificationManager } from './ui/notifications';
import { FileWatcher } from './services/fileWatcher';
import { AutoCommitService } from './services/autoCommit';
import { AutoPullService } from './services/autoPull';
import { registerCommands } from './commands';
import { logger } from './utils/logger';

let syncEngine: SyncEngine;
let statusBar: StatusBarManager;
let notifications: NotificationManager;
let fileWatcher: FileWatcher;
let autoCommitService: AutoCommitService;
let autoPullService: AutoPullService;

/**
 * 拡張機能のアクティベーション
 */
export async function activate(context: vscode.ExtensionContext) {
  logger.info('DocSync extension is activating');

  try {
    // UI管理を初期化
    statusBar = new StatusBarManager();
    notifications = new NotificationManager();

    // SyncEngineを初期化
    syncEngine = new SyncEngine(statusBar, notifications);

    // ワークスペースがある場合のみ初期化
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      logger.info('No workspace folder found, extension inactive');
      statusBar.setState('対象外');
      return;
    }

    const workspacePath = workspaceFolders[0].uri.fsPath;
    logger.info(`Workspace path: ${workspacePath}`);

    // SyncEngineを初期化（UC-01）
    await syncEngine.initialize(workspacePath);

    const jjManager = syncEngine.getJJManager();
    if (!jjManager) {
      logger.warn('JJManager not initialized, extension inactive');
      return;
    }

    // サービスを初期化
    const scheduler = syncEngine.getScheduler();
    const conflictDetector = syncEngine.getConflictDetector();

    // AutoPullServiceを初期化
    autoPullService = new AutoPullService(
      jjManager,
      conflictDetector,
      statusBar,
      notifications
    );

    // AutoCommitServiceを初期化
    autoCommitService = new AutoCommitService(
      jjManager,
      scheduler,
      conflictDetector,
      statusBar,
      notifications,
      autoPullService
    );

    // FileWatcherを初期化（UC-02）
    fileWatcher = new FileWatcher();
    fileWatcher.startWatching((file) => {
      autoCommitService.queueChange(file);
    });

    // AutoPullコールバックを設定（UC-03）
    syncEngine.setAutoPullCallback(() => autoPullService.pull());

    // コマンドを登録（UC-04）
    registerCommands(context, syncEngine);

    // クリーンアップを登録
    context.subscriptions.push({
      dispose: () => {
        logger.info('Disposing DocSync resources');
        syncEngine.dispose();
        statusBar.dispose();
        fileWatcher.dispose();
        autoCommitService.dispose();
        logger.dispose();
      }
    });

    logger.info('DocSync extension activated successfully');

  } catch (error) {
    logger.error('Failed to activate DocSync extension', error as Error);
    vscode.window.showErrorMessage('DocSync: 拡張機能の起動に失敗しました');
  }
}

/**
 * 拡張機能の非アクティベーション
 */
export function deactivate() {
  logger.info('DocSync extension is deactivating');

  if (syncEngine) {
    syncEngine.stopAutoSync();
  }

  logger.info('DocSync extension deactivated');
}
