import { ConflictInfo } from '../types';
import { logger } from '../utils/logger';
import { IFileSystem } from './interfaces';
import { FileSystemAdapter } from './fileSystemAdapter';

export class ConflictDetector {
  private fileSystem: IFileSystem;

  constructor(fileSystem?: IFileSystem) {
    this.fileSystem = fileSystem || new FileSystemAdapter();
  }

  /**
   * ファイル内のコンフリクトマーカーを検出
   */
  async detectConflictsInFile(filePath: string): Promise<ConflictInfo[]> {
    try {
      const content = await this.fileSystem.readFile(filePath, 'utf8');
      return this.detectConflictsInContent(filePath, content);
    } catch (error) {
      logger.error(`Failed to read file for conflict detection: ${filePath}`, error as Error);
      return [];
    }
  }

  /**
   * コンテンツ内のコンフリクトマーカーを検出
   */
  detectConflictsInContent(filePath: string, content: string): ConflictInfo[] {
    const lines = content.split('\n');
    const conflicts: ConflictInfo[] = [];

    let inConflict = false;
    let startLine = -1;

    lines.forEach((line, index) => {
      if (line.startsWith('<<<<<<<')) {
        inConflict = true;
        startLine = index + 1; // 1-based line number
      } else if (line.startsWith('>>>>>>>') && inConflict) {
        conflicts.push({
          filePath,
          startLine,
          endLine: index + 1
        });
        inConflict = false;
      }
    });

    if (conflicts.length > 0) {
      logger.info(`Detected ${conflicts.length} conflict(s) in ${filePath}`);
    }

    return conflicts;
  }

  /**
   * コンテンツにコンフリクトマーカーが含まれるかチェック
   */
  hasConflictMarkers(content: string): boolean {
    // コンフリクトマーカーのパターン: <<<<<<<, =======, >>>>>>>
    const conflictPattern = /^<{7}\s|^={7}\s|^>{7}\s/m;
    return conflictPattern.test(content);
  }

  /**
   * ファイルにコンフリクトマーカーが含まれるかチェック
   */
  async hasConflictMarkersInFile(filePath: string): Promise<boolean> {
    try {
      const content = await this.fileSystem.readFile(filePath, 'utf8');
      return this.hasConflictMarkers(content);
    } catch (error) {
      logger.error(`Failed to check conflict markers in file: ${filePath}`, error as Error);
      return false;
    }
  }

  /**
   * 複数ファイルのコンフリクトを検出
   */
  async detectConflictsInFiles(filePaths: string[]): Promise<ConflictInfo[]> {
    const allConflicts: ConflictInfo[] = [];

    for (const filePath of filePaths) {
      const conflicts = await this.detectConflictsInFile(filePath);
      allConflicts.push(...conflicts);
    }

    return allConflicts;
  }
}
