import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { JJError, CommitInfo } from '../types';
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
   * コンフリクト状態のファイル一覧を取得
   */
  async getConflictedFiles(): Promise<string[]> {
    try {
      const output = await this.runCommand('jj status');
      const lines = output.split('\n');
      const conflictedFiles: string[] = [];

      for (const line of lines) {
        // "conflict" を含む行からファイルパスを抽出
        if (line.includes('conflict') || line.includes('Conflict')) {
          const match = line.match(/conflict\s+(.+)$/);
          if (match) {
            const relativePath = match[1].trim();
            const absolutePath = path.join(this.workspacePath, relativePath);
            conflictedFiles.push(absolutePath);
          }
        }
      }

      logger.info(`Found ${conflictedFiles.length} conflicted files`);
      return conflictedFiles;
    } catch (error) {
      logger.error('Failed to get conflicted files', error as Error);
      return [];
    }
  }

  /**
   * コミット履歴を取得（ページネーション対応）
   * @param limit 取得件数（デフォルト: 20）
   * @param offset スキップ件数（デフォルト: 0）
   */
  async getCommitHistory(limit: number = 20, offset: number = 0): Promise<CommitInfo[]> {
    try {
      // jj logでタブ区切りの情報を取得
      const template = 'commit_id ++ "\\t" ++ author.name() ++ "\\t" ++ author.timestamp() ++ "\\t" ++ description ++ "\\n"';
      const command = `jj log --no-graph --limit ${limit + offset} -T '${template}'`;
      const output = await this.runCommand(command);

      const lines = output.trim().split('\n').slice(offset);
      const commits: CommitInfo[] = [];

      for (const line of lines) {
        if (!line.trim()) continue;

        const [commitId, author, timestamp, ...descParts] = line.split('\t');
        const description = descParts.join('\t').trim();

        if (!description || description === '(no description set)') {
          continue;
        }

        commits.push({
          commitId: commitId.trim(),
          shortCommitId: commitId.trim().substring(0, 8),
          author: author.trim(),
          timestamp: new Date(timestamp.trim()),
          description: description,
          changedFiles: []
        });
      }

      logger.info(`Retrieved ${commits.length} commits from history`);
      return commits;
    } catch (error) {
      logger.error('Failed to get commit history', error as Error);
      throw parseJJError(error);
    }
  }

  /**
   * 特定のコミットで変更されたファイルを取得
   * @param commitId コミットID
   */
  async getChangedFiles(commitId: string): Promise<string[]> {
    try {
      const command = `jj diff -r ${commitId} --summary`;
      const output = await this.runCommand(command);

      const lines = output.trim().split('\n');
      const changedFiles: string[] = [];

      for (const line of lines) {
        // "M  path/to/file.md" 形式から抽出
        const match = line.match(/^[MAD]\s+(.+)$/);
        if (match) {
          changedFiles.push(match[1].trim());
        }
      }

      return changedFiles;
    } catch (error) {
      logger.warn(`Failed to get changed files for commit ${commitId}`, error as Error);
      return [];
    }
  }

  /**
   * 特定ファイルのコミット履歴を取得
   * @param filePath ファイルパス（ワークスペース相対）
   * @param limit 取得件数
   */
  async getFileHistory(filePath: string, limit: number = 20): Promise<CommitInfo[]> {
    try {
      const template = 'commit_id ++ "\\t" ++ author.name() ++ "\\t" ++ author.timestamp() ++ "\\t" ++ description ++ "\\n"';
      const command = `jj log --no-graph --limit ${limit} -T '${template}' ${filePath}`;
      const output = await this.runCommand(command);

      const lines = output.trim().split('\n');
      const commits: CommitInfo[] = [];

      for (const line of lines) {
        if (!line.trim()) continue;

        const [commitId, author, timestamp, ...descParts] = line.split('\t');
        const description = descParts.join('\t').trim();

        if (!description || description === '(no description set)') {
          continue;
        }

        commits.push({
          commitId: commitId.trim(),
          shortCommitId: commitId.trim().substring(0, 8),
          author: author.trim(),
          timestamp: new Date(timestamp.trim()),
          description: description,
          changedFiles: [filePath]
        });
      }

      logger.info(`Retrieved ${commits.length} commits for file ${filePath}`);
      return commits;
    } catch (error) {
      logger.error(`Failed to get file history for ${filePath}`, error as Error);
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
