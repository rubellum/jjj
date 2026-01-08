import * as vscode from 'vscode';
import { SyncEngine } from '../core/syncEngine';
import { manualSync, enableAutoSync, disableAutoSync } from './manualSync';
import { logger } from '../utils/logger';

/**
 * 全てのコマンドを登録
 */
export function registerCommands(
  context: vscode.ExtensionContext,
  syncEngine: SyncEngine
): void {
  logger.info('Registering commands');

  // 手動同期コマンド
  context.subscriptions.push(
    vscode.commands.registerCommand('jjj.manualSync', () => manualSync(syncEngine))
  );

  // 自動同期を有効化
  context.subscriptions.push(
    vscode.commands.registerCommand('jjj.enable', () => enableAutoSync(syncEngine))
  );

  // 自動同期を無効化
  context.subscriptions.push(
    vscode.commands.registerCommand('jjj.disable', () => disableAutoSync(syncEngine))
  );

  logger.info('Commands registered successfully');
}
