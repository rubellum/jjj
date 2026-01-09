import { ConflictFile } from '../types';

/**
 * コンフリクト解消用のプロンプトを生成
 * @param conflictFile コンフリクトファイル情報
 * @returns AI用プロンプト文字列
 */
export function generateConflictResolutionPrompt(conflictFile: ConflictFile): string {
  const { relativePath, conflictCount, conflicts } = conflictFile;

  // コンフリクト箇所の詳細を整形
  const conflictDetails = conflicts.map((conflict, index) => {
    return `  ${index + 1}. ${conflict.startLine}行目〜${conflict.endLine}行目`;
  }).join('\n');

  // プロンプトを構築
  const prompt = `以下のファイルにコンフリクトがあります。解消してください。

ファイル: ${relativePath}
コンフリクト箇所数: ${conflictCount}件

コンフリクト箇所:
${conflictDetails}

両者の変更内容を確認し、適切な解消案を提示してください。
変更内容が両立できる場合は両方を活かし、
矛盾する場合は理由を説明した上で推奨案を示してください。`;

  return prompt;
}

/**
 * 複数ファイルのコンフリクト解消プロンプトを生成
 * @param conflictFiles コンフリクトファイル配列
 * @returns AI用プロンプト文字列
 */
export function generateMultipleConflictPrompt(conflictFiles: ConflictFile[]): string {
  if (conflictFiles.length === 0) {
    return 'コンフリクトはありません。';
  }

  if (conflictFiles.length === 1) {
    return generateConflictResolutionPrompt(conflictFiles[0]);
  }

  // 複数ファイルの場合
  const totalConflicts = conflictFiles.reduce((sum, cf) => sum + cf.conflictCount, 0);
  const fileList = conflictFiles.map(cf => {
    return `- ${cf.relativePath} (${cf.conflictCount}件)`;
  }).join('\n');

  const prompt = `複数のファイルにコンフリクトがあります。

合計: ${conflictFiles.length}ファイル、${totalConflicts}件のコンフリクト

ファイル一覧:
${fileList}

各ファイルを順番に確認し、適切な解消案を提示してください。`;

  return prompt;
}
