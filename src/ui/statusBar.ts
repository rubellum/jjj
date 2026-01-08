import * as vscode from 'vscode';
import { SyncState } from '../types';
import { CONSTANTS } from '../utils/constants';
import { logger } from '../utils/logger';

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  private currentState: SyncState = '対象外';
  private temporaryTimer?: NodeJS.Timeout;
  private autoSyncEnabled: boolean = false;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'jjj.toggleAutoSync';
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
   * 自動同期のON/OFF状態を設定
   */
  setAutoSyncEnabled(enabled: boolean): void {
    this.autoSyncEnabled = enabled;
    this.updateDisplay(this.currentState);
    logger.debug(`Auto sync enabled changed to: ${enabled}`);
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
    // 自動同期がONの時は背景色を警告色に設定
    if (this.autoSyncEnabled && state !== '対象外') {
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
      this.statusBarItem.backgroundColor = undefined;
    }

    switch (state) {
      case '対象外':
        this.statusBarItem.text = '$(circle-slash) JJJ: 対象外';
        this.statusBarItem.command = undefined;
        this.statusBarItem.tooltip = 'Gitリポジトリが検出されませんでした';
        this.statusBarItem.backgroundColor = undefined;
        break;

      case '有効':
        if (this.autoSyncEnabled) {
          this.statusBarItem.text = '$(sync) JJJ: ON';
          this.statusBarItem.tooltip = '自動同期が有効です。クリックして無効化';
        } else {
          this.statusBarItem.text = '$(circle-slash) JJJ: OFF';
          this.statusBarItem.tooltip = '自動同期が無効です。クリックして有効化';
        }
        this.statusBarItem.command = 'jjj.toggleAutoSync';
        break;

      case 'オフライン':
        if (this.autoSyncEnabled) {
          this.statusBarItem.text = '$(cloud-offline) JJJ: ON (オフライン)';
          this.statusBarItem.tooltip = 'リモートに接続できません。クリックして無効化';
        } else {
          this.statusBarItem.text = '$(cloud-offline) JJJ: OFF (オフライン)';
          this.statusBarItem.tooltip = 'リモートに接続できません。クリックして有効化';
        }
        this.statusBarItem.command = 'jjj.toggleAutoSync';
        break;

      case '同期中':
        this.statusBarItem.text = '$(sync~spin) JJJ: 同期中...';
        this.statusBarItem.command = undefined;
        this.statusBarItem.tooltip = '同期処理を実行中です';
        break;

      case '同期完了':
        this.statusBarItem.text = '$(check) JJJ: 同期完了';
        this.statusBarItem.command = 'jjj.toggleAutoSync';
        this.statusBarItem.tooltip = this.autoSyncEnabled ? '同期が完了しました。クリックして無効化' : '同期が完了しました。クリックして有効化';
        break;

      case '同期完了（コンフリクトあり）':
        this.statusBarItem.text = '$(warning) JJJ: コンフリクト';
        this.statusBarItem.command = 'jjj.toggleAutoSync';
        this.statusBarItem.tooltip = 'コンフリクトがあります。手動で解消してください';
        break;

      case 'ローカルのみ':
        if (this.autoSyncEnabled) {
          this.statusBarItem.text = '$(sync) JJJ: ON (ローカル)';
          this.statusBarItem.tooltip = 'ローカルのみで同期中。クリックして無効化';
        } else {
          this.statusBarItem.text = '$(circle-slash) JJJ: OFF (ローカル)';
          this.statusBarItem.tooltip = 'リモートリポジトリが設定されていません。クリックして有効化';
        }
        this.statusBarItem.command = 'jjj.toggleAutoSync';
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
