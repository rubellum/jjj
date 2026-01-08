import * as vscode from 'vscode';

class Logger {
  private outputChannel: vscode.OutputChannel;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Jujutsu Journaling');
  }

  info(message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[INFO ${timestamp}] ${message}`);
  }

  warn(message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[WARN ${timestamp}] ${message}`);
  }

  error(message: string, error?: Error): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[ERROR ${timestamp}] ${message}`);
    if (error) {
      this.outputChannel.appendLine(`  Stack: ${error.stack}`);
    }
  }

  debug(message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[DEBUG ${timestamp}] ${message}`);
  }

  show(): void {
    this.outputChannel.show();
  }

  dispose(): void {
    this.outputChannel.dispose();
  }
}

export const logger = new Logger();
