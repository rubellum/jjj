/**
 * テストユーティリティ関数
 */
export class TestUtils {
  /**
   * モックワークスペースパスを取得
   */
  static getMockWorkspacePath(): string {
    return '/mock/workspace';
  }

  /**
   * 非同期処理を待機
   */
  static async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * タイマーをフラッシュ（Sinonのfake timers使用時）
   */
  static async flushTimers(clock: any, ms: number): Promise<void> {
    await clock.tickAsync(ms);
  }

  /**
   * テスト用のコミット情報を生成
   */
  static createMockCommitInfo(overrides: Partial<any> = {}): any {
    return {
      commitId: 'abc123def456',
      shortCommitId: 'abc123de',
      author: 'Test User',
      timestamp: new Date('2024-01-01T00:00:00Z'),
      description: 'Test commit message',
      changedFiles: [],
      ...overrides
    };
  }

  /**
   * フィクスチャファイルのパスを取得
   */
  static getFixturePath(filename: string): string {
    const path = require('path');
    return path.join(__dirname, '../fixtures', filename);
  }
}
