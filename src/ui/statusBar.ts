import * as vscode from 'vscode';
import { SyncState } from '../types';
import { CONSTANTS } from '../utils/constants';
import { logger } from '../utils/logger';
import { localize } from '../utils/localize';

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  private currentState: SyncState = 'notApplicable';
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
    if (this.autoSyncEnabled && state !== 'notApplicable') {
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
      this.statusBarItem.backgroundColor = undefined;
    }

    switch (state) {
      case 'notApplicable':
        this.statusBarItem.text = `$(circle-slash) JJJ: ${localize('status.notApplicable', 'Not Applicable')}`;
        this.statusBarItem.command = undefined;
        this.statusBarItem.tooltip = localize('tooltip.noGitRepo', 'No Git repository detected');
        this.statusBarItem.backgroundColor = undefined;
        break;

      case 'enabled':
        if (this.autoSyncEnabled) {
          this.statusBarItem.text = '$(sync) JJJ: ON';
          this.statusBarItem.tooltip = localize('tooltip.autoSyncEnabled', 'Auto-sync is enabled. Click to disable');
        } else {
          this.statusBarItem.text = '$(circle-slash) JJJ: OFF';
          this.statusBarItem.tooltip = localize('tooltip.autoSyncDisabled', 'Auto-sync is disabled. Click to enable');
        }
        this.statusBarItem.command = 'jjj.toggleAutoSync';
        break;

      case 'offline':
        if (this.autoSyncEnabled) {
          this.statusBarItem.text = `$(cloud-offline) JJJ: ON (${localize('status.offline', 'Offline')})`;
          this.statusBarItem.tooltip = localize('tooltip.remoteUnavailable', 'Cannot connect to remote. Click to {0}', localize('tooltip.disable', 'disable'));
        } else {
          this.statusBarItem.text = `$(cloud-offline) JJJ: OFF (${localize('status.offline', 'Offline')})`;
          this.statusBarItem.tooltip = localize('tooltip.remoteUnavailable', 'Cannot connect to remote. Click to {0}', localize('tooltip.enable', 'enable'));
        }
        this.statusBarItem.command = 'jjj.toggleAutoSync';
        break;

      case 'syncing':
        this.statusBarItem.text = `$(sync~spin) JJJ: ${localize('status.syncing', 'Syncing...')}`;
        this.statusBarItem.command = undefined;
        this.statusBarItem.tooltip = localize('tooltip.syncing', 'Sync in progress');
        break;

      case 'syncComplete':
        this.statusBarItem.text = `$(check) JJJ: ${localize('status.syncComplete', 'Sync Complete')}`;
        this.statusBarItem.command = 'jjj.toggleAutoSync';
        this.statusBarItem.tooltip = localize('tooltip.syncComplete', 'Sync completed. Click to {0}',
          this.autoSyncEnabled ? localize('tooltip.disable', 'disable') : localize('tooltip.enable', 'enable'));
        break;

      case 'syncCompleteWithConflicts':
        this.statusBarItem.text = `$(warning) JJJ: ${localize('status.conflict', 'Conflict')}`;
        this.statusBarItem.command = 'jjj.toggleAutoSync';
        this.statusBarItem.tooltip = localize('tooltip.hasConflicts', 'Conflicts detected. Please resolve manually');
        break;

      case 'localOnly':
        if (this.autoSyncEnabled) {
          this.statusBarItem.text = `$(sync) JJJ: ON (${localize('status.localOnly', 'Local Only')})`;
          this.statusBarItem.tooltip = localize('tooltip.noRemote', 'No remote repository configured. Click to {0}', localize('tooltip.disable', 'disable'));
        } else {
          this.statusBarItem.text = `$(circle-slash) JJJ: OFF (${localize('status.localOnly', 'Local Only')})`;
          this.statusBarItem.tooltip = localize('tooltip.noRemote', 'No remote repository configured. Click to {0}', localize('tooltip.enable', 'enable'));
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
