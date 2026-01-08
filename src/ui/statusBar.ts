import * as vscode from 'vscode';
import { SyncState } from '../types';
import { CONSTANTS } from '../utils/constants';
import { logger } from '../utils/logger';

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  private currentState: SyncState = '対象外';
  private temporaryTimer?: NodeJS.Timeout;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'jjj.manualSync';
    this.statusBarItem.show();
  }

  /**
   * 同期状態を設定
   */
  setState(state: SyncState): void {
    this.currentState = state;
    this.updateDisplay(state);
    logger.debug(`Status bar state changed to: ${state}`);
  }

  /**
   * 一時的なメッセージを表示
   */
  showTemporary(text: string, duration: number = CONSTANTS.STATUS_DISPLAY_DURATION): void {
    // 既存のタイマーをクリア
    if (this.temporaryTimer) {
      clearTimeout(this.temporaryTimer);
    }

    const originalText = this.statusBarItem.text;

    this.statusBarItem.text = `$(check) ${text}`;

    this.temporaryTimer = setTimeout(() => {
      this.updateDisplay(this.currentState);
      this.temporaryTimer = undefined;
    }, duration);
  }

  /**
   * 表示を更新
   */
  private updateDisplay(state: SyncState): void {
    switch (state) {
      case '対象外':
        this.statusBarItem.text = '$(circle-slash) 同期: 対象外';
        this.statusBarItem.command = undefined;
        this.statusBarItem.tooltip = 'Gitリポジトリが検出されませんでした';
        break;

      case '有効':
        this.statusBarItem.text = '$(sync) 同期: 有効';
        this.statusBarItem.command = 'jjj.manualSync';
        this.statusBarItem.tooltip = '自動同期が有効です。クリックして手動同期を実行';
        break;

      case 'オフライン':
        this.statusBarItem.text = '$(cloud-offline) 同期: オフライン';
        this.statusBarItem.command = 'jjj.manualSync';
        this.statusBarItem.tooltip = 'リモートに接続できません。クリックして再試行';
        break;

      case '同期中':
        this.statusBarItem.text = '$(sync~spin) 同期中...';
        this.statusBarItem.command = undefined;
        this.statusBarItem.tooltip = '同期処理を実行中です';
        break;

      case '同期完了':
        this.statusBarItem.text = '$(check) 同期完了';
        this.statusBarItem.command = 'jjj.manualSync';
        this.statusBarItem.tooltip = '同期が完了しました';
        break;

      case '同期完了（コンフリクトあり）':
        this.statusBarItem.text = '$(warning) 同期完了（コンフリクトあり）';
        this.statusBarItem.command = 'jjj.manualSync';
        this.statusBarItem.tooltip = 'コンフリクトがあります。手動で解消してください';
        break;

      case 'ローカルのみ':
        this.statusBarItem.text = '$(sync) 同期: ローカルのみ';
        this.statusBarItem.command = undefined;
        this.statusBarItem.tooltip = 'リモートリポジトリが設定されていません';
        break;
    }
  }

  /**
   * 現在の状態を取得
   */
  getState(): SyncState {
    return this.currentState;
  }

  /**
   * リソースをクリーンアップ
   */
  dispose(): void {
    if (this.temporaryTimer) {
      clearTimeout(this.temporaryTimer);
    }
    this.statusBarItem.dispose();
  }
}
