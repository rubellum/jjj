import * as vscode from 'vscode';
import { logger } from '../utils/logger';

export class FileWatcher {
  private disposable?: vscode.Disposable;

  /**
   * ファイル保存の監視を開始
   */
  startWatching(onSave: (file: vscode.Uri) => void): void {
    logger.info('Starting file watch');

    this.disposable = vscode.workspace.onDidSaveTextDocument((document) => {
      // ワークスペース内のファイルのみを対象
      if (this.isInWorkspace(document.uri)) {
        logger.debug(`File saved: ${document.uri.fsPath}`);
        onSave(document.uri);
      }
    });
  }

  /**
   * 監視を停止
   */
  stopWatching(): void {
    if (this.disposable) {
      this.disposable.dispose();
      this.disposable = undefined;
      logger.info('File watch stopped');
    }
  }

  /**
   * ファイルがワークスペース内にあるかチェック
   */
  private isInWorkspace(uri: vscode.Uri): boolean {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return false;
    }

    return workspaceFolders.some(folder => {
      return uri.fsPath.startsWith(folder.uri.fsPath);
    });
  }

  /**
   * リソースをクリーンアップ
   */
  dispose(): void {
    this.stopWatching();
  }
}
