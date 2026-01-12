import * as assert from 'assert';
import {
  generateConflictResolutionPrompt,
  generateMultipleConflictPrompt
} from '../../../utils/conflictPrompt';
import { ConflictFile } from '../../../types';

suite('ConflictPrompt Test Suite', () => {
  suite('generateConflictResolutionPrompt', () => {
    test('単一コンフリクトのプロンプト生成', () => {
      const conflictFile: ConflictFile = {
        filePath: '/workspace/src/test.ts',
        relativePath: 'src/test.ts',
        conflictCount: 1,
        conflicts: [
          {
            filePath: '/workspace/src/test.ts',
            startLine: 10,
            endLine: 15
          }
        ]
      };

      const prompt = generateConflictResolutionPrompt(conflictFile);

      assert.ok(prompt.includes('src/test.ts'));
      assert.ok(prompt.includes('1件'));
      assert.ok(prompt.includes('10行目〜15行目'));
      assert.ok(prompt.includes('コンフリクトがあります'));
    });

    test('複数コンフリクトのプロンプト生成', () => {
      const conflictFile: ConflictFile = {
        filePath: '/workspace/src/app.ts',
        relativePath: 'src/app.ts',
        conflictCount: 3,
        conflicts: [
          {
            filePath: '/workspace/src/app.ts',
            startLine: 5,
            endLine: 8
          },
          {
            filePath: '/workspace/src/app.ts',
            startLine: 20,
            endLine: 25
          },
          {
            filePath: '/workspace/src/app.ts',
            startLine: 40,
            endLine: 45
          }
        ]
      };

      const prompt = generateConflictResolutionPrompt(conflictFile);

      assert.ok(prompt.includes('src/app.ts'));
      assert.ok(prompt.includes('3件'));
      assert.ok(prompt.includes('5行目〜8行目'));
      assert.ok(prompt.includes('20行目〜25行目'));
      assert.ok(prompt.includes('40行目〜45行目'));
    });

    test('プロンプトに必要な要素が含まれる', () => {
      const conflictFile: ConflictFile = {
        filePath: '/workspace/README.md',
        relativePath: 'README.md',
        conflictCount: 1,
        conflicts: [
          {
            filePath: '/workspace/README.md',
            startLine: 1,
            endLine: 3
          }
        ]
      };

      const prompt = generateConflictResolutionPrompt(conflictFile);

      // 必須要素をチェック
      assert.ok(prompt.includes('ファイル:'));
      assert.ok(prompt.includes('コンフリクト箇所数:'));
      assert.ok(prompt.includes('コンフリクト箇所:'));
      assert.ok(prompt.includes('解消してください'));
    });

    test('コンフリクト箇所が番号付きリストで表示される', () => {
      const conflictFile: ConflictFile = {
        filePath: '/workspace/test.txt',
        relativePath: 'test.txt',
        conflictCount: 2,
        conflicts: [
          {
            filePath: '/workspace/test.txt',
            startLine: 1,
            endLine: 2
          },
          {
            filePath: '/workspace/test.txt',
            startLine: 10,
            endLine: 12
          }
        ]
      };

      const prompt = generateConflictResolutionPrompt(conflictFile);

      assert.ok(prompt.includes('  1. 1行目〜2行目'));
      assert.ok(prompt.includes('  2. 10行目〜12行目'));
    });
  });

  suite('generateMultipleConflictPrompt', () => {
    test('コンフリクトがない場合', () => {
      const prompt = generateMultipleConflictPrompt([]);

      assert.strictEqual(prompt, 'コンフリクトはありません。');
    });

    test('1ファイルの場合、単一プロンプトを生成', () => {
      const conflictFiles: ConflictFile[] = [
        {
          filePath: '/workspace/src/test.ts',
          relativePath: 'src/test.ts',
          conflictCount: 1,
          conflicts: [
            {
              filePath: '/workspace/src/test.ts',
              startLine: 10,
              endLine: 15
            }
          ]
        }
      ];

      const prompt = generateMultipleConflictPrompt(conflictFiles);

      // 単一ファイル用のプロンプトが返される
      assert.ok(prompt.includes('src/test.ts'));
      assert.ok(prompt.includes('1件'));
      assert.ok(!prompt.includes('複数のファイル'));
    });

    test('複数ファイルのプロンプト生成', () => {
      const conflictFiles: ConflictFile[] = [
        {
          filePath: '/workspace/src/app.ts',
          relativePath: 'src/app.ts',
          conflictCount: 2,
          conflicts: [
            { filePath: '/workspace/src/app.ts', startLine: 5, endLine: 8 },
            { filePath: '/workspace/src/app.ts', startLine: 20, endLine: 25 }
          ]
        },
        {
          filePath: '/workspace/src/utils.ts',
          relativePath: 'src/utils.ts',
          conflictCount: 1,
          conflicts: [
            { filePath: '/workspace/src/utils.ts', startLine: 10, endLine: 12 }
          ]
        },
        {
          filePath: '/workspace/README.md',
          relativePath: 'README.md',
          conflictCount: 3,
          conflicts: [
            { filePath: '/workspace/README.md', startLine: 1, endLine: 2 },
            { filePath: '/workspace/README.md', startLine: 5, endLine: 8 },
            { filePath: '/workspace/README.md', startLine: 15, endLine: 20 }
          ]
        }
      ];

      const prompt = generateMultipleConflictPrompt(conflictFiles);

      assert.ok(prompt.includes('複数のファイルにコンフリクトがあります'));
      assert.ok(prompt.includes('3ファイル'));
      assert.ok(prompt.includes('6件のコンフリクト'));
      assert.ok(prompt.includes('src/app.ts (2件)'));
      assert.ok(prompt.includes('src/utils.ts (1件)'));
      assert.ok(prompt.includes('README.md (3件)'));
    });

    test('合計コンフリクト数が正しく計算される', () => {
      const conflictFiles: ConflictFile[] = [
        {
          filePath: '/workspace/file1.ts',
          relativePath: 'file1.ts',
          conflictCount: 5,
          conflicts: []
        },
        {
          filePath: '/workspace/file2.ts',
          relativePath: 'file2.ts',
          conflictCount: 3,
          conflicts: []
        },
        {
          filePath: '/workspace/file3.ts',
          relativePath: 'file3.ts',
          conflictCount: 2,
          conflicts: []
        }
      ];

      const prompt = generateMultipleConflictPrompt(conflictFiles);

      assert.ok(prompt.includes('10件のコンフリクト'));
    });

    test('ファイル一覧がリスト形式で表示される', () => {
      const conflictFiles: ConflictFile[] = [
        {
          filePath: '/workspace/a.ts',
          relativePath: 'a.ts',
          conflictCount: 1,
          conflicts: []
        },
        {
          filePath: '/workspace/b.ts',
          relativePath: 'b.ts',
          conflictCount: 2,
          conflicts: []
        }
      ];

      const prompt = generateMultipleConflictPrompt(conflictFiles);

      assert.ok(prompt.includes('- a.ts (1件)'));
      assert.ok(prompt.includes('- b.ts (2件)'));
    });
  });

  suite('プロンプトフォーマット', () => {
    test('単一ファイルプロンプトに適切な指示が含まれる', () => {
      const conflictFile: ConflictFile = {
        filePath: '/workspace/test.ts',
        relativePath: 'test.ts',
        conflictCount: 1,
        conflicts: [
          { filePath: '/workspace/test.ts', startLine: 1, endLine: 2 }
        ]
      };

      const prompt = generateConflictResolutionPrompt(conflictFile);

      assert.ok(prompt.includes('両者の変更内容を確認'));
      assert.ok(prompt.includes('適切な解消案を提示'));
      assert.ok(prompt.includes('推奨案を示してください'));
    });

    test('複数ファイルプロンプトに適切な指示が含まれる', () => {
      const conflictFiles: ConflictFile[] = [
        {
          filePath: '/workspace/file1.ts',
          relativePath: 'file1.ts',
          conflictCount: 1,
          conflicts: []
        },
        {
          filePath: '/workspace/file2.ts',
          relativePath: 'file2.ts',
          conflictCount: 1,
          conflicts: []
        }
      ];

      const prompt = generateMultipleConflictPrompt(conflictFiles);

      assert.ok(prompt.includes('各ファイルを順番に確認'));
      assert.ok(prompt.includes('適切な解消案を提示'));
    });
  });

  suite('エッジケース', () => {
    test('非常に多くのコンフリクトがあるファイル', () => {
      const conflicts = [];
      for (let i = 0; i < 100; i++) {
        conflicts.push({
          filePath: '/workspace/large.ts',
          startLine: i * 10,
          endLine: i * 10 + 5
        });
      }

      const conflictFile: ConflictFile = {
        filePath: '/workspace/large.ts',
        relativePath: 'large.ts',
        conflictCount: 100,
        conflicts: conflicts
      };

      const prompt = generateConflictResolutionPrompt(conflictFile);

      assert.ok(prompt.includes('100件'));
      assert.ok(prompt.includes('100. 990行目〜995行目'));
    });

    test('パスに特殊文字が含まれるファイル', () => {
      const conflictFile: ConflictFile = {
        filePath: '/workspace/src/特殊/ファイル名.ts',
        relativePath: 'src/特殊/ファイル名.ts',
        conflictCount: 1,
        conflicts: [
          { filePath: '/workspace/src/特殊/ファイル名.ts', startLine: 1, endLine: 2 }
        ]
      };

      const prompt = generateConflictResolutionPrompt(conflictFile);

      assert.ok(prompt.includes('src/特殊/ファイル名.ts'));
    });

    test('同じ行でコンフリクトが発生', () => {
      const conflictFile: ConflictFile = {
        filePath: '/workspace/test.ts',
        relativePath: 'test.ts',
        conflictCount: 1,
        conflicts: [
          { filePath: '/workspace/test.ts', startLine: 10, endLine: 10 }
        ]
      };

      const prompt = generateConflictResolutionPrompt(conflictFile);

      assert.ok(prompt.includes('10行目〜10行目'));
    });
  });
});
