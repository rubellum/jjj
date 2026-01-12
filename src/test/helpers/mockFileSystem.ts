import * as sinon from 'sinon';
import { IFileSystem } from '../../core/interfaces';

/**
 * FileSystemのモック実装
 * テストでファイルシステム操作をモック可能にする
 */
export class MockFileSystem implements IFileSystem {
  public existsSyncStub: sinon.SinonStub;
  public readFileStub: sinon.SinonStub;
  public readFileSyncStub: sinon.SinonStub;
  private files: Map<string, string>;

  constructor() {
    this.existsSyncStub = sinon.stub();
    this.readFileStub = sinon.stub();
    this.readFileSyncStub = sinon.stub();
    this.files = new Map();

    // デフォルト動作を設定
    this.existsSyncStub.callsFake((path: string) => this.files.has(path));
    this.readFileStub.callsFake(async (path: string) => {
      if (!this.files.has(path)) {
        throw new Error(`ENOENT: no such file or directory, open '${path}'`);
      }
      return this.files.get(path)!;
    });
    this.readFileSyncStub.callsFake((path: string) => {
      if (!this.files.has(path)) {
        throw new Error(`ENOENT: no such file or directory, open '${path}'`);
      }
      return this.files.get(path)!;
    });
  }

  existsSync(path: string): boolean {
    return this.existsSyncStub(path);
  }

  async readFile(path: string, encoding: BufferEncoding): Promise<string> {
    return this.readFileStub(path, encoding);
  }

  readFileSync(path: string, encoding: BufferEncoding): string {
    return this.readFileSyncStub(path, encoding);
  }

  /**
   * ファイルを追加
   */
  addFile(path: string, content: string): void {
    this.files.set(path, content);
  }

  /**
   * .gitディレクトリの存在をモック
   */
  mockGitRepo(workspacePath: string): void {
    const gitPath = `${workspacePath}/.git`;
    this.addFile(gitPath, '');
  }

  /**
   * コンフリクトマーカーを含むファイルを追加
   */
  addConflictFile(path: string): void {
    const content = `line 1
<<<<<<< left
left content
=======
right content
>>>>>>> right
line 2`;
    this.addFile(path, content);
  }

  /**
   * モックをリセット
   */
  reset(): void {
    this.existsSyncStub.reset();
    this.readFileStub.reset();
    this.readFileSyncStub.reset();
    this.files.clear();
  }
}
