import * as vscode from 'vscode';
import { logger } from '../utils/logger';
import { localize } from '../utils/localize';

export class NotificationManager {
  /**
   * 情報通知を表示
   */
  info(message: string): void {
    const fullMessage = `JJJ: ${message}`;
    vscode.window.showInformationMessage(fullMessage);
    logger.info(message);
  }

  /**
   * 警告通知を表示
   */
  warn(message: string, ...actions: string[]): Thenable<string | undefined> {
    const fullMessage = `JJJ: ${message}`;
    logger.warn(message);
    return vscode.window.showWarningMessage(fullMessage, ...actions);
  }

  /**
   * エラー通知を表示
   */
  error(message: string, error?: Error): void {
    const fullMessage = `JJJ: ${message}`;
    vscode.window.showErrorMessage(fullMessage);
    logger.error(message, error);
  }

  /**
   * コンフリクト通知を表示
   */
  conflictDetected(count: number): void {
    const message = localize('notification.conflicts', '{0} conflicts detected', count.toString());
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
    this.error(localize('notification.jjNotFound', 'jujutsu (jj) is not installed. Please visit https://github.com/martinvonz/jj#installation to install it.'));
  }

  /**
   * リモート未設定通知を表示
   */
  noRemote(): void {
    this.warn(localize('notification.noRemote', 'No remote repository configured. Local change tracking is enabled.'));
  }

  /**
   * ネットワークエラー通知を表示
   */
  networkError(retryCount?: number): void {
    if (retryCount !== undefined) {
      this.warn(localize('notification.networkErrorRetry', 'Network error occurred. Retrying... ({0}/3)', retryCount.toString()));
    } else {
      this.error(localize('notification.networkError', 'Network error occurred. Please check your connection.'));
    }
  }

  /**
   * 認証エラー通知を表示
   */
  authError(): void {
    this.error(localize('notification.authError', 'Authentication failed. Please check your remote repository credentials.'));
  }
}
