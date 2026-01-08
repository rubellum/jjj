import * as vscode from 'vscode';
import { SyncEngine } from '../core/syncEngine';
import { logger } from '../utils/logger';
import { CONSTANTS } from '../utils/constants';

/**
 * 自動同期のON/OFF切り替え
 */
export async function toggleAutoSync(syncEngine: SyncEngine): Promise<void> {
  try {
    const config = vscode.workspace.getConfiguration(CONSTANTS.EXTENSION_ID);
    const currentState = config.get<boolean>('autoSyncEnabled', false);

    if (currentState) {
      // 現在ON → OFFにする（即座に実行）
      logger.info('Disabling auto sync via toggle');
      await config.update('autoSyncEnabled', false, vscode.ConfigurationTarget.Workspace);
      syncEngine.stopAutoSync();
      vscode.window.showInformationMessage('JJJ: 自動同期を無効化しました');
    } else {
      // 現在OFF → ONにする（確認モーダルを表示）
      const result = await vscode.window.showWarningMessage(
        '自動同期を有効化しますか？\n\n' +
        '有効化すると、ファイル保存後に自動的にコミット・プッシュされます。\n' +
        'リモートリポジトリに変更が送信されるため、慎重に判断してください。',
        { modal: true },
        '有効化する',
        'キャンセル'
      );

      if (result === '有効化する') {
        logger.info('Enabling auto sync via toggle');
        await config.update('autoSyncEnabled', true, vscode.ConfigurationTarget.Workspace);
        await syncEngine.startAutoSync();
        vscode.window.showInformationMessage('JJJ: 自動同期を有効化しました');
      } else {
        logger.info('Auto sync toggle cancelled by user');
      }
    }
  } catch (error) {
    logger.error('Failed to toggle auto sync', error as Error);
    vscode.window.showErrorMessage('JJJ: 自動同期の切り替えに失敗しました');
  }
}

/**
 * UC-04: 手動同期コマンド
 */
export async function manualSync(syncEngine: SyncEngine): Promise<void> {
  try {
    logger.info('Manual sync triggered');

    // Step 1: タイマーを一時停止
    syncEngine.pauseTimers();

    // Step 2: 未保存ファイルを保存
    await vscode.workspace.saveAll(false);

    // Step 3: フル同期を実行
    await syncEngine.performFullSync();

    logger.info('Manual sync completed');

  } catch (error) {
    logger.error('Manual sync failed', error as Error);
    vscode.window.showErrorMessage('JJJ: 手動同期に失敗しました');
  } finally {
    // Step 4: タイマーを再開
    syncEngine.resumeTimers();
  }
}

/**
 * 自動同期を有効化
 */
export async function enableAutoSync(syncEngine: SyncEngine): Promise<void> {
  try {
    logger.info('Enabling auto sync');
    await syncEngine.startAutoSync();
    vscode.window.showInformationMessage('JJJ: 自動同期を有効化しました');
  } catch (error) {
    logger.error('Failed to enable auto sync', error as Error);
    vscode.window.showErrorMessage('JJJ: 自動同期の有効化に失敗しました');
  }
}

/**
 * 自動同期を無効化
 */
export function disableAutoSync(syncEngine: SyncEngine): void {
  try {
    logger.info('Disabling auto sync');
    syncEngine.stopAutoSync();
    vscode.window.showInformationMessage('JJJ: 自動同期を無効化しました');
  } catch (error) {
    logger.error('Failed to disable auto sync', error as Error);
    vscode.window.showErrorMessage('JJJ: 自動同期の無効化に失敗しました');
  }
}
