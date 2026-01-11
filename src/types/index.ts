export type SyncState =
  | 'notApplicable'
  | 'enabled'
  | 'offline'
  | 'syncing'
  | 'syncComplete'
  | 'syncCompleteWithConflicts'
  | 'localOnly';

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

/**
 * コンフリクトファイル情報
 */
export interface ConflictFile {
  filePath: string;          // 絶対パス
  relativePath: string;      // ワークスペース相対パス
  conflictCount: number;     // コンフリクト箇所数
  conflicts: ConflictInfo[]; // 詳細な位置情報
}

/**
 * コミット情報
 */
export interface CommitInfo {
  commitId: string;          // フルコミットID
  shortCommitId: string;     // 短縮コミットID（8文字）
  author: string;            // 作者名
  timestamp: Date;           // コミット日時
  description: string;       // コミットメッセージ
  changedFiles: string[];    // 変更ファイルリスト
}
