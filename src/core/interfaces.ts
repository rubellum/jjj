/**
 * コマンド実行インターフェース
 * テスト時にモック可能にするため、child_process依存を抽象化
 */
export interface ICommandExecutor {
  execute(command: string, options?: ExecuteOptions): Promise<ExecuteResult>;
}

export interface ExecuteOptions {
  cwd?: string;
  timeout?: number;
  encoding?: BufferEncoding;
}

export interface ExecuteResult {
  stdout: string;
  stderr: string;
}

/**
 * ファイルシステムインターフェース
 * テスト時にモック可能にするため、fs依存を抽象化
 */
export interface IFileSystem {
  existsSync(path: string): boolean;
  readFile(path: string, encoding: BufferEncoding): Promise<string>;
  readFileSync(path: string, encoding: BufferEncoding): string;
}
