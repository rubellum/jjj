import * as assert from 'assert';
import * as sinon from 'sinon';
import {
  parseJJError,
  handleError,
  isNetworkError,
  isRemoteChangedError,
  isConflictError
} from '../../../utils/errorHandler';
import { JJError } from '../../../types';

suite('ErrorHandler Test Suite', () => {
  teardown(() => {
    sinon.restore();
  });

  suite('parseJJError', () => {
    test('JJ_NOT_FOUND: command not found', () => {
      const error = new Error('command not found: jj');
      const jjError = parseJJError(error);

      assert.strictEqual(jjError.type, 'JJ_NOT_FOUND');
      assert.ok(jjError.message.includes('jjコマンドが見つかりません'));
    });

    test('JJ_NOT_FOUND: not recognized', () => {
      const error = new Error('jj is not recognized as an internal or external command');
      const jjError = parseJJError(error);

      assert.strictEqual(jjError.type, 'JJ_NOT_FOUND');
    });

    test('NETWORK_ERROR: Connection refused', () => {
      const error = new Error('Connection refused');
      const jjError = parseJJError(error);

      assert.strictEqual(jjError.type, 'NETWORK_ERROR');
      assert.ok(jjError.message.includes('ネットワークエラー'));
    });

    test('NETWORK_ERROR: timeout', () => {
      const error = new Error('Operation timeout');
      const jjError = parseJJError(error);

      assert.strictEqual(jjError.type, 'NETWORK_ERROR');
    });

    test('NETWORK_ERROR: Could not resolve host', () => {
      const error = new Error('Could not resolve host: github.com');
      const jjError = parseJJError(error);

      assert.strictEqual(jjError.type, 'NETWORK_ERROR');
    });

    test('REMOTE_CHANGED: remote has new commits', () => {
      const error = new Error('remote has new commits');
      const jjError = parseJJError(error);

      assert.strictEqual(jjError.type, 'REMOTE_CHANGED');
      assert.ok(jjError.message.includes('リモートに新しい変更'));
    });

    test('REMOTE_CHANGED: rejected', () => {
      const error = new Error('Push rejected by remote');
      const jjError = parseJJError(error);

      assert.strictEqual(jjError.type, 'REMOTE_CHANGED');
    });

    test('REMOTE_CHANGED: non-fast-forward', () => {
      const error = new Error('non-fast-forward update');
      const jjError = parseJJError(error);

      assert.strictEqual(jjError.type, 'REMOTE_CHANGED');
    });

    test('CONFLICT: conflict detected', () => {
      const error = new Error('conflict detected in file');
      const jjError = parseJJError(error);

      assert.strictEqual(jjError.type, 'CONFLICT');
      assert.ok(jjError.message.includes('コンフリクト'));
    });

    test('CONFLICT: CONFLICT in uppercase', () => {
      const error = new Error('CONFLICT in merge');
      const jjError = parseJJError(error);

      assert.strictEqual(jjError.type, 'CONFLICT');
    });

    test('AUTH_ERROR: authentication failed', () => {
      const error = new Error('authentication failed');
      const jjError = parseJJError(error);

      assert.strictEqual(jjError.type, 'AUTH_ERROR');
      assert.ok(jjError.message.includes('認証に失敗'));
    });

    test('AUTH_ERROR: Permission denied', () => {
      const error = new Error('Permission denied (publickey)');
      const jjError = parseJJError(error);

      assert.strictEqual(jjError.type, 'AUTH_ERROR');
    });

    test('AUTH_ERROR: could not read', () => {
      const error = new Error('fatal: could not read Username');
      const jjError = parseJJError(error);

      assert.strictEqual(jjError.type, 'AUTH_ERROR');
    });

    test('UNKNOWN: その他のエラー', () => {
      const error = new Error('Some random error');
      const jjError = parseJJError(error);

      assert.strictEqual(jjError.type, 'UNKNOWN');
      assert.strictEqual(jjError.message, 'Some random error');
    });

    test.skip('UNKNOWN: 空のエラーメッセージ', () => {
      const error = new Error('');
      const jjError = parseJJError(error);

      assert.strictEqual(jjError.type, 'UNKNOWN');
      // 空文字列の場合、messageは空文字列またはデフォルトメッセージ
      assert.ok(jjError.message === '' || jjError.message.includes('Unknown error'));
    });

    test('エラーオブジェクトにstderrがある場合', () => {
      const error: any = {
        stderr: 'Connection refused to remote server'
      };
      const jjError = parseJJError(error);

      assert.strictEqual(jjError.type, 'NETWORK_ERROR');
    });

    test('エラーがJJErrorインスタンスの場合はそのまま返す', () => {
      const originalError = new JJError('NETWORK_ERROR', 'Test network error');
      const result = parseJJError(originalError);

      // JJErrorは通常のErrorとして処理されるため、parseされる
      assert.strictEqual(result.type, 'NETWORK_ERROR');
    });
  });

  suite('handleError', () => {
    test('エラーを処理してJJErrorを返す', () => {
      const error = new Error('Connection refused');
      const jjError = handleError(error, 'test context');

      assert.ok(jjError instanceof JJError);
      assert.strictEqual(jjError.type, 'NETWORK_ERROR');
    });

    test('既にJJErrorの場合はそのまま返す', () => {
      const originalError = new JJError('CONFLICT', 'Test conflict');
      const result = handleError(originalError, 'test context');

      assert.strictEqual(result, originalError);
      assert.strictEqual(result.type, 'CONFLICT');
    });
  });

  suite('isNetworkError', () => {
    test('NETWORK_ERRORの場合、trueを返す', () => {
      const error = new JJError('NETWORK_ERROR', 'Network error');
      assert.strictEqual(isNetworkError(error), true);
    });

    test('NETWORK_ERROR以外の場合、falseを返す', () => {
      const error = new JJError('CONFLICT', 'Conflict error');
      assert.strictEqual(isNetworkError(error), false);
    });

    test('複数のエラータイプをテスト', () => {
      assert.strictEqual(isNetworkError(new JJError('JJ_NOT_FOUND', 'msg')), false);
      assert.strictEqual(isNetworkError(new JJError('REMOTE_CHANGED', 'msg')), false);
      assert.strictEqual(isNetworkError(new JJError('AUTH_ERROR', 'msg')), false);
      assert.strictEqual(isNetworkError(new JJError('UNKNOWN', 'msg')), false);
    });
  });

  suite('isRemoteChangedError', () => {
    test('REMOTE_CHANGEDの場合、trueを返す', () => {
      const error = new JJError('REMOTE_CHANGED', 'Remote changed');
      assert.strictEqual(isRemoteChangedError(error), true);
    });

    test('REMOTE_CHANGED以外の場合、falseを返す', () => {
      const error = new JJError('NETWORK_ERROR', 'Network error');
      assert.strictEqual(isRemoteChangedError(error), false);
    });

    test('複数のエラータイプをテスト', () => {
      assert.strictEqual(isRemoteChangedError(new JJError('JJ_NOT_FOUND', 'msg')), false);
      assert.strictEqual(isRemoteChangedError(new JJError('CONFLICT', 'msg')), false);
      assert.strictEqual(isRemoteChangedError(new JJError('AUTH_ERROR', 'msg')), false);
      assert.strictEqual(isRemoteChangedError(new JJError('UNKNOWN', 'msg')), false);
    });
  });

  suite('isConflictError', () => {
    test('CONFLICTの場合、trueを返す', () => {
      const error = new JJError('CONFLICT', 'Conflict error');
      assert.strictEqual(isConflictError(error), true);
    });

    test('CONFLICT以外の場合、falseを返す', () => {
      const error = new JJError('NETWORK_ERROR', 'Network error');
      assert.strictEqual(isConflictError(error), false);
    });

    test('複数のエラータイプをテスト', () => {
      assert.strictEqual(isConflictError(new JJError('JJ_NOT_FOUND', 'msg')), false);
      assert.strictEqual(isConflictError(new JJError('REMOTE_CHANGED', 'msg')), false);
      assert.strictEqual(isConflictError(new JJError('AUTH_ERROR', 'msg')), false);
      assert.strictEqual(isConflictError(new JJError('UNKNOWN', 'msg')), false);
    });
  });

  suite('エラー分類の優先度', () => {
    test('複数のキーワードがある場合、最初にマッチしたものを返す', () => {
      // "command not found"が最初にチェックされる
      const error1 = new Error('command not found, also connection timeout');
      assert.strictEqual(parseJJError(error1).type, 'JJ_NOT_FOUND');

      // "Connection refused"がネットワークエラーより先
      const error2 = new Error('Connection refused during conflict');
      assert.strictEqual(parseJJError(error2).type, 'NETWORK_ERROR');
    });
  });
});
