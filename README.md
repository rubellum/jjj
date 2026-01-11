# Jujutsu Journaling (jjj)

A VS Code extension that automatically tracks document change history using Jujutsu

## Features

- Automatic detection of Git-managed folders
- Auto-commit and push edited content (executes after 1 minute of no file updates)
- Automatic fetching of changes from other team members
- Manual sync trigger (Ctrl+Shift+S / Cmd+Shift+S)
- Support for saving in conflict states

## Prerequisites

- **jujutsu (jj)** must be installed
  - Installation guide: https://github.com/martinvonz/jj#installation
  - Verify installation by running `jj --version`
- Working in a Git-managed workspace
- Remote repository must be configured

## Recommended Settings

Enable auto-save for the best experience:

```json
{
  "files.autoSave": "afterDelay",
  "files.autoSaveDelay": 1000
}
```

## Usage

1. Open a Git-managed folder in Cursor
2. The extension will automatically start syncing
3. Edit and save files - they will be automatically committed and pushed
4. Manual sync: Run "JJJ: Sync Now" from the command palette

## Auto-Sync Behavior Details

### Change Detection Mechanism
1. A debounce timer (1 minute) starts when a file is saved
2. When there are no changes for 1 minute, `processQueue()` fires
3. **Verifies if there are actual changes** (determined by `jj status`)
4. Only commits and pushes if there are actual changes
5. Skips sync if there are no changes

### Queue and Change Discrepancy
There are cases where saving a file in the editor doesn't actually change the content:
- Auto-save re-saved the same content
- Edits were reverted immediately after saving
- Temporary changes were undone

In such cases, even if files remain in the queue, `jj status` determines there are no changes.
The extension only commits actual changes, preventing unnecessary commits.

### Log Output
When there are no changes, the following is logged:
```
[INFO] No uncommitted changes found. Skipping auto-commit (queue had 3 files)
```

## Commands

- `JJJ: Sync Now` - Manually execute sync
- `JJJ: Enable Auto Sync` - Start auto-sync
- `JJJ: Disable Auto Sync` - Stop auto-sync

## Settings

- `jjj.autoSyncEnabled` (boolean, default: true) - Enable auto-sync

## Troubleshooting

### "jj not found" error appears

Jujutsu is not installed or not added to PATH.
Check the following:

1. Verify that Jujutsu is installed
2. Confirm that `jj --version` runs in the terminal
3. Restart Cursor to reload PATH

### Sync is not working

1. Check the status bar display
2. Verify that you have a Git-managed folder open
3. Confirm that a remote repository is configured

## License

MIT
