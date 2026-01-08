import * as vscode from 'vscode';
import { logger } from '../utils/logger';

export class NotificationManager {
  /**
   * 情報通知を表示
   */
  info(message: string): void {
    const fullMessage = `DocSync: ${message}`;
    vscode.window.showInformationMessage(fullMessage);
    logger.info(message);
  }

  /**
   * 警告通知を表示
   */
  warn(message: string, ...actions: string[]): Thenable<string | undefined> {
    const fullMessage = `DocSync: ${message}`;
    logger.warn(message);
    return vscode.window.showWarningMessage(fullMessage, ...actions);
  }

  /**
   * エラー通知を表示
   */
  error(message: string, error?: Error): void {
    const fullMessage = `DocSync: ${message}`;
    vscode.window.showErrorMessage(fullMessage);
    logger.error(message, error);
  }

  /**
   * コンフリクト通知を表示
   */
  conflictDetected(count: number): void {
    const message = `${count}件のコンフリクトがあります`;
    this.warn(message);
  }

  /**
   * 同期完了通知を表示
   */
  syncComplete(): void {
    // 情報通知は表示せず、ログのみ（ステータスバーで表示）
    logger.info('Sync completed successfully');
  }

  /**
   * jj未インストール通知を表示
   */
  jjNotFound(): void {
    this.error('jujutsu (jj) がインストールされていません。https://github.com/martinvonz/jj#installation を参照してインストールしてください。');
  }

  /**
   * リモート未設定通知を表示
   */
  noRemote(): void {
    this.warn('リモートリポジトリが設定されていません。ローカルのみの変更追跡が有効です。');
  }

  /**
   * ネットワークエラー通知を表示
   */
  networkError(retryCount?: number): void {
    if (retryCount !== undefined) {
      this.warn(`ネットワークエラーが発生しました。再試行中... (${retryCount}/3)`);
    } else {
      this.error('ネットワークエラーが発生しました。接続を確認してください。');
    }
  }

  /**
   * 認証エラー通知を表示
   */
  authError(): void {
    this.error('認証に失敗しました。リモートリポジトリの認証情報を確認してください。');
  }
}
