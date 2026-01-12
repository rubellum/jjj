import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { AutoCommitService } from '../../../services/autoCommit';
import { JJManager } from '../../../core/jjManager';
import { TimerScheduler } from '../../../core/timerScheduler';
import { ConflictDetector } from '../../../core/conflictDetector';
import { MockCommandExecutor } from '../../helpers/mockChildProcess';
import { MockFileSystem } from '../../helpers/mockFileSystem';
import { TestUtils } from '../../helpers/testUtils';

suite('AutoCommitService Test Suite', () => {
  let autoCommitService: AutoCommitService;
  let mockJJManager: JJManager;
  let mockScheduler: TimerScheduler;
  let mockConflictDetector: ConflictDetector;
  let mockStatusBar: any;
  let mockNotifications: any;
  let mockAutoPullService: any;
  let mockExecutor: MockCommandExecutor;
  let mockFS: MockFileSystem;
  let workspacePath: string;
  let clock: sinon.SinonFakeTimers;

  setup(() => {
    workspacePath = TestUtils.getMockWorkspacePath();
    clock = sinon.useFakeTimers();

    // Mock configuration - vscode is already mocked in setup.ts
    const getConfigMock = vscode.workspace.getConfiguration as any;
    getConfigMock.returns({
      get: (key: string, defaultValue: any) => {
        if (key === 'autoSyncEnabled') { return true; }
        return defaultValue;
      }
    });

    // Mock StatusBarManager
    mockStatusBar = {
      setState: sinon.stub(),
      showTemporary: sinon.stub(),
      dispose: sinon.stub()
    };

    // Mock NotificationManager
    mockNotifications = {
      networkError: sinon.stub(),
      error: sinon.stub()
    };

    // Mock AutoPullService
    mockAutoPullService = {
      pull: sinon.stub().resolves()
    };

    mockExecutor = new MockCommandExecutor();
    mockFS = new MockFileSystem();
    mockJJManager = new JJManager(workspacePath, mockExecutor, mockFS);
    mockScheduler = new TimerScheduler();
    mockConflictDetector = new ConflictDetector(mockFS);

    autoCommitService = new AutoCommitService(
      mockJJManager,
      mockScheduler,
      mockConflictDetector,
      mockStatusBar,
      mockNotifications,
      mockAutoPullService
    );
  });

  teardown(() => {
    sinon.restore();
    clock.restore();
    autoCommitService.dispose();
  });

  suite('queueChange - UC-02: ファイル変更をキューに追加', () => {
    test('ファイルをキューに追加', () => {
      const file = vscode.Uri.file('/test/file.txt');

      autoCommitService.queueChange(file);

      // タイマーがスケジュールされたことを確認
      assert.strictEqual(mockScheduler.getActiveTimerCount(), 1);
    });

    test('連続した変更でタイマーがリセット（デバウンス）', () => {
      const file1 = vscode.Uri.file('/test/file1.txt');
      const file2 = vscode.Uri.file('/test/file2.txt');

      autoCommitService.queueChange(file1);
      clock.tick(30000); // 30秒経過

      autoCommitService.queueChange(file2);
      // タイマーがリセットされるので、まだ実行されない

      assert.strictEqual(mockScheduler.getActiveTimerCount(), 1);
    });

    test('自動同期が無効の場合、キューに追加しない', () => {
      const getConfigMock = vscode.workspace.getConfiguration as any;
      getConfigMock.returns({
        get: (key: string, defaultValue: any) => {
          if (key === 'autoSyncEnabled') { return false; }
          return defaultValue;
        }
      });

      const file = vscode.Uri.file('/test/file.txt');
      autoCommitService.queueChange(file);

      // タイマーがスケジュールされないことを確認
      assert.strictEqual(mockScheduler.getActiveTimerCount(), 0);
    });

    test('1分後にprocessQueueが実行される', async () => {
      mockExecutor.mockNoChanges();

      const file = vscode.Uri.file('/test/file.txt');
      autoCommitService.queueChange(file);

      // 1分経過
      await clock.tickAsync(60000);

      // statusが呼ばれたことを確認（processQueueが実行された）
      const statusCall = mockExecutor.executeStub.getCalls()
        .find((call: any) => call.args[0].includes('jj status'));
      assert.ok(statusCall, 'processQueue should be called after 1 minute');
    });
  });

  suite('processQueue - 変更処理', () => {
    test('変更がない場合、スキップ', async () => {
      mockExecutor.mockNoChanges();

      const file = vscode.Uri.file('/test/file.txt');
      autoCommitService.queueChange(file);

      await clock.tickAsync(60000);

      // コミットが呼ばれないことを確認
      const commitCall = mockExecutor.executeStub.getCalls()
        .find((call: any) => call.args[0].includes('jj commit'));
      assert.strictEqual(commitCall, undefined, 'should not commit when no changes');
    });

    test('変更がある場合、コミット→プッシュ', async () => {
      mockExecutor.mockWithChanges();
      mockExecutor.mockCommitSuccess();
      mockExecutor.setResponse(/git branch/, {
        stdout: 'main',
        stderr: ''
      });
      mockExecutor.setResponse(/jj bookmark set/, {
        stdout: 'Set',
        stderr: ''
      });
      mockExecutor.mockPushSuccess();

      const file = vscode.Uri.file('/test/file.txt');
      autoCommitService.queueChange(file);

      await clock.tickAsync(60000);

      // コミットとプッシュが呼ばれたことを確認
      const commitCall = mockExecutor.executeStub.getCalls()
        .find((call: any) => call.args[0].includes('jj commit'));
      const pushCall = mockExecutor.executeStub.getCalls()
        .find((call: any) => call.args[0].includes('jj git push'));

      assert.ok(commitCall, 'commit should be called');
      assert.ok(pushCall, 'push should be called');
    });

    test.skip('コミットメッセージにタイムスタンプが含まれる', async () => {
      mockExecutor.mockWithChanges();
      mockExecutor.mockCommitSuccess();
      mockExecutor.setResponse(/git branch/, { stdout: 'main', stderr: '' });
      mockExecutor.setResponse(/jj bookmark set/, { stdout: 'Set', stderr: '' });
      mockExecutor.mockPushSuccess();

      const file = vscode.Uri.file('/test/file.txt');
      autoCommitService.queueChange(file);

      await clock.tickAsync(60000);

      const commitCall = mockExecutor.executeStub.getCalls()
        .find((call: any) => call.args[0].includes('jj commit'));

      assert.ok(commitCall);
      assert.ok(commitCall.args[0].includes('[auto-commit]'), 'commit message should include [auto-commit]');
    });

    test('自動同期が無効の場合、processQueueをスキップ', async () => {
      mockExecutor.mockWithChanges();

      const file = vscode.Uri.file('/test/file.txt');
      autoCommitService.queueChange(file);

      // 設定を無効に変更
      const getConfigMock = vscode.workspace.getConfiguration as any;
      getConfigMock.returns({
        get: (key: string, defaultValue: any) => {
          if (key === 'autoSyncEnabled') { return false; }
          return defaultValue;
        }
      });

      await clock.tickAsync(60000);

      // コミットが呼ばれないことを確認
      const commitCall = mockExecutor.executeStub.getCalls()
        .find((call: any) => call.args[0].includes('jj commit'));
      assert.strictEqual(commitCall, undefined, 'should skip processing when auto-sync is disabled');
    });
  });

  suite('processQueue - エラーハンドリング', () => {
    test.skip('ネットワークエラー時にリトライ', async () => {
      mockExecutor.mockWithChanges();
      mockExecutor.mockCommitSuccess();

      // プッシュでネットワークエラー
      let pushCallCount = 0;
      mockExecutor.executeStub.callsFake(async (cmd: string) => {
        if (cmd.includes('jj status')) {
          return { stdout: 'Working copy changes:\nM file.txt', stderr: '' };
        }
        if (cmd.includes('jj commit')) {
          return { stdout: 'Committed', stderr: '' };
        }
        if (cmd.includes('jj git push')) {
          pushCallCount++;
          const error: any = new Error('Connection refused');
          error.type = 'NETWORK_ERROR';
          throw error;
        }
        if (cmd.includes('git branch')) {
          return { stdout: 'main', stderr: '' };
        }
        if (cmd.includes('jj bookmark set')) {
          return { stdout: 'Set', stderr: '' };
        }
        throw new Error(`Unexpected command: ${cmd}`);
      });

      const file = vscode.Uri.file('/test/file.txt');
      autoCommitService.queueChange(file);

      await clock.tickAsync(60000);

      // リトライ通知が呼ばれたことを確認
      assert.ok(mockNotifications.networkError.called, 'should show network error notification');
    });

    test.skip('リモートに新しい変更がある場合、プル後に再プッシュ', async () => {
      mockExecutor.mockWithChanges();
      mockExecutor.mockCommitSuccess();

      let pushCallCount = 0;
      mockExecutor.executeStub.callsFake(async (cmd: string) => {
        if (cmd.includes('jj status')) {
          return { stdout: 'Working copy changes:\nM file.txt', stderr: '' };
        }
        if (cmd.includes('jj commit')) {
          return { stdout: 'Committed', stderr: '' };
        }
        if (cmd.includes('jj git push')) {
          pushCallCount++;
          if (pushCallCount === 1) {
            const error: any = new Error('Remote has new commits');
            error.type = 'REMOTE_CHANGED';
            throw error;
          }
          return { stdout: 'Pushed', stderr: '' };
        }
        if (cmd.includes('git branch')) {
          return { stdout: 'main', stderr: '' };
        }
        if (cmd.includes('jj bookmark set')) {
          return { stdout: 'Set', stderr: '' };
        }
        throw new Error(`Unexpected command: ${cmd}`);
      });

      const file = vscode.Uri.file('/test/file.txt');
      autoCommitService.queueChange(file);

      await clock.tickAsync(60000);

      // autoPullService.pull()が呼ばれたことを確認
      assert.ok(mockAutoPullService.pull.called, 'should call autoPullService.pull()');

      // プッシュが2回呼ばれたことを確認
      assert.strictEqual(pushCallCount, 2, 'should retry push after pull');
    });

    test.skip('コンフリクト発生時、そのままコミット・プッシュ', async () => {
      // 最初の変更検出でコンフリクトあり
      let statusCallCount = 0;
      let commitCallCount = 0;

      mockExecutor.executeStub.callsFake(async (cmd: string) => {
        if (cmd.includes('jj status')) {
          statusCallCount++;
          if (statusCallCount === 1) {
            // hasUncommittedChanges用
            return { stdout: 'Working copy changes:\nM file.txt', stderr: '' };
          }
          return { stdout: 'No changes', stderr: '' };
        }
        if (cmd.includes('jj commit')) {
          commitCallCount++;
          if (commitCallCount === 1) {
            // 最初のコミットでコンフリクトエラー
            const error: any = new Error('Conflict detected');
            error.type = 'CONFLICT';
            throw error;
          }
          return { stdout: 'Committed with conflict', stderr: '' };
        }
        if (cmd.includes('jj git push')) {
          return { stdout: 'Pushed', stderr: '' };
        }
        if (cmd.includes('git branch')) {
          return { stdout: 'main', stderr: '' };
        }
        if (cmd.includes('jj bookmark set')) {
          return { stdout: 'Set', stderr: '' };
        }
        throw new Error(`Unexpected command: ${cmd}`);
      });

      const file = vscode.Uri.file('/test/file.txt');
      autoCommitService.queueChange(file);

      await clock.tickAsync(60000);

      // コミットが2回呼ばれたことを確認（1回目失敗、2回目成功）
      assert.strictEqual(commitCallCount, 2, 'should commit twice (first fails, second succeeds with conflict)');

      // statusがsyncCompleteWithConflictsになることを確認
      const conflictStateCall = mockStatusBar.setState.getCalls()
        .find((call: any) => call.args[0] === 'syncCompleteWithConflicts');
      assert.ok(conflictStateCall, 'should set state to syncCompleteWithConflicts');
    });

    test('その他のエラー時、キューをクリアして終了', async () => {
      mockExecutor.mockWithChanges();

      mockExecutor.executeStub.callsFake(async (cmd: string) => {
        if (cmd.includes('jj status')) {
          return { stdout: 'Working copy changes:\nM file.txt', stderr: '' };
        }
        if (cmd.includes('jj commit')) {
          throw new Error('Unknown error');
        }
        throw new Error(`Unexpected command: ${cmd}`);
      });

      const file = vscode.Uri.file('/test/file.txt');
      autoCommitService.queueChange(file);

      await clock.tickAsync(60000);

      // エラー通知が呼ばれたことを確認
      assert.ok(mockNotifications.error.called, 'should show error notification');
    });
  });

  suite('dispose', () => {
    test('リソースを正しくクリーンアップ', () => {
      const file = vscode.Uri.file('/test/file.txt');
      autoCommitService.queueChange(file);

      autoCommitService.dispose();

      // タイマーがクリアされたことを確認
      assert.strictEqual(mockScheduler.getActiveTimerCount(), 0);
    });
  });
});
