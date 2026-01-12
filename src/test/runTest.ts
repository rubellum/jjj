import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
  try {
    // 拡張機能のルートディレクトリ
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');

    // テストスイートのエントリーポイント
    const extensionTestsPath = path.resolve(__dirname, './index');

    console.log('Extension development path:', extensionDevelopmentPath);
    console.log('Extension tests path:', extensionTestsPath);

    // VSCodeテストを実行
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        '--disable-extensions',
        '--disable-workspace-trust'
      ]
    });
  } catch (err) {
    console.error('Failed to run tests:', err);
    process.exit(1);
  }
}

main();
