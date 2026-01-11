import * as vscode from 'vscode';
import { SyncEngine } from '../core/syncEngine';
import { logger } from '../utils/logger';
import { CONSTANTS } from '../utils/constants';
import { localize } from '../utils/localize';

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
      vscode.window.showInformationMessage(`JJJ: ${localize('notification.autoSyncDisabled', 'Auto-sync disabled')}`);
    } else {
      // 現在OFF → ONにする（確認モーダルを表示）
      const confirmButton = localize('modal.enableAutoSyncConfirm', 'Enable');
      const result = await vscode.window.showWarningMessage(
        localize('modal.enableAutoSyncMessage', 'When enabled, files will be automatically committed and pushed after saving.\nChanges will be sent to the remote repository, so please decide carefully.'),
        { modal: true },
        confirmButton
      );

      if (result === confirmButton) {
        logger.info('Enabling auto sync via toggle');
        await config.update('autoSyncEnabled', true, vscode.ConfigurationTarget.Workspace);
        await syncEngine.startAutoSync();
        vscode.window.showInformationMessage(`JJJ: ${localize('notification.autoSyncEnabled', 'Auto-sync enabled')}`);
      } else {
        logger.info('Auto sync toggle cancelled by user');
      }
    }
  } catch (error) {
    logger.error('Failed to toggle auto sync', error as Error);
    vscode.window.showErrorMessage(`JJJ: ${localize('notification.toggleFailed', 'Failed to toggle auto-sync')}`);
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
    vscode.window.showErrorMessage(`JJJ: ${localize('notification.manualSyncFailed', 'Manual sync failed')}`);
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
    vscode.window.showInformationMessage(`JJJ: ${localize('notification.autoSyncEnabled', 'Auto-sync enabled')}`);
  } catch (error) {
    logger.error('Failed to enable auto sync', error as Error);
    vscode.window.showErrorMessage(`JJJ: ${localize('notification.enableFailed', 'Failed to enable auto-sync')}`);
  }
}

/**
 * 自動同期を無効化
 */
export function disableAutoSync(syncEngine: SyncEngine): void {
  try {
    logger.info('Disabling auto sync');
    syncEngine.stopAutoSync();
    vscode.window.showInformationMessage(`JJJ: ${localize('notification.autoSyncDisabled', 'Auto-sync disabled')}`);
  } catch (error) {
    logger.error('Failed to disable auto sync', error as Error);
    vscode.window.showErrorMessage(`JJJ: ${localize('notification.disableFailed', 'Failed to disable auto-sync')}`);
  }
}
