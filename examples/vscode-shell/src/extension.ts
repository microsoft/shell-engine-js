import * as vscode from 'vscode';
import { Shell } from '../../../out/shell.js';
import { initHistory } from '../../../out/modules/history.js';
import { initTabCompletion } from '../../../out/modules/tabCompletion.js';
import { initHelp } from '../../../out/modules/help.js';
import { initVscodeShellIntegration } from '../../../out/modules/vscodeShellIntegration.js';
import { hostname } from 'os';
import { IFileSystemProvider } from '../../../typings/js-shell-engine.js';

export function activate(context: vscode.ExtensionContext) {
  const shell = new Shell();

  // Initialize all modules
  initHistory(shell);
  initTabCompletion(shell);
  initHelp(shell);
  initVscodeShellIntegration(shell);

  // Initialize shell-specific functionality
  // TODO: Fix type errors
  const fileSystemProvider: IFileSystemProvider = {
    cwd: vscode.workspace.workspaceFolders![0].uri.path,
    async createDirectory(path: string) {
      return vscode.workspace.fs.createDirectory(vscode.Uri.file(path));
    },
    async readDirectory(path: string) {
      return vscode.workspace.fs.readDirectory(vscode.Uri.file(path));
    },
    async stat(path: string) {
      return vscode.workspace.fs.stat(vscode.Uri.file(path));
    },
    async delete(path: string, options?: { recursive?: boolean; useTrash?: boolean }) {
      return vscode.workspace.fs.delete(vscode.Uri.file(path), options);
    }
  } as any;
  shell.registerFileSystemProvider(fileSystemProvider);
  shell.registerCommand('command', {
    async run(write, ...args) {
      if (args[1] === undefined) {
        write(`Specify a command ID as the first argument: command <commandid>\n\r`);
        return 1;
      }
      write(`executing command ${args[1]}\n\r`);
      try {
        await vscode.commands.executeCommand(args[1]);
      } catch (e) {
        write('\x1b[31m');
        if (e && e instanceof Error) {
          write(`Failed: ${e.message}`);
        } else {
          write('Failed: unknown reason');
        }
        write('\x1b[0m');
        return 1;
      }
      return 0;
    },
  });
  const shellEnv = { ...process.env };
  shell.registerEnvironmentVariableProvider({
    getAll() {
      return shellEnv
    },
    get(key: string): string | undefined {
      return shellEnv[key];
    },
    set(key, value) {
      if (value === undefined) {
        delete shellEnv[key];
      } else {
        shellEnv[key] = value;
      }
    },
  });

  // Set prompt and register some prompt variables
  shell.prompt = '\x1b[42m ${hostname} \x1b[0;32;46m\ue0b0\x1b[0;46m ${time} \x1b[0;36;45m\ue0b0\x1b[0;45m ${cwd} \x1b[0;35m\ue0b0\x1b[0m ';
  shell.setPromptVariable('hostname', hostname());
  shell.setPromptVariable('time', () => {
    const now = new Date();
    return `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  })

  // Create the terminal and attach it to the shell
  const writeEmitter = new vscode.EventEmitter<string>();
  const pty: vscode.Pseudoterminal = {
    onDidWrite: writeEmitter.event,
    open: () => shell.start(),
    close: () => { shell.dispose() },
    handleInput: (data: string) => shell.write(data)
  }
  const terminal = vscode.window.createTerminal({
    name: 'vscode-shell',
    pty
  });
  shell.onDidWriteData(e => writeEmitter.fire(e));

  // Show the terminal
  terminal.show();
}

// this method is called when your extension is deactivated
export function deactivate() {}
