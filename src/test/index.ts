import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';

export function run(): Promise<void> {
  // Mochaインスタンスを作成
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    timeout: 20000
  });

  const testsRoot = path.resolve(__dirname, '..');

  return new Promise((resolve, reject) => {
    // テストファイルを検索
    glob('**/**.test.js', { cwd: testsRoot })
      .then((files) => {
        // テストファイルをMochaに追加
        files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

        try {
          // テストを実行
          mocha.run((failures: number) => {
            if (failures > 0) {
              reject(new Error(`${failures} tests failed.`));
            } else {
              resolve();
            }
          });
        } catch (err) {
          console.error(err);
          reject(err);
        }
      })
      .catch((err) => {
        reject(err);
      });
  });
}
