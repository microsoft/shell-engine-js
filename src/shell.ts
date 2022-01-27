import { CommandRegistry } from "./commandRegistry.js";
import { ICommand, IDisposable, IExecutedCommand, IShellOptions, Shell as ShellApi } from "js-shell-engine";
import { EventEmitter } from "./events.js";
import { Disposable } from "./lifecycle.js";

export class Shell extends Disposable implements ShellApi {
  cwd: string = '';
  dimensions = {
    rows: 0,
    columns: 0
  };
  promptInput: string = '';
  prompt: (() => Promise<string> | string) | string = 'js-shell-engine> ';

  private commandRegistry = new CommandRegistry();
  get commands() { return this.commandRegistry; }

  private _onDidChangeCwd = new EventEmitter<string>();
  readonly onDidChangeCwd = this._onDidChangeCwd.event;
  private _onDidChangePromptInput = new EventEmitter<string>();
  readonly onDidChangePromptInput = this._onDidChangePromptInput.event;
  private _onDidExecuteCommand = new EventEmitter<IExecutedCommand>();
  readonly onDidExecuteCommand = this._onDidExecuteCommand.event;
  private _onDidPressTab = new EventEmitter<void>();
  readonly onDidPressTab = this._onDidPressTab.event;
  private _onDidWriteData = new EventEmitter<string>();
  readonly onDidWriteData = this._onDidWriteData.event;

  constructor(
    private readonly options?: Readonly<IShellOptions>
  ) {
    super();
  }

  start() {
    if (this.options?.welcomeMessage) {
      this._onDidWriteData.fire(this.options.welcomeMessage + '\n\r');
    }
    this._resetPromptInput(true);
  }

  write(data: string) {
    switch (data) {
      case '\u0003': // ctrl+C
        this._onDidWriteData.fire('\x1b[31m^C\x1b[0m');
        this._resetPromptInput();
        break;
      case '\r': // enter
        this._runCommand(this.promptInput);
        break;
      case '\u007F': // backspace (DEL)
        this._onDidWriteData.fire('\b \b');
        if (this.promptInput.length > 0) {
          this._setPromptInput(this.promptInput.substring(0, this.promptInput.length - 1));
        }
        break;
      case '\u001b[1;5C': // ctrl+right
        // TODO: Impl ctrl+right
        break;
      case '\u001b[1;5D': // ctrl+left
      // TODO: Impl ctrl+left
        break;
      case '\u0009': // tab
        this._onDidPressTab.fire();
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

  registerCommand(name: string, command: ICommand): IDisposable {
    return this.commandRegistry.registerCommand(name, command);
  }

  private async _runCommand(input: string) {
    const argv = input.trim().split(' ');
    const name = argv[0];
    if (name.length > 0) {
      this._onDidWriteData.fire('\n\r');
      const command = this.commandRegistry.commands.get(name);
      this._onDidExecuteCommand.fire({ name, argv });
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
