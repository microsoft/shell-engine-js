import { CommandRegistry } from "./commandRegistry.js";
import { HistoryRegistry } from "./historyRegistry.js";
import { IDisposable, IShellOptions, Shell as ShellApi } from "js-shell-engine";
import { EventEmitter } from "./events.js";
import { Disposable, toDisposable } from "./lifecycle.js";
import { HistoryCommand } from "./commands/history.js";

// declare global {
//   const console: {
//     log(...data: any[]): void;
//   };
// }

export class Shell extends Disposable implements ShellApi {
  cwd: string = '';
  dimensions = {
    rows: 0,
    columns: 0
  };
  promptInput: string = '';
  prompt: (() => Promise<string> | string) | string = 'js-shell-engine> ';

  private commandRegistry = new CommandRegistry();
  private historyRegistry = new HistoryRegistry();

  private _onDidChangeCwd = new EventEmitter<string>();
  readonly onDidChangeCwd = this._onDidChangeCwd.event;
  private _onDidChangePromptInput = new EventEmitter<string>();
  readonly onDidChangePromptInput = this._onDidChangePromptInput.event;
  private _onDidWriteData = new EventEmitter<string>();
  readonly onDidWriteData = this._onDidWriteData.event;

  constructor(private readonly options?: Readonly<IShellOptions>) {
    super();

    this.commandRegistry.registerCommand('history', new HistoryCommand(this.historyRegistry));
  }

  start() {
    if (this.options?.welcomeMessage) {
      this._onDidWriteData.fire(this.options.welcomeMessage + '\n\r');
    }
    this._resetPromptInput(true);
  }

  write(data: string) {
    switch (data) {
      case '\u0003': // Ctrl+C
        this._onDidWriteData.fire('\x1b[31m^C\x1b[0m');
        this._resetPromptInput();
        break;
      case '\r': // Enter
        this._runCommand(this.promptInput);
        break;
      case '\u007F': // Backspace (DEL)
        this._onDidWriteData.fire('\b \b');
        if (this.promptInput.length > 0) {
          this._setPromptInput(this.promptInput.substring(0, this.promptInput.length - 1));
        }
        break;
      default: // Print all other characters for demo
        if (data >= String.fromCharCode(0x20) && data <= String.fromCharCode(0x7B)) {
          this._setPromptInput(this.promptInput + data);
          this._onDidWriteData.fire(data);
        }
    }
  }

  resize(columns: number, rows: number): void {
    this.dimensions.columns = columns;
    this.dimensions.rows = rows;
  }

  registerCommand(name: string, spec: any): IDisposable {
    console.log(`Registered ${name}`);
    return toDisposable(() => {
    });
  }

  private async _runCommand(input: string) {
    this.historyRegistry.addEntry(input);
    const argv = input.trim().split(' ');
    const name = argv[0];
    if (name.length > 0) {
      this._onDidWriteData.fire('\n\r');
      const command = this.commandRegistry.commands.get(name);
      if (command) {
        command.run(this._onDidWriteData.fire.bind(this._onDidWriteData), ...argv);
      } else {
        this._onDidWriteData.fire(`${name}: command not found`);
      }
    }
    this._resetPromptInput();
  }

  private async _resetPromptInput(suppressNewLine: boolean = false) {
    this._setPromptInput('');
    this._onDidWriteData.fire(`${suppressNewLine ? '' : '\r\n'}${await this._getPromptString()}`);
  }

  private _getPromptString(): Promise<string> | string {
    if (typeof this.prompt === 'string') {
      return this.prompt;
    }
    return this.prompt();
  }

  private _setPromptInput(text: string) {
    if (this.promptInput !== text) {
      this.promptInput = text;
      this._onDidChangePromptInput.fire(text);
    }
  }
}
