import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { AutoPullService } from '../../../services/autoPull';
import { JJManager } from '../../../core/jjManager';
import { ConflictDetector } from '../../../core/conflictDetector';
import { MockCommandExecutor } from '../../helpers/mockChildProcess';
import { MockFileSystem } from '../../helpers/mockFileSystem';
import { TestUtils } from '../../helpers/testUtils';

suite('AutoPullService Test Suite', () => {
  let autoPullService: AutoPullService;
  let mockJJManager: JJManager;
  let mockConflictDetector: ConflictDetector;
  let mockStatusBar: any;
  let mockNotifications: any;
  let mockExecutor: MockCommandExecutor;
  let mockFS: MockFileSystem;
  let workspacePath: string;

  setup(() => {
    workspacePath = TestUtils.getMockWorkspacePath();

    // Mock StatusBarManager
    mockStatusBar = {
      setState: sinon.stub(),
      dispose: sinon.stub()
    };

    // Mock NotificationManager
    mockNotifications = {
      networkError: sinon.stub()
    };

    mockExecutor = new MockCommandExecutor();
    mockFS = new MockFileSystem();
    mockJJManager = new JJManager(workspacePath, mockExecutor, mockFS);
    mockConflictDetector = new ConflictDetector(mockFS);

    autoPullService = new AutoPullService(
      mockJJManager,
      mockConflictDetector,
      mockStatusBar,
      mockNotifications
    );
  });

  teardown(() => {
    sinon.restore();
  });

  suite('pull - UC-03: リモートから変更を取得', () => {
    test('リモート変更がない場合、スキップ', async () => {
      mockExecutor.mockFetchSuccess();
      mockExecutor.setResponse(/jj log -r/, {
        stdout: '',
        stderr: ''
      });

      await autoPullService.pull();

      // mergeが呼ばれないことを確認
      const mergeCall = mockExecutor.executeStub.getCalls()
        .find((call: any) => call.args[0].includes('jj rebase'));
      assert.strictEqual(mergeCall, undefined, 'should not merge when no remote changes');
    });

    test('リモート変更がある場合、フェッチ→マージ', async () => {
      mockExecutor.mockFetchSuccess();
      mockExecutor.setResponse(/jj log -r/, {
        stdout: 'abc123\ndef456',
        stderr: ''
      });
      mockExecutor.setResponse(/git branch --show-current/, {
        stdout: 'main',
        stderr: ''
      });
      mockExecutor.setResponse(/jj rebase/, {
        stdout: 'Rebased successfully',
        stderr: ''
      });

      await autoPullService.pull();

      // fetchとmergeが呼ばれたことを確認
      const fetchCall = mockExecutor.executeStub.getCalls()
        .find((call: any) => call.args[0].includes('jj git fetch'));
      const mergeCall = mockExecutor.executeStub.getCalls()
        .find((call: any) => call.args[0].includes('jj rebase'));

      assert.ok(fetchCall, 'fetch should be called');
      assert.ok(mergeCall, 'merge should be called');
    });

    test('マージ成功時、enabledステートに戻る', async () => {
      mockExecutor.mockFetchSuccess();
      mockExecutor.setResponse(/jj log -r/, {
        stdout: 'abc123',
        stderr: ''
      });
      mockExecutor.setResponse(/git branch --show-current/, {
        stdout: 'main',
        stderr: ''
      });
      mockExecutor.setResponse(/jj rebase/, {
        stdout: 'Rebased successfully',
        stderr: ''
      });

      await autoPullService.pull();

      // enabledステートに戻ることを確認
      const enabledCall = mockStatusBar.setState.getCalls()
        .find((call: any) => call.args[0] === 'enabled');
      assert.ok(enabledCall, 'should set state to enabled after successful pull');
    });
  });

  suite('pull - エラーハンドリング', () => {
    test('コンフリクト発生時、syncCompleteWithConflictsステートに遷移', async () => {
      mockExecutor.mockFetchSuccess();
      mockExecutor.setResponse(/jj log -r/, {
        stdout: 'abc123',
        stderr: ''
      });
      mockExecutor.setResponse(/git branch --show-current/, {
        stdout: 'main',
        stderr: ''
      });

      // マージでコンフリクトエラー（メッセージに'conflict'を含める）
      // 既存のモックをリセット
      mockExecutor.executeStub.reset();
      mockExecutor.executeStub.callsFake(async (cmd: string) => {
        if (cmd.includes('jj git fetch')) {
          return { stdout: 'Fetched', stderr: '' };
        }
        if (cmd.includes('jj log -r')) {
          return { stdout: 'abc123', stderr: '' };
        }
        if (cmd.includes('git branch --show-current')) {
          return { stdout: 'main', stderr: '' };
        }
        if (cmd.includes('jj rebase')) {
          // parseJJErrorがメッセージから'conflict'を検出してCONFLICTと判定
          const error: any = new Error('conflict during merge');
          error.stderr = 'conflict during merge';
          throw error;
        }
        throw new Error(`Unexpected command: ${cmd}`);
      });

      await autoPullService.pull();

      // syncCompleteWithConflictsステートに遷移することを確認
      const conflictStateCall = mockStatusBar.setState.getCalls()
        .find((call: any) => call.args[0] === 'syncCompleteWithConflicts');
      assert.ok(conflictStateCall, 'should set state to syncCompleteWithConflicts on conflict');
    });

    test('ネットワークエラー時、offlineステートに遷移', async () => {
      mockExecutor.executeStub.callsFake(async (cmd: string) => {
        if (cmd.includes('jj git fetch')) {
          const error: any = new Error('Connection refused');
          error.type = 'NETWORK_ERROR';
          throw error;
        }
        throw new Error(`Unexpected command: ${cmd}`);
      });

      await autoPullService.pull();

      // offlineステートに遷移することを確認
      const offlineCall = mockStatusBar.setState.getCalls()
        .find((call: any) => call.args[0] === 'offline');
      assert.ok(offlineCall, 'should set state to offline on network error');
    });

    test('その他のエラー時、offlineステートに遷移', async () => {
      mockExecutor.executeStub.callsFake(async (cmd: string) => {
        if (cmd.includes('jj git fetch')) {
          throw new Error('Unknown error');
        }
        throw new Error(`Unexpected command: ${cmd}`);
      });

      await autoPullService.pull();

      // offlineステートに遷移することを確認
      const offlineCall = mockStatusBar.setState.getCalls()
        .find((call: any) => call.args[0] === 'offline');
      assert.ok(offlineCall, 'should set state to offline on unknown error');
    });

    test('コンフリクトビューの更新コマンドが実行される', async () => {
      mockExecutor.mockFetchSuccess();
      mockExecutor.setResponse(/jj log -r/, {
        stdout: 'abc123',
        stderr: ''
      });
      mockExecutor.setResponse(/git branch --show-current/, {
        stdout: 'main',
        stderr: ''
      });

      mockExecutor.executeStub.callsFake(async (cmd: string) => {
        if (cmd.includes('jj git fetch')) {
          return { stdout: 'Fetched', stderr: '' };
        }
        if (cmd.includes('jj log -r')) {
          return { stdout: 'abc123', stderr: '' };
        }
        if (cmd.includes('git branch --show-current')) {
          return { stdout: 'main', stderr: '' };
        }
        if (cmd.includes('jj rebase')) {
          const { JJError } = require('../../../types');
          throw new JJError('CONFLICT', 'Conflict during merge');
        }
        throw new Error(`Unexpected command: ${cmd}`);
      });

      // vscode.commands.executeCommandは既にモックされている
      const executeCommandMock = vscode.commands.executeCommand as any;

      await autoPullService.pull();

      // jjj.refreshConflictsコマンドが実行されることを確認
      assert.ok(executeCommandMock.called, 'should call executeCommand');
    });
  });

  suite('正常フロー', () => {
    test('フェッチ→変更チェック→マージの順序で実行', async () => {
      const executionOrder: string[] = [];

      mockExecutor.executeStub.callsFake(async (cmd: string) => {
        if (cmd.includes('jj git fetch')) {
          executionOrder.push('fetch');
          return { stdout: 'Fetched', stderr: '' };
        }
        if (cmd.includes('jj log -r')) {
          executionOrder.push('check');
          return { stdout: 'abc123', stderr: '' };
        }
        if (cmd.includes('git branch --show-current')) {
          return { stdout: 'main', stderr: '' };
        }
        if (cmd.includes('jj rebase')) {
          executionOrder.push('merge');
          return { stdout: 'Rebased', stderr: '' };
        }
        throw new Error(`Unexpected command: ${cmd}`);
      });

      await autoPullService.pull();

      // 実行順序を確認（checkは複数回呼ばれる可能性がある）
      assert.ok(executionOrder[0] === 'fetch', 'should fetch first');
      assert.ok(executionOrder.includes('check'), 'should check for changes');
      assert.ok(executionOrder[executionOrder.length - 1] === 'merge', 'should merge last');
    });
  });
});
