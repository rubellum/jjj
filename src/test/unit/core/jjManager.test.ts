import * as assert from 'assert';
import * as sinon from 'sinon';
import { JJManager } from '../../../core/jjManager';
import { MockCommandExecutor } from '../../helpers/mockChildProcess';
import { MockFileSystem } from '../../helpers/mockFileSystem';
import { TestUtils } from '../../helpers/testUtils';

suite('JJManager Test Suite', () => {
  let jjManager: JJManager;
  let mockExecutor: MockCommandExecutor;
  let mockFS: MockFileSystem;
  let workspacePath: string;

  setup(() => {
    workspacePath = TestUtils.getMockWorkspacePath();
    mockExecutor = new MockCommandExecutor();
    mockFS = new MockFileSystem();
    jjManager = new JJManager(workspacePath, mockExecutor, mockFS);
  });

  teardown(() => {
    sinon.restore();
    mockExecutor.reset();
    mockFS.reset();
  });

  suite('isJJAvailable', () => {
    test('jjコマンドが利用可能な場合、trueを返す', async () => {
      mockExecutor.setResponse(/jj --version/, {
        stdout: 'jj 0.11.0',
        stderr: ''
      });

      const result = await jjManager.isJJAvailable();
      assert.strictEqual(result, true);
      assert.strictEqual(mockExecutor.executeStub.callCount, 1);
    });

    test('jjコマンドが利用不可能な場合、falseを返す', async () => {
      mockExecutor.mockError(/jj --version/, 'command not found');

      const result = await jjManager.isJJAvailable();
      assert.strictEqual(result, false);
    });

    test('タイムアウト時にfalseを返す', async () => {
      mockExecutor.executeStub.rejects(new Error('timeout'));

      const result = await jjManager.isJJAvailable();
      assert.strictEqual(result, false);
    });
  });

  suite('detectGitRepo', () => {
    test('.gitディレクトリが存在する場合、trueを返す', async () => {
      mockFS.mockGitRepo(workspacePath);

      const result = await jjManager.detectGitRepo();
      assert.strictEqual(result, true);
    });

    test('.gitディレクトリが存在しない場合、falseを返す', async () => {
      const result = await jjManager.detectGitRepo();
      assert.strictEqual(result, false);
    });

    test('カスタムパスを指定できる', async () => {
      const customPath = '/custom/path';
      mockFS.mockGitRepo(customPath);

      const result = await jjManager.detectGitRepo(customPath);
      assert.strictEqual(result, true);
    });
  });

  suite('isJJInitialized', () => {
    test('jj statusが成功すればtrueを返す', async () => {
      mockExecutor.mockNoChanges();

      const result = await jjManager.isJJInitialized();
      assert.strictEqual(result, true);
    });

    test('jj statusが失敗すればfalseを返す', async () => {
      mockExecutor.mockError(/jj status/, 'not initialized');

      const result = await jjManager.isJJInitialized();
      assert.strictEqual(result, false);
    });
  });

  suite('initializeJJ', () => {
    test('jj git initを実行する', async () => {
      mockExecutor.setResponse(/jj git init/, {
        stdout: 'Initialized',
        stderr: ''
      });

      await assert.doesNotReject(async () => {
        await jjManager.initializeJJ();
      });

      const calls = mockExecutor.executeStub.getCalls();
      const initCall = calls.find(call => call.args[0].includes('jj git init'));
      assert.ok(initCall, 'jj git init should be called');
    });

    test('初期化失敗時にエラーをスロー', async () => {
      mockExecutor.mockError(/jj git init/, 'initialization failed');

      await assert.rejects(async () => {
        await jjManager.initializeJJ();
      });
    });
  });

  suite('checkRemoteConnection', () => {
    test('リモートが設定されている場合、trueを返す', async () => {
      mockExecutor.setResponse(/git remote -v/, {
        stdout: 'origin git@github.com:user/repo.git (fetch)',
        stderr: ''
      });

      const result = await jjManager.checkRemoteConnection();
      assert.strictEqual(result, true);
    });

    test('リモートが設定されていない場合、falseを返す', async () => {
      mockExecutor.setResponse(/git remote -v/, {
        stdout: '',
        stderr: ''
      });

      const result = await jjManager.checkRemoteConnection();
      assert.strictEqual(result, false);
    });

    test('エラー時にfalseを返す', async () => {
      mockExecutor.mockError(/git remote -v/, 'error');

      const result = await jjManager.checkRemoteConnection();
      assert.strictEqual(result, false);
    });
  });

  suite('hasUncommittedChanges', () => {
    test('変更がある場合、trueを返す', async () => {
      mockExecutor.mockWithChanges();

      const result = await jjManager.hasUncommittedChanges();
      assert.strictEqual(result, true);
    });

    test('変更がない場合、falseを返す', async () => {
      mockExecutor.mockNoChanges();

      const result = await jjManager.hasUncommittedChanges();
      assert.strictEqual(result, false);
    });

    test('"Working copy changes:"を含む場合、trueを返す', async () => {
      mockExecutor.setResponse(/jj status/, {
        stdout: 'Working copy changes:\nM file.txt',
        stderr: ''
      });

      const result = await jjManager.hasUncommittedChanges();
      assert.strictEqual(result, true);
    });

    test('エラー時にfalseを返す', async () => {
      mockExecutor.mockError(/jj status/, 'error');

      const result = await jjManager.hasUncommittedChanges();
      assert.strictEqual(result, false);
    });
  });

  suite('commit', () => {
    test('コミットメッセージを正しくエスケープする', async () => {
      mockExecutor.mockCommitSuccess();

      await jjManager.commit('Test "message" with quotes');

      const call = mockExecutor.executeStub.getCall(0);
      assert.ok(call.args[0].includes('\\"message\\"'), 'quotes should be escaped');
    });

    test('コミットが成功する', async () => {
      mockExecutor.mockCommitSuccess();

      await assert.doesNotReject(async () => {
        await jjManager.commit('Test commit');
      });

      assert.strictEqual(mockExecutor.executeStub.callCount, 1);
    });

    test('コミット失敗時にエラーをスロー', async () => {
      mockExecutor.mockError(/jj commit/, 'commit failed');

      await assert.rejects(async () => {
        await jjManager.commit('Test commit');
      });
    });
  });

  suite('push', () => {
    test('ブランチ名が取得できる場合、そのブランチをプッシュ', async () => {
      mockExecutor.setResponse(/git branch --show-current/, {
        stdout: 'main',
        stderr: ''
      });
      mockExecutor.setResponse(/jj bookmark set/, {
        stdout: 'Set bookmark',
        stderr: ''
      });
      mockExecutor.mockPushSuccess();

      await jjManager.push();

      const pushCall = mockExecutor.executeStub.getCalls()
        .find(call => call.args[0].includes('jj git push --bookmark'));
      assert.ok(pushCall, 'push should be called with bookmark');
      assert.ok(pushCall.args[0].includes('main'), 'should push main branch');
    });

    test('Non-tracking remote bookmarkエラー時にリトライ', async () => {
      mockExecutor.setResponse(/git branch --show-current/, {
        stdout: 'feature',
        stderr: ''
      });
      mockExecutor.setResponse(/jj bookmark set/, {
        stdout: 'Set bookmark',
        stderr: ''
      });

      let pushCallCount = 0;
      mockExecutor.executeStub.callsFake(async (cmd: string) => {
        if (cmd.includes('git branch --show-current')) {
          return { stdout: 'feature', stderr: '' };
        }
        if (cmd.includes('jj bookmark set')) {
          return { stdout: 'Set bookmark', stderr: '' };
        }
        if (cmd.includes('jj git push')) {
          pushCallCount++;
          if (pushCallCount === 1) {
            const error: any = new Error('Non-tracking remote bookmark');
            error.message = 'Non-tracking remote bookmark';
            throw error;
          }
          return { stdout: 'Pushed', stderr: '' };
        }
        if (cmd.includes('jj bookmark track')) {
          return { stdout: 'Tracking set', stderr: '' };
        }
        throw new Error(`Unexpected command: ${cmd}`);
      });

      await jjManager.push();

      const trackCall = mockExecutor.executeStub.getCalls()
        .find(call => call.args[0].includes('jj bookmark track'));
      assert.ok(trackCall, 'bookmark track should be called');
      assert.strictEqual(pushCallCount, 2, 'push should be retried');
    });

    test('detached HEAD時はmainブランチを使用', async () => {
      mockExecutor.setResponse(/git branch --show-current/, {
        stdout: '',
        stderr: ''
      });
      mockExecutor.setResponse(/jj bookmark set/, {
        stdout: 'Set bookmark',
        stderr: ''
      });
      mockExecutor.mockPushSuccess();

      await jjManager.push();

      const pushCall = mockExecutor.executeStub.getCalls()
        .find(call => call.args[0].includes('jj git push --bookmark'));
      assert.ok(pushCall?.args[0].includes('main'), 'should use main branch for detached HEAD');
    });
  });

  suite('fetch', () => {
    test('jj git fetchを実行する', async () => {
      mockExecutor.mockFetchSuccess();

      await assert.doesNotReject(async () => {
        await jjManager.fetch();
      });

      const fetchCall = mockExecutor.executeStub.getCalls()
        .find(call => call.args[0].includes('jj git fetch'));
      assert.ok(fetchCall, 'fetch should be called');
    });

    test('fetchエラー時にエラーをスロー', async () => {
      mockExecutor.mockError(/jj git fetch/, 'fetch failed');

      await assert.rejects(async () => {
        await jjManager.fetch();
      });
    });
  });

  suite('hasRemoteChanges', () => {
    test('リモート変更がある場合、trueを返す', async () => {
      mockExecutor.setResponse(/jj log -r "remote_bookmarks\(\)\.\.\@"/, {
        stdout: 'abc123',
        stderr: ''
      });

      const result = await jjManager.hasRemoteChanges();
      assert.strictEqual(result, true);
    });

    test('リモート変更がない場合、falseを返す', async () => {
      mockExecutor.setResponse(/jj log -r "remote_bookmarks\(\)\.\.\@"/, {
        stdout: '',
        stderr: ''
      });

      const result = await jjManager.hasRemoteChanges();
      assert.strictEqual(result, false);
    });

    test('エラー時にfalseを返す', async () => {
      mockExecutor.mockError(/jj log/, 'error');

      const result = await jjManager.hasRemoteChanges();
      assert.strictEqual(result, false);
    });
  });

  suite('merge', () => {
    test('リモート変更を正しくマージ', async () => {
      mockExecutor.setResponse(/git branch --show-current/, {
        stdout: 'main',
        stderr: ''
      });
      mockExecutor.setResponse(/jj log -r main@git/, {
        stdout: 'abc123',
        stderr: ''
      });
      mockExecutor.setResponse(/jj rebase/, {
        stdout: 'Rebased',
        stderr: ''
      });

      await assert.doesNotReject(async () => {
        await jjManager.merge();
      });

      const rebaseCall = mockExecutor.executeStub.getCalls()
        .find(call => call.args[0].includes('jj rebase'));
      assert.ok(rebaseCall, 'rebase should be called');
    });

    test('リモートブランチが存在しない場合、ローカルブランチを使用', async () => {
      mockExecutor.setResponse(/git branch --show-current/, {
        stdout: 'main',
        stderr: ''
      });

      let logCalled = false;
      mockExecutor.executeStub.callsFake(async (cmd: string) => {
        if (cmd.includes('git branch --show-current')) {
          return { stdout: 'main', stderr: '' };
        }
        if (cmd.includes('jj log -r main@git')) {
          logCalled = true;
          throw new Error('branch not found');
        }
        if (cmd.includes('jj rebase')) {
          return { stdout: 'Rebased', stderr: '' };
        }
        throw new Error(`Unexpected command: ${cmd}`);
      });

      await assert.doesNotReject(async () => {
        await jjManager.merge();
      });

      assert.ok(logCalled, 'should try to check remote branch');
    });
  });

  suite('getConflictedFiles', () => {
    test('コンフリクトファイルを正しく抽出', async () => {
      mockExecutor.setResponse(/jj status/, {
        stdout: `Working copy changes:
conflict file1.txt
M file2.txt
conflict file3.md`,
        stderr: ''
      });

      const conflicts = await jjManager.getConflictedFiles();

      assert.strictEqual(conflicts.length, 2);
      assert.ok(conflicts[0].includes('file1.txt'));
      assert.ok(conflicts[1].includes('file3.md'));
    });

    test('コンフリクトがない場合、空配列を返す', async () => {
      mockExecutor.mockNoChanges();

      const conflicts = await jjManager.getConflictedFiles();
      assert.strictEqual(conflicts.length, 0);
    });

    test('エラー時に空配列を返す', async () => {
      mockExecutor.mockError(/jj status/, 'error');

      const conflicts = await jjManager.getConflictedFiles();
      assert.strictEqual(conflicts.length, 0);
    });
  });

  suite('getCommitHistory', () => {
    test('コミット履歴を正しく解析', async () => {
      mockExecutor.setResponse(/jj log/, {
        stdout: `abc123\tJohn Doe\t2024-01-01T00:00:00Z\tTest commit 1
def456\tJane Smith\t2024-01-02T00:00:00Z\tTest commit 2`,
        stderr: ''
      });

      const commits = await jjManager.getCommitHistory(20, 0);

      assert.strictEqual(commits.length, 2);
      assert.strictEqual(commits[0].commitId, 'abc123');
      assert.strictEqual(commits[0].author, 'John Doe');
      assert.strictEqual(commits[0].description, 'Test commit 1');
      assert.strictEqual(commits[1].commitId, 'def456');
    });

    test('(no description set)のコミットをスキップ', async () => {
      mockExecutor.setResponse(/jj log/, {
        stdout: `abc123\tJohn Doe\t2024-01-01T00:00:00Z\t(no description set)
def456\tJane Smith\t2024-01-02T00:00:00Z\tValid commit`,
        stderr: ''
      });

      const commits = await jjManager.getCommitHistory(20, 0);

      assert.strictEqual(commits.length, 1);
      assert.strictEqual(commits[0].commitId, 'def456');
    });

    test('limitとoffsetが正しく適用される', async () => {
      mockExecutor.setResponse(/jj log.*--limit 15/, {
        stdout: `abc123\tJohn Doe\t2024-01-01T00:00:00Z\tCommit 1
def456\tJane Smith\t2024-01-02T00:00:00Z\tCommit 2
ghi789\tBob Johnson\t2024-01-03T00:00:00Z\tCommit 3`,
        stderr: ''
      });

      const commits = await jjManager.getCommitHistory(10, 5);

      assert.ok(mockExecutor.executeStub.calledOnce);
      const call = mockExecutor.executeStub.getCall(0);
      assert.ok(call.args[0].includes('--limit 15'), 'should request limit+offset commits');
    });
  });

  suite('getChangedFiles', () => {
    test('変更されたファイルを正しく抽出', async () => {
      mockExecutor.setResponse(/jj diff/, {
        stdout: `M  README.md
A  new-file.txt
D  old-file.txt`,
        stderr: ''
      });

      const files = await jjManager.getChangedFiles('abc123');

      assert.strictEqual(files.length, 3);
      assert.ok(files.includes('README.md'));
      assert.ok(files.includes('new-file.txt'));
      assert.ok(files.includes('old-file.txt'));
    });

    test('変更がない場合、空配列を返す', async () => {
      mockExecutor.setResponse(/jj diff/, {
        stdout: '',
        stderr: ''
      });

      const files = await jjManager.getChangedFiles('abc123');
      assert.strictEqual(files.length, 0);
    });

    test('エラー時に空配列を返す', async () => {
      mockExecutor.mockError(/jj diff/, 'error');

      const files = await jjManager.getChangedFiles('abc123');
      assert.strictEqual(files.length, 0);
    });
  });

  suite('getFileHistory', () => {
    test('特定ファイルの履歴を取得', async () => {
      mockExecutor.setResponse(/jj log.*README\.md/, {
        stdout: `abc123\tJohn Doe\t2024-01-01T00:00:00Z\tUpdate README
def456\tJane Smith\t2024-01-02T00:00:00Z\tFix typo`,
        stderr: ''
      });

      const commits = await jjManager.getFileHistory('README.md', 20);

      assert.strictEqual(commits.length, 2);
      assert.strictEqual(commits[0].description, 'Update README');
      assert.strictEqual(commits[1].description, 'Fix typo');
      assert.strictEqual(commits[0].changedFiles[0], 'README.md');
    });

    test('limitが正しく適用される', async () => {
      mockExecutor.setResponse(/jj log.*--limit 10/, {
        stdout: `abc123\tJohn Doe\t2024-01-01T00:00:00Z\tCommit`,
        stderr: ''
      });

      await jjManager.getFileHistory('file.txt', 10);

      const call = mockExecutor.executeStub.getCall(0);
      assert.ok(call.args[0].includes('--limit 10'));
    });
  });

  suite('getWorkspacePath', () => {
    test('ワークスペースパスを取得', () => {
      const path = jjManager.getWorkspacePath();
      assert.strictEqual(path, workspacePath);
    });
  });
});
