export type SyncState =
  | '対象外'
  | '有効'
  | 'オフライン'
  | '同期中'
  | '同期完了'
  | '同期完了（コンフリクトあり）'
  | 'ローカルのみ';

export type JJErrorType =
  | 'NETWORK_ERROR'
  | 'REMOTE_CHANGED'
  | 'CONFLICT'
  | 'AUTH_ERROR'
  | 'JJ_NOT_FOUND'
  | 'UNKNOWN';

export class JJError extends Error {
  constructor(
    public type: JJErrorType,
    message: string
  ) {
    super(message);
    this.name = 'JJError';
  }
}

export interface ConflictInfo {
  filePath: string;
  startLine: number;
  endLine: number;
}

export interface SyncConfig {
  autoSyncEnabled: boolean;
  syncIntervalMin: number;
  syncIntervalMax: number;
}
