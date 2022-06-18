import { CommandRegistry } from "./commandRegistry.js";
import { ICommand, IDisposable, IShellOptions, Shell as ShellApi } from "./types.js";
import { EventEmitter } from "./events.js";
import { Disposable } from "./lifecycle.js";

export interface IExecutedCommand {
  name: string;
  argv: string[];
}

export class Shell extends Disposable implements ShellApi {
  cwd: string = '';
  dimensions = {
    rows: 0,
    columns: 0
  };
  promptInput: string = '';
  prompt: (() => Promise<string> | string) | string = 'js-shell-engine> ';

  private _cursor: number = 0;
  private readonly _promptVariables: Map<string, string | (() => string | Promise<string>)> = new Map();

  private readonly _commandRegistry = new CommandRegistry();
  get commands() { return this._commandRegistry; }

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
      if (this.promptInput.length > 0 && this._cursor > 0) {
          this._onDidWriteData.fire('\b\x1b[P');
          this._cursor--;
          this._setPromptInput(this.promptInput.substring(0, this._cursor) + this.promptInput.substring(this._cursor + 1));
        }
        break;
      case '\u001b[C': // right
        this._setCursorPosition(this._cursor + 1);
        break;
      case '\u001b[1;5C': // ctrl+right
        this._moveCursorWordRight();
        break;
      case '\u001b[D': // left
        this._setCursorPosition(this._cursor - 1);
        break;
      case '\u001b[1;5D': // ctrl+left
        this._moveCursorWordLeft();
        break;
      case '\u001b[H': // home
        this._setCursorPosition(0);
        break;
      case '\u001b[F': // end
        this._setCursorPosition(this.promptInput.length);
        break;
      case '\u0009': // tab

        if (this._cursor !== this.promptInput.length) {
          throw new Error('NYI'); // TODO: Implement
        }

        this._onDidPressTab.fire();
        break;
      default: // Print all other characters for demo
        if (this._cursor !== this.promptInput.length) {
          this._onDidWriteData.fire('\x1b[@');
        }

        if (data >= String.fromCharCode(0x20) && data <= String.fromCharCode(0x7B)) {
          this._setPromptInput(this.promptInput + data);
        }
        this._cursor += data.length;
        this._onDidWriteData.fire(data);
    }
  }

  resize(columns: number, rows: number): void {
    this.dimensions.columns = columns;
    this.dimensions.rows = rows;
  }

  registerCommand(name: string, command: ICommand): IDisposable {
    return this._commandRegistry.registerCommand(name, command);
  }

  setPromptVariable(variable: string, value: string | (() => string | Promise<string>)): void {
    this._promptVariables.set(variable, value);
  }

  private async _runCommand(input: string) {
    const argv = input.trim().split(' ');
    const name = argv[0];
    if (name.length > 0) {
      this._onDidWriteData.fire('\n\r');
      const command = this._commandRegistry.commands.get(name);
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
    this._cursor = 0;
    this._onDidWriteData.fire(`${suppressNewLine ? '' : '\r\n'}${await this._getNewPromptString()}`);
  }

  private _reprintPromptInput() {
    const originalCursorPosition = this._cursor;
    this._setCursorPosition(0);
    this._onDidWriteData.fire('\x1b[K');
    this._onDidWriteData.fire(this.promptInput);
    this._cursor = this.promptInput.length;
    this._setCursorPosition(originalCursorPosition);
  }

  private async _getNewPromptString(): Promise<string> {
    const unresolved = typeof this.prompt === 'string' ? this.prompt : await this.prompt();
    return this._resolveVariables(unresolved);
  }

  private async _resolveVariables(prompt: string): Promise<string> {
    // TODO: Extracting should be done once when the prompt changes
    // Extract variables to resolve
    const vars: {
      name: string;
      start: number;
      end: number;
    }[] = [];
    let state: 'normal' | 'dollar' | 'curly' = 'normal';
    let earlyExit = false;
    let start = -1;
    for (let i = 0; i < prompt.length; i++) {
      switch (state) {
        case 'normal':
          if (prompt[i] === '$') {
            state = 'dollar';
            start = i;
          }
          break;
        case 'dollar':
          if (prompt[i] === '{') {
            state = 'curly';
          } else if (prompt[i] === '$') {
            start = i;
          } else {
            state = 'normal';
          }
          break;
        case 'curly':
          const end = prompt.indexOf('}', i);
          if (end === -1) {
            earlyExit = true;
          }
          vars.push({
            name: prompt.substring(start + 2, end),
            start,
            end: end + 1
          });
          i = end + 1;
          state = 'normal';
          break;
      }
      if (earlyExit) {
        break;
      }
    }

    // Nothing to resolve
    if (vars.length === 0) {
      return prompt;
    }

    // Resolve all variables asynchronously
    const promises: Promise<{ variable: string, result: string | undefined }>[] = [];
    for (let i = 0; i < vars.length; i++) {
      promises.push(this._resolveVariable(vars[i].name).then(result => ({
        variable: vars[i].name,
        result
      })));
    }
    const results = await Promise.all(promises);

    // TODO: Could be optimized
    // Replace variables in prompt string, in reverse order to avoid shifting indexes
    for (let i = results.length - 1; i >= 0; i--) {
      const result = results[i];
      if (result.result === undefined) {
        console.warn(`Could not resolve variable ${result.variable}`);
        continue;
      }
      prompt = `${prompt.substring(0, vars[i].start)}${result.result}${prompt.substring(vars[i].end)}`;
    }

    return prompt;
  }

  private async _resolveVariable(variable: string): Promise<string | undefined> {
    const promptVariable = this._promptVariables.get(variable);
    if (promptVariable === undefined || typeof promptVariable === 'string') {
      return promptVariable;
    }
    return promptVariable();
  }

  private _setPromptInput(text: string) {
    if (this.promptInput !== text) {
      this.promptInput = text;
      this._onDidChangePromptInput.fire(text);
    }
  }

  private _setCursorPosition(position: number) {
    if (position < 0 || position > this.promptInput.length) {
      return;
    }
    if (this._cursor !== position) {
      const change = this._cursor - position;
      const code = change > 0 ? 'D' : 'C';
      const sequence = `\u001b[${code}`.repeat(Math.abs(change));
      this._onDidWriteData.fire(sequence);
      this._cursor = position;
    }
  }

  private _moveCursorWordLeft() {
    if (this._cursor === 0) {
      // TODO: Bell?
      return;
    }
    let position = this._cursor;
    // Skip any adjacent whitespace
    while (position > 0 && this.promptInput[position - 1] === ' ') {
      position--;
    }
    while (position > 0 && this.promptInput[position - 1] !== ' ') {
      position--;
    }
    this._setCursorPosition(position);
  }

  private _moveCursorWordRight() {
    if (this._cursor === this.promptInput.length - 1) {
      // TODO: Bell?
      return;
    }
    let position = this._cursor;
    // Skip any adjacent whitespace
    while (position < this.promptInput.length - 1 && this.promptInput[position + 1] === ' ') {
      position++;
    }
    while (position < this.promptInput.length - 1 && this.promptInput[position + 1] !== ' ') {
      position++;
    }
    this._setCursorPosition(position);
  }
}
