# DocSync

jujutsuを使用したドキュメント自動同期拡張機能

## 機能

- Git管理フォルダの自動検出
- 編集内容の自動コミット・プッシュ（30-90秒のランダム間隔）
- 他メンバーの変更の自動取得
- 手動同期トリガー（Ctrl+Shift+S / Cmd+Shift+S）
- コンフリクト状態での保存対応

## 前提条件

- **jujutsu (jj)** がインストールされていること
  - インストール方法: https://github.com/martinvonz/jj#installation
  - `jj --version` でバージョンが表示されることを確認してください
- Git管理されたワークスペースを開いていること
- リモートリポジトリが設定されていること

## 推奨設定

自動保存を有効化することを推奨します:

```json
{
  "files.autoSave": "afterDelay",
  "files.autoSaveDelay": 1000
}
```

## 使い方

1. Git管理されたフォルダをCursorで開く
2. 拡張機能が自動的に同期を開始
3. ファイルを編集・保存すると自動的にコミット・プッシュされる
4. 手動同期: Ctrl+Shift+S (Mac: Cmd+Shift+S)

## コマンド

- `DocSync: 今すぐ同期` - 手動で同期を実行
- `DocSync: 自動同期を有効化` - 自動同期を開始
- `DocSync: 自動同期を無効化` - 自動同期を停止

## 設定

- `docsync.autoSyncEnabled` (boolean, デフォルト: true) - 自動同期を有効化
- `docsync.syncIntervalMin` (number, デフォルト: 30) - 同期間隔の最小値（秒）
- `docsync.syncIntervalMax` (number, デフォルト: 90) - 同期間隔の最大値（秒）

## トラブルシューティング

### 「jjが見つかりません」というエラーが表示される

jujutsuがインストールされていないか、PATHに追加されていません。
以下を確認してください:

1. jujutsuがインストールされていること
2. ターミナルで `jj --version` が実行できること
3. Cursorを再起動してPATHを再読み込み

### 同期が動作しない

1. ステータスバーの表示を確認してください
2. Git管理されたフォルダを開いていることを確認してください
3. リモートリポジトリが設定されていることを確認してください

## ライセンス

MIT
