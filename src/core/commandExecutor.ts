import { exec } from 'child_process';
import { promisify } from 'util';
import { ICommandExecutor, ExecuteOptions, ExecuteResult } from './interfaces';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);

/**
 * コマンド実行の実装クラス
 * child_processのexecをラップし、ICommandExecutorインターフェースを実装
 */
export class CommandExecutor implements ICommandExecutor {
  async execute(command: string, options: ExecuteOptions = {}): Promise<ExecuteResult> {
    try {
      logger.debug(`Executing command: ${command}`);
      const { stdout, stderr } = await execAsync(command, {
        cwd: options.cwd,
        timeout: options.timeout,
        encoding: options.encoding || 'utf8'
      });

      return { stdout: stdout.trim(), stderr: stderr.trim() };
    } catch (error: any) {
      logger.error(`Command failed: ${command}`, error);
      throw error;
    }
  }
}
