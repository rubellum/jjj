/**
 * Test setup file - mocks vscode module for unit tests
 * This file is loaded before all tests to provide vscode API mocks
 */
import { createMockVSCode } from './helpers/mockVSCode';

// Create global vscode mock
const vscode = createMockVSCode();

// Mock the vscode module globally
(global as any).vscode = vscode;

// Mock require('vscode') to return our mock
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function (id: string) {
  if (id === 'vscode') {
    return vscode;
  }
  return originalRequire.apply(this, arguments);
};
