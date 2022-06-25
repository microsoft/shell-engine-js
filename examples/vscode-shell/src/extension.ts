import * as vscode from 'vscode';
import { Shell } from '../../../out/shell.js';
import { initHistory } from '../../../out/modules/history.js';
import { initTabCompletion } from '../../../out/modules/tabCompletion.js';
import { initHelp } from '../../../out/modules/help.js';
import { initVscodeShellIntegration } from '../../../out/modules/vscodeShellIntegration.js';
import { hostname } from 'os';

export function activate(context: vscode.ExtensionContext) {
  const shell = new Shell();

  // Initialize all modules
  initHistory(shell);
  initTabCompletion(shell);
  initHelp(shell);
  initVscodeShellIntegration(shell);

  // Initialize shell-specific functionality
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

  // Set prompt and register some prompt variables
  shell.prompt = '\x1b[42m vscode \x1b[0;32;46m\ue0b0\x1b[0;46m ${hostname} \x1b[0;36;45m\ue0b0\x1b[0;45m ${time} \x1b[0;35m\ue0b0\x1b[0m ';
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
