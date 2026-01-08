import { JJError, JJErrorType } from '../types';
import { logger } from './logger';

export function parseJJError(error: any): JJError {
  const message = error.message || error.stderr || error.toString();

  // jjコマンドが見つからない
  if (message.includes('command not found') || message.includes('not recognized')) {
    return new JJError('JJ_NOT_FOUND', 'jjコマンドが見つかりません。jujutsuがインストールされているか確認してください。');
  }

  // ネットワークエラー
  if (message.includes('Connection refused') ||
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('Could not resolve host')) {
    return new JJError('NETWORK_ERROR', 'ネットワークエラーが発生しました。接続を確認してください。');
  }

  // リモートに新しい変更がある
  if (message.includes('remote has new commits') ||
      message.includes('rejected') ||
      message.includes('non-fast-forward')) {
    return new JJError('REMOTE_CHANGED', 'リモートに新しい変更があります。');
  }

  // コンフリクト
  if (message.includes('conflict') || message.includes('CONFLICT')) {
    return new JJError('CONFLICT', 'コンフリクトが発生しました。');
  }

  // 認証エラー
  if (message.includes('authentication failed') ||
      message.includes('Permission denied') ||
      message.includes('fatal: could not read')) {
    return new JJError('AUTH_ERROR', '認証に失敗しました。認証情報を確認してください。');
  }

  // その他のエラー
  return new JJError('UNKNOWN', message || 'Unknown error occurred');
}

export function handleError(error: any, context: string): JJError {
  const jjError = error instanceof JJError ? error : parseJJError(error);

  logger.error(`Error in ${context}: ${jjError.message}`, jjError);

  return jjError;
}

export function isNetworkError(error: JJError): boolean {
  return error.type === 'NETWORK_ERROR';
}

export function isRemoteChangedError(error: JJError): boolean {
  return error.type === 'REMOTE_CHANGED';
}

export function isConflictError(error: JJError): boolean {
  return error.type === 'CONFLICT';
}
