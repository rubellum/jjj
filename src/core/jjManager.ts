import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { JJError } from '../types';
import { parseJJError } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { CONSTANTS } from '../utils/constants';

const execAsync = promisify(exec);

export class JJManager {
  private workspacePath: string;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  /**
   * jjコマンドが利用可能かチェック
   */
  async isJJAvailable(): Promise<boolean> {
    try {
      await execAsync('jj --version', {
        timeout: CONSTANTS.COMMAND_TIMEOUT
      });
      logger.info('jj command is available');
      return true;
    } catch (error) {
      logger.error('jj command not found', error as Error);
      return false;
    }
  }

  /**
   * .gitディレクトリが存在するかチェック
   */
  async detectGitRepo(workspacePath?: string): Promise<boolean> {
    const targetPath = workspacePath || this.workspacePath;
    const gitPath = path.join(targetPath, '.git');
    const exists = fs.existsSync(gitPath);
    logger.info(`Git repository ${exists ? 'detected' : 'not found'} at ${targetPath}`);
    return exists;
  }

  /**
   * jjが初期化されているかチェック
   */
  async isJJInitialized(): Promise<boolean> {
    try {
      await this.runCommand('jj status');
      logger.info('JJ is initialized');
      return true;
    } catch (error) {
      logger.info('JJ is not initialized');
      return false;
    }
  }

  /**
   * jjを初期化
   */
  async initializeJJ(): Promise<void> {
    try {
      await this.runCommand('jj git init');
      logger.info('JJ initialized successfully');
    } catch (error) {
      throw parseJJError(error);
    }
  }

  /**
   * リモートリポジトリへの接続を確認
   */
  async checkRemoteConnection(): Promise<boolean> {
    try {
      // gitコマンドでリモート設定を確認
      const output = await this.runCommand('git remote -v');
      if (!output || output.trim() === '') {
        logger.warn('No remote repository configured');
        return false;
      }

      // リモートが設定されていればtrueを返す
      logger.info('Remote repository configured');
      return true;
    } catch (error) {
      logger.warn('Failed to check remote connection');
      return false;
    }
  }

  /**
   * 未コミットの変更があるかチェック
   */
  async hasUncommittedChanges(): Promise<boolean> {
    try {
      const output = await this.runCommand('jj status');
      // "No changes" または "Working copy changes:" で判定
      const hasChanges = output.includes('Working copy changes:') ||
                        !output.includes('No changes');
      logger.debug(`Uncommitted changes: ${hasChanges}`);
      return hasChanges;
    } catch (error) {
      logger.error('Failed to check uncommitted changes', error as Error);
      return false;
    }
  }

  /**
   * 変更をコミット
   */
  async commit(message: string): Promise<void> {
    try {
      const escapedMessage = this.escapeMessage(message);
      await this.runCommand(`jj commit -m "${escapedMessage}"`);
      logger.info(`Committed: ${message}`);
    } catch (error) {
      throw parseJJError(error);
    }
  }

  /**
   * リモートにプッシュ
   */
  async push(): Promise<void> {
    try {
      // 現在のgitブランチを取得
      const branch = await this.getCurrentBranch();

      if (branch) {
        // ブックマークを1つ前のコミット（実際のコミット）に設定
        // jj commitの後は新しい空のワーキングコピーが作られるため、@-を指定
        await this.runCommand(`jj bookmark set ${branch} -r @-`);

        try {
          // ブックマークをpush
          await this.runCommand(`jj git push --bookmark ${branch}`);
          logger.info(`Pushed to remote successfully (branch: ${branch})`);
        } catch (pushError: any) {
          // "Non-tracking remote bookmark" エラーの場合はトラッキングしてリトライ
          if (pushError.message && pushError.message.includes('Non-tracking remote bookmark')) {
            logger.info(`Setting up tracking for ${branch}@origin`);
            await this.runCommand(`jj bookmark track ${branch}@origin`);
            await this.runCommand(`jj git push --bookmark ${branch}`);
            logger.info(`Pushed to remote successfully (branch: ${branch}, tracking set up)`);
          } else {
            throw pushError;
          }
        }
      } else {
        // ブランチが取得できない場合は全ブックマークをpush
        await this.runCommand('jj git push --all');
        logger.info('Pushed to remote successfully (all bookmarks)');
      }
    } catch (error) {
      throw parseJJError(error);
    }
  }

  /**
   * 現在のgitブランチを取得
   */
  private async getCurrentBranch(): Promise<string | null> {
    try {
      const output = await this.runCommand('git branch --show-current');
      const branch = output.trim();

      // detached HEADの場合は空文字列が返るので、mainを使う
      if (!branch) {
        logger.debug('Detached HEAD detected, using main branch');
        return 'main';
      }

      logger.debug(`Current branch: ${branch}`);
      return branch;
    } catch (error) {
      logger.warn('Failed to get current branch', error as Error);
      return null;
    }
  }

  /**
   * リモートからフェッチ
   */
  async fetch(): Promise<void> {
    try {
      await this.runCommand('jj git fetch');
      logger.info('Fetched from remote successfully');
    } catch (error) {
      throw parseJJError(error);
    }
  }

  /**
   * リモートの変更があるかチェック
   */
  async hasRemoteChanges(): Promise<boolean> {
    try {
      // リモートブックマークとの差分をチェック (新しいjjバージョンではremote_bookmarks)
      const output = await this.runCommand('jj log -r "remote_bookmarks()..@" --no-graph -T "commit_id"');
      const hasChanges = output.trim() !== '';
      logger.debug(`Remote changes: ${hasChanges}`);
      return hasChanges;
    } catch (error) {
      logger.warn('Failed to check remote changes', error as Error);
      return false;
    }
  }

  /**
   * リモートの変更をマージ
   */
  async merge(): Promise<void> {
    try {
      // jjではrebaseを使用して変更を統合
      await this.runCommand('jj rebase -d main@origin');
      logger.info('Merged remote changes successfully');
    } catch (error) {
      throw parseJJError(error);
    }
  }

  /**
   * jjコマンドを実行
   */
  private async runCommand(command: string, timeout?: number): Promise<string> {
    try {
      logger.debug(`Running command: ${command}`);

      const { stdout, stderr } = await execAsync(command, {
        cwd: this.workspacePath,
        timeout: timeout || CONSTANTS.COMMAND_TIMEOUT,
        encoding: 'utf8'
      });

      // stderrに警告が含まれる場合があるが、エラーでない場合もある
      if (stderr && !this.isWarning(stderr)) {
        logger.warn(`Command stderr: ${stderr}`);
      }

      return stdout.trim();
    } catch (error: any) {
      logger.error(`Command failed: ${command}`, error);
      throw error;
    }
  }

  /**
   * stderrが警告かどうかチェック
   */
  private isWarning(stderr: string): boolean {
    // jjの一般的な警告メッセージパターン
    const warningPatterns = [
      'Warning:',
      'Hint:',
      'Note:',
    ];

    return warningPatterns.some(pattern => stderr.includes(pattern));
  }

  /**
   * コミットメッセージをエスケープ
   */
  private escapeMessage(message: string): string {
    return message.replace(/"/g, '\\"');
  }

  /**
   * ワークスペースパスを取得
   */
  getWorkspacePath(): string {
    return this.workspacePath;
  }
}
