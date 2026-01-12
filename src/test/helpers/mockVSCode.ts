import * as sinon from 'sinon';

/**
 * VSCode APIのモック
 */
export interface MockVSCodeWindow {
  showInformationMessage: sinon.SinonStub;
  showWarningMessage: sinon.SinonStub;
  showErrorMessage: sinon.SinonStub;
  createOutputChannel: sinon.SinonStub;
  createTreeView: sinon.SinonStub;
}

export interface MockVSCodeWorkspace {
  getConfiguration: sinon.SinonStub;
  workspaceFolders: any[];
}

export interface MockVSCodeCommands {
  executeCommand: sinon.SinonStub;
  registerCommand: sinon.SinonStub;
}

/**
 * VSCode APIのモックを作成
 */
export function createMockVSCode() {
  const window: MockVSCodeWindow = {
    showInformationMessage: sinon.stub().resolves(),
    showWarningMessage: sinon.stub().resolves(),
    showErrorMessage: sinon.stub().resolves(),
    createOutputChannel: sinon.stub().returns({
      appendLine: sinon.stub(),
      show: sinon.stub(),
      dispose: sinon.stub()
    }),
    createTreeView: sinon.stub().returns({
      dispose: sinon.stub()
    })
  };

  const workspace: MockVSCodeWorkspace = {
    getConfiguration: sinon.stub().returns({
      get: sinon.stub().returns(false)
    }),
    workspaceFolders: []
  };

  const commands: MockVSCodeCommands = {
    executeCommand: sinon.stub().resolves(),
    registerCommand: sinon.stub().returns({ dispose: sinon.stub() })
  };

  return { window, workspace, commands };
}

/**
 * グローバルにVSCode APIモックを設定
 */
export function setupVSCodeMocks(target: any) {
  const mocks = createMockVSCode();

  target.vscode = {
    window: mocks.window,
    workspace: mocks.workspace,
    commands: mocks.commands,
    Uri: {
      file: (path: string) => ({ fsPath: path })
    }
  };

  return mocks;
}
