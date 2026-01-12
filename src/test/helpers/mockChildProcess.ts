import * as sinon from 'sinon';
import { ICommandExecutor, ExecuteResult } from '../../core/interfaces';

/**
 * CommandExecutorのモック実装
 * テストでjjコマンド実行をモック可能にする
 */
export class MockCommandExecutor implements ICommandExecutor {
  public executeStub: sinon.SinonStub;
  private responses: Map<string, ExecuteResult>;

  constructor() {
    this.executeStub = sinon.stub();
    this.responses = new Map();
  }

  async execute(command: string, options?: any): Promise<ExecuteResult> {
    return this.executeStub(command, options);
  }

  /**
   * 特定のコマンドパターンに対するレスポンスを設定
   */
  setResponse(commandPattern: string | RegExp, result: ExecuteResult): void {
    const key = commandPattern instanceof RegExp ? commandPattern.source : commandPattern;
    this.responses.set(key, result);

    this.executeStub.callsFake(async (cmd: string) => {
      for (const [pattern, response] of this.responses.entries()) {
        if (new RegExp(pattern).test(cmd)) {
          return response;
        }
      }
      throw new Error(`No mock response for command: ${cmd}`);
    });
  }

  /**
   * jj statusで「変更なし」を返す
   */
  mockNoChanges(): void {
    this.setResponse(/jj status/, { stdout: 'No changes', stderr: '' });
  }

  /**
   * jj statusで「変更あり」を返す
   */
  mockWithChanges(): void {
    this.setResponse(/jj status/, {
      stdout: 'Working copy changes:\nM file.txt',
      stderr: ''
    });
  }

  /**
   * jj commitの成功
   */
  mockCommitSuccess(): void {
    this.setResponse(/jj commit/, { stdout: 'Committed as abc123', stderr: '' });
  }

  /**
   * jj pushの成功
   */
  mockPushSuccess(): void {
    this.setResponse(/jj git push/, { stdout: 'Pushed', stderr: '' });
  }

  /**
   * jj fetchの成功
   */
  mockFetchSuccess(): void {
    this.setResponse(/jj git fetch/, { stdout: 'Fetched', stderr: '' });
  }

  /**
   * エラーをスロー
   */
  mockError(commandPattern: string | RegExp, errorMessage: string): void {
    const key = commandPattern instanceof RegExp ? commandPattern.source : commandPattern;

    this.executeStub.callsFake(async (cmd: string) => {
      const regex = new RegExp(key);
      if (regex.test(cmd)) {
        const error: any = new Error(errorMessage);
        error.message = errorMessage;
        error.stderr = errorMessage;
        throw error;
      }

      // 既存のレスポンスを確認
      for (const [pattern, response] of this.responses.entries()) {
        const regex = new RegExp(pattern);
        if (regex.test(cmd)) {
          return response;
        }
      }

      throw new Error(`No mock response for command: ${cmd}`);
    });
  }

  /**
   * モックをリセット
   */
  reset(): void {
    this.executeStub.reset();
    this.responses.clear();
  }
}
