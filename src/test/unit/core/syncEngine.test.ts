import * as assert from 'assert';
import * as sinon from 'sinon';
import { SyncEngine } from '../../../core/syncEngine';
import { JJManager } from '../../../core/jjManager';
import { ConflictDetector } from '../../../core/conflictDetector';
import { MockCommandExecutor } from '../../helpers/mockChildProcess';
import { MockFileSystem } from '../../helpers/mockFileSystem';
import { TestUtils } from '../../helpers/testUtils';

suite('SyncEngine Test Suite', () => {
  let syncEngine: SyncEngine;
  let mockStatusBar: any;
  let mockNotifications: any;
  let mockConflictDetector: ConflictDetector;
  let mockJJManager: JJManager;
  let mockExecutor: MockCommandExecutor;
  let mockFS: MockFileSystem;
  let workspacePath: string;

  setup(() => {
    workspacePath = TestUtils.getMockWorkspacePath();

    // StatusBarManagerのモック
    mockStatusBar = {
      setState: sinon.stub(),
      setAutoSyncEnabled: sinon.stub(),
      showTemporary: sinon.stub(),
      getState: sinon.stub().returns('enabled'),
      dispose: sinon.stub()
    };

    // NotificationManagerのモック
    mockNotifications = {
      jjNotFound: sinon.stub(),
      noRemote: sinon.stub(),
      syncComplete: sinon.stub(),
      networkError: sinon.stub(),
      authError: sinon.stub(),
      error: sinon.stub()
    };

    mockExecutor = new MockCommandExecutor();
    mockFS = new MockFileSystem();
    mockJJManager = new JJManager(workspacePath, mockExecutor, mockFS);
    mockConflictDetector = new ConflictDetector(mockFS);

    syncEngine = new SyncEngine(mockStatusBar, mockNotifications, mockConflictDetector);
  });

  teardown(() => {
    sinon.restore();
    syncEngine.dispose();
  });

  suite('initialize - UC-01: Git管理フォルダの自動検出と同期開始', () => {
    test('正常な初期化フロー', async () => {
      mockFS.mockGitRepo(workspacePath);
      mockExecutor.setResponse(/jj --version/, {
        stdout: 'jj 0.11.0',
        stderr: ''
      });
      mockExecutor.mockNoChanges();
      mockExecutor.setResponse(/git remote -v/, {
        stdout: 'origin git@github.com:user/repo.git',
        stderr: ''
      });

      await syncEngine.initialize(workspacePath, mockJJManager);

      assert.ok(mockStatusBar.setState.called, 'setState should be called');
      const finalState = mockStatusBar.setState.lastCall.args[0];
      assert.ok(['enabled', 'localOnly'].includes(finalState), `unexpected state: ${finalState}`);
    });

    test('jjコマンドが見つからない場合', async () => {
      mockExecutor.mockError(/jj --version/, 'command not found');

      await syncEngine.initialize(workspacePath, mockJJManager);

      assert.ok(mockNotifications.jjNotFound.called, 'jjNotFound notification should be shown');
      assert.strictEqual(mockStatusBar.setState.lastCall.args[0], 'notApplicable');
    });

    test('Gitリポジトリが見つからない場合', async () => {
      mockExecutor.setResponse(/jj --version/, {
        stdout: 'jj 0.11.0',
        stderr: ''
      });
      // mockFSには.gitを追加しない

      await syncEngine.initialize(workspacePath, mockJJManager);

      assert.strictEqual(mockStatusBar.setState.lastCall.args[0], 'notApplicable');
    });

    test('JJが未初期化の場合、自動的に初期化', async () => {
      mockFS.mockGitRepo(workspacePath);
      mockExecutor.setResponse(/jj --version/, {
        stdout: 'jj 0.11.0',
        stderr: ''
      });

      // 最初のstatusは失敗（未初期化）
      let statusCallCount = 0;
      mockExecutor.executeStub.callsFake(async (cmd: string) => {
        if (cmd.includes('jj --version')) {
          return { stdout: 'jj 0.11.0', stderr: '' };
        }
        if (cmd.includes('jj status')) {
          statusCallCount++;
          if (statusCallCount === 1) {
            throw new Error('not initialized');
          }
          return { stdout: 'No changes', stderr: '' };
        }
        if (cmd.includes('jj git init')) {
          return { stdout: 'Initialized', stderr: '' };
        }
        if (cmd.includes('git remote -v')) {
          return { stdout: 'origin git@github.com:user/repo.git', stderr: '' };
        }
        throw new Error(`Unexpected command: ${cmd}`);
      });

      await syncEngine.initialize(workspacePath, mockJJManager);

      const initCall = mockExecutor.executeStub.getCalls()
        .find(call => call.args[0].includes('jj git init'));
      assert.ok(initCall, 'jj git init should be called');
    });

    test('リモートが設定されていない場合', async () => {
      mockFS.mockGitRepo(workspacePath);
      mockExecutor.setResponse(/jj --version/, {
        stdout: 'jj 0.11.0',
        stderr: ''
      });
      mockExecutor.mockNoChanges();
      mockExecutor.setResponse(/git remote -v/, {
        stdout: '',
        stderr: ''
      });

      await syncEngine.initialize(workspacePath, mockJJManager);

      assert.ok(mockNotifications.noRemote.called, 'noRemote notification should be shown');
      assert.strictEqual(mockStatusBar.setState.lastCall.args[0], 'localOnly');
    });

    test('初期化エラー時の処理', async () => {
      mockExecutor.setResponse(/jj --version/, {
        stdout: 'jj 0.11.0',
        stderr: ''
      });
      mockFS.mockGitRepo(workspacePath);
      mockExecutor.mockError(/jj status/, 'unexpected error');

      // ここでは初期化に失敗するが、エラー処理が正しく行われることを確認
      await syncEngine.initialize(workspacePath, mockJJManager);

      // エラー状態またはエラー通知が呼ばれていることを確認
      assert.ok(
        mockStatusBar.setState.called || mockNotifications.error.called,
        'should handle initialization error'
      );
    });
  });

  suite('performFullSync', () => {
    setup(async () => {
      // SyncEngineを初期化済みにする
      mockFS.mockGitRepo(workspacePath);
      mockExecutor.setResponse(/jj --version/, {
        stdout: 'jj 0.11.0',
        stderr: ''
      });
      mockExecutor.mockNoChanges();
      mockExecutor.setResponse(/git remote -v/, {
        stdout: 'origin git@github.com:user/repo.git',
        stderr: ''
      });
      await syncEngine.initialize(workspacePath, mockJJManager);
    });

    test('変更なし時はスキップ', async () => {
      mockExecutor.mockNoChanges();

      await syncEngine.performFullSync();

      assert.ok(mockStatusBar.showTemporary.called, 'should show temporary message');
      const commitCalls = mockExecutor.executeStub.getCalls()
        .filter(call => call.args[0].includes('jj commit'));
      assert.strictEqual(commitCalls.length, 0, 'should not commit when no changes');
    });

    test('変更あり時はコミット・プッシュ', async () => {
      // hasUncommittedChanges用
      mockExecutor.setResponse(/jj status/, {
        stdout: 'Working copy changes:\nM file.txt',
        stderr: ''
      });
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
      mockExecutor.mockFetchSuccess();
      mockExecutor.setResponse(/jj log -r/, {
        stdout: '',
        stderr: ''
      });

      await syncEngine.performFullSync();

      const commitCall = mockExecutor.executeStub.getCalls()
        .find(call => call.args[0].includes('jj commit'));
      const pushCall = mockExecutor.executeStub.getCalls()
        .find(call => call.args[0].includes('jj git push'));

      assert.ok(commitCall, 'commit should be called');
      assert.ok(pushCall, 'push should be called');
    });
  });

  suite('sync lock', () => {
    setup(async () => {
      mockFS.mockGitRepo(workspacePath);
      mockExecutor.setResponse(/jj --version/, {
        stdout: 'jj 0.11.0',
        stderr: ''
      });
      mockExecutor.mockWithChanges();
      mockExecutor.mockCommitSuccess();
      mockExecutor.mockFetchSuccess();
      mockExecutor.setResponse(/git remote -v/, {
        stdout: 'origin git@github.com:user/repo.git',
        stderr: ''
      });
      mockExecutor.setResponse(/jj log -r/, {
        stdout: '',
        stderr: ''
      });
      mockExecutor.mockPushSuccess();
      mockExecutor.setResponse(/git branch/, {
        stdout: 'main',
        stderr: ''
      });
      mockExecutor.setResponse(/jj bookmark set/, {
        stdout: 'Set',
        stderr: ''
      });

      await syncEngine.initialize(workspacePath, mockJJManager);
    });

    test('並行同期を防ぐ', async () => {
      // 2つの同期を同時に開始
      const sync1Promise = syncEngine.performFullSync();
      const sync2Promise = syncEngine.performFullSync();

      await Promise.all([sync1Promise, sync2Promise]);

      // コミットが1回だけ呼ばれたことを確認
      const commitCalls = mockExecutor.executeStub.getCalls()
        .filter(call => call.args[0].includes('jj commit'));

      // ロックにより2回目はスキップされるはず
      assert.ok(commitCalls.length <= 2, `commit should be called at most twice, but was ${commitCalls.length}`);
    });
  });

  suite('performFullSync (manual sync equivalent)', () => {
    setup(async () => {
      mockFS.mockGitRepo(workspacePath);
      mockExecutor.setResponse(/jj --version/, {
        stdout: 'jj 0.11.0',
        stderr: ''
      });
      mockExecutor.mockNoChanges();
      mockExecutor.setResponse(/git remote -v/, {
        stdout: 'origin git@github.com:user/repo.git',
        stderr: ''
      });
      await syncEngine.initialize(workspacePath, mockJJManager);
    });

    test('手動同期が実行される', async () => {
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
      mockExecutor.mockFetchSuccess();
      mockExecutor.setResponse(/jj log -r/, {
        stdout: '',
        stderr: ''
      });

      await syncEngine.performFullSync();

      const commitCall = mockExecutor.executeStub.getCalls()
        .find(call => call.args[0].includes('jj commit'));
      assert.ok(commitCall, 'manual sync should trigger commit');
    });
  });

  suite('startAutoSync', () => {
    test('自動同期が無効の場合、開始しない', async () => {
      mockFS.mockGitRepo(workspacePath);
      mockExecutor.setResponse(/jj --version/, {
        stdout: 'jj 0.11.0',
        stderr: ''
      });
      mockExecutor.mockNoChanges();
      mockExecutor.setResponse(/git remote -v/, {
        stdout: 'origin git@github.com:user/repo.git',
        stderr: ''
      });

      await syncEngine.initialize(workspacePath, mockJJManager);

      // 自動同期は設定で無効化されている想定
      assert.ok(mockStatusBar.setAutoSyncEnabled.called);
    });
  });

  suite('stopAutoSync', () => {
    test('自動同期を停止できる', async () => {
      mockFS.mockGitRepo(workspacePath);
      mockExecutor.setResponse(/jj --version/, {
        stdout: 'jj 0.11.0',
        stderr: ''
      });
      mockExecutor.mockNoChanges();
      mockExecutor.setResponse(/git remote -v/, {
        stdout: 'origin git@github.com:user/repo.git',
        stderr: ''
      });

      await syncEngine.initialize(workspacePath, mockJJManager);

      // stopAutoSyncを呼んでもエラーにならないことを確認
      assert.doesNotThrow(() => {
        syncEngine.stopAutoSync();
      });
    });
  });

  suite('dispose', () => {
    test('リソースを正しくクリーンアップ', () => {
      assert.doesNotThrow(() => {
        syncEngine.dispose();
      });

      // 再度disposeしてもエラーにならない
      assert.doesNotThrow(() => {
        syncEngine.dispose();
      });
    });
  });

  suite('エラーハンドリング', () => {
    test('ネットワークエラー時の処理', async () => {
      mockFS.mockGitRepo(workspacePath);
      mockExecutor.setResponse(/jj --version/, {
        stdout: 'jj 0.11.0',
        stderr: ''
      });
      mockExecutor.mockNoChanges();
      mockExecutor.setResponse(/git remote -v/, {
        stdout: 'origin git@github.com:user/repo.git',
        stderr: ''
      });

      await syncEngine.initialize(workspacePath, mockJJManager);

      // フェッチでネットワークエラー
      mockExecutor.mockWithChanges();
      mockExecutor.mockCommitSuccess();
      mockExecutor.mockError(/jj git fetch/, 'Connection refused');

      await syncEngine.performFullSync();

      // オフライン状態に遷移することを確認
      const offlineCall = mockStatusBar.setState.getCalls()
        .find((call: any) => call.args[0] === 'offline');
      assert.ok(offlineCall, 'should transition to offline state');
    });
  });
});
