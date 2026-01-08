export const CONSTANTS = {
  // デバウンス設定
  DEBOUNCE_DELAY: 60000, // 1分 = 60000ms（ファイル更新が止まってからコミットまでの待ち時間）

  // タイマー設定（AutoPull用）
  DEFAULT_SYNC_INTERVAL_MIN: 30000, // 30秒
  DEFAULT_SYNC_INTERVAL_MAX: 90000, // 90秒

  // リトライ設定
  MAX_RETRY_COUNT: 3,
  RETRY_DELAY: 30000, // 30秒

  // コマンド実行設定
  COMMAND_TIMEOUT: 30000, // 30秒

  // ステータスバー表示時間
  STATUS_DISPLAY_DURATION: 3000, // 3秒

  // 拡張機能設定
  EXTENSION_ID: 'jjj',

  // コミットメッセージ
  AUTO_COMMIT_PREFIX: 'Auto-sync:',
  CONFLICT_SUFFIX: '(conflict)',
} as const;
