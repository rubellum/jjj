import * as vscode from 'vscode';
import { SyncEngine } from './core/syncEngine';
import { StatusBarManager } from './ui/statusBar';
import { NotificationManager } from './ui/notifications';
import { FileWatcher } from './services/fileWatcher';
import { AutoCommitService } from './services/autoCommit';
import { AutoPullService } from './services/autoPull';
import { registerCommands } from './commands';
import { logger } from './utils/logger';
import { ConflictTreeDataProvider } from './ui/conflictTreeView';
import { HistoryTreeDataProvider } from './ui/historyTreeView';
import { registerTreeViewCommands } from './commands/treeViewCommands';
import { localize } from './utils/localize';

let syncEngine: SyncEngine;
let statusBar: StatusBarManager;
let notifications: NotificationManager;
let fileWatcher: FileWatcher;
let autoCommitService: AutoCommitService;
let autoPullService: AutoPullService;
let conflictTreeProvider: ConflictTreeDataProvider;
let historyTreeProvider: HistoryTreeDataProvider;

/**
 * 拡張機能のアクティベーション
 */
export async function activate(context: vscode.ExtensionContext) {
  logger.info('Jujutsu Journaling extension is activating');

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
      statusBar.setState('notApplicable');
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

    // TreeViewプロバイダーを初期化
    conflictTreeProvider = new ConflictTreeDataProvider(
      jjManager,
      conflictDetector,
      workspacePath
    );

    historyTreeProvider = new HistoryTreeDataProvider(jjManager);

    // TreeViewを登録
    const conflictTreeView = vscode.window.createTreeView('jjj.conflictView', {
      treeDataProvider: conflictTreeProvider,
      showCollapseAll: false
    });

    const historyTreeView = vscode.window.createTreeView('jjj.historyView', {
      treeDataProvider: historyTreeProvider,
      showCollapseAll: false
    });

    // コンテキスト変数を設定
    vscode.commands.executeCommand('setContext', 'jjj.active', true);

    // TreeViewコマンドを登録
    registerTreeViewCommands(context, conflictTreeProvider, historyTreeProvider, jjManager);

    // 初期データを読み込み
    await conflictTreeProvider.updateConflicts();
    await historyTreeProvider.reset();

    // コンフリクトの有無をコンテキスト変数に設定
    const hasConflicts = conflictTreeProvider.getConflictCount() > 0;
    vscode.commands.executeCommand('setContext', 'jjj.hasConflicts', hasConflicts);

    // コマンドを登録（UC-04）
    registerCommands(context, syncEngine);

    // クリーンアップを登録
    context.subscriptions.push(
      conflictTreeView,
      historyTreeView,
      {
        dispose: () => {
          logger.info('Disposing JJJ resources');
          syncEngine.dispose();
          statusBar.dispose();
          fileWatcher.dispose();
          autoCommitService.dispose();
          vscode.commands.executeCommand('setContext', 'jjj.active', false);
          logger.dispose();
        }
      }
    );

    logger.info('Jujutsu Journaling extension activated successfully');

  } catch (error) {
    logger.error('Failed to activate JJJ extension', error as Error);
    vscode.window.showErrorMessage(`JJJ: ${localize('notification.activationFailed', 'Failed to activate extension')}`);
  }
}

/**
 * 拡張機能の非アクティベーション
 */
export function deactivate() {
  logger.info('Jujutsu Journaling extension is deactivating');

  if (syncEngine) {
    syncEngine.stopAutoSync();
  }

  logger.info('Jujutsu Journaling extension deactivated');
}
