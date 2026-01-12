import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import { IFileSystem } from './interfaces';

/**
 * ファイルシステムの実装クラス
 * fsモジュールをラップし、IFileSystemインターフェースを実装
 */
export class FileSystemAdapter implements IFileSystem {
  existsSync(path: string): boolean {
    return fs.existsSync(path);
  }

  async readFile(path: string, encoding: BufferEncoding): Promise<string> {
    return await fsPromises.readFile(path, encoding);
  }

  readFileSync(path: string, encoding: BufferEncoding): string {
    return fs.readFileSync(path, encoding);
  }
}
