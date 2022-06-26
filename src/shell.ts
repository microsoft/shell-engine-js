import { CommandRegistry } from "./commandRegistry.js";
import { registerEchoCommand } from "./commands/echo.js";
import { EventEmitter } from "./events.js";
import { attachFileSystemProvider } from "./fileSystem.js";
import { Disposable, disposeArray, getDisposeArrayDisposable, toDisposable } from "./lifecycle.js";
import { ICommand, IDisposable, IEnvironmentVariableProvider, IFileSystemProvider, IShellOptions, Shell as ShellApi } from "./types.js";

export interface IExecuteCommandEvent {
  command: IExecutedCommand;
  exitCode: number | undefined;
}

export interface IExecutedCommand {
  name: string;
  argv: string[];
  commandLine: string;
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
  get promptInputCursorIndex() { return this._cursor; }

  public fileSystemProvider?: IFileSystemProvider;
  public environmentVariableProvider?: IEnvironmentVariableProvider;

  private _onDidChangeCwd = new EventEmitter<string>();
  readonly onDidChangeCwd = this._onDidChangeCwd.event;
  private _onDidChangePromptInput = new EventEmitter<string>();
  readonly onDidChangePromptInput = this._onDidChangePromptInput.event;
  private _onBeforeWritePrompt = new EventEmitter<void>();
  readonly onBeforeWritePrompt = this._onBeforeWritePrompt.event;
  private _onDidWritePrompt = new EventEmitter<void>();
  readonly onDidWritePrompt = this._onDidWritePrompt.event;
  private _onBeforeExecuteCommand = new EventEmitter<IExecutedCommand>();
  readonly onBeforeExecuteCommand = this._onBeforeExecuteCommand.event;
  private _onDidExecuteCommand = new EventEmitter<IExecuteCommandEvent>();
  readonly onDidExecuteCommand = this._onDidExecuteCommand.event;
  private _onDidPressTab = new EventEmitter<void>();
  readonly onDidPressTab = this._onDidPressTab.event;
  private _onDidWriteData = new EventEmitter<string>();
  readonly onDidWriteData = this._onDidWriteData.event;

  constructor(
    private readonly options?: Readonly<IShellOptions>
  ) {
    super();

    registerEchoCommand(this);
  }

  async start() {
    if (this.options?.welcomeMessage) {
      this._onDidWriteData.fire(this.options.welcomeMessage + '\n\r');
    }
    await this._resetPromptInput(true);
  }

  write(data: string) {
    // HACK: Handle 633 specially for prototype
    if (data === '\x1b]633;P;Yes\x07') {
      // In a real implementation, this would enable the sending of the completions
      console.log('terminal confirmed it supports native shell-based autocomplete');
      return;
    }

    // TODO: This should read x characters from data, \u0002\u0002 for example doesn't get handled
    switch (data) {
      case '\u0003': // ctrl+C
        // ^C is treated like a command
        const eventCommand = {
          name: '',
          argv: [''],
          commandLine: this.promptInput
        };
        this._onBeforeExecuteCommand.fire(eventCommand);
        this._onDidWriteData.fire('\x1b[31m^C\x1b[0m');
        this._onDidExecuteCommand.fire({
          command: eventCommand,
          exitCode: undefined
        });
        this._resetPromptInput();
        break;
      case '\r': // enter
        this._runCommand(this.promptInput);
        break;
      case '\u0008': // shift+backspace
      case '\u007F': // backspace (DEL)
        if (this.promptInput.length > 0 && this._cursor > 0) {
          this._onDidWriteData.fire('\b\x1b[P');
          this._cursor--;
          this._setPromptInput(this.promptInput.substring(0, this._cursor) + this.promptInput.substring(this._cursor + 1));
        } else {
          this._bell();
        }
        break;
      case '\u001b\u007f': // ctrl+backspace
        this._deleteCursorWordLeft();
        break;
      case '\u001b[A': // up
        this._bell();
        break;
      case '\u001b[B': // down
        this._bell();
        break;
      case '\u0006': // ctrl+f
      case '\u001b[C': // right
        this._setCursorPosition(this._cursor + 1);
        break;
      case '\u001bf': // alt+f
      case '\u001b[1;5C': // ctrl+right
        this._moveCursorWordRight();
        break;
      case '\u0002': // ctrl+b
      case '\u001b[D': // left
        this._setCursorPosition(this._cursor - 1);
        break;
      case '\u001bb': // alt+b
      case '\u001b[1;5D': // ctrl+left
        this._moveCursorWordLeft();
        break;
      case '\u0001': // ctrl+a
      case '\u001b[H': // home
        this._setCursorPosition(0);
        break;
      case '\u0005': // ctrl+e
      case '\u001b[F': // end
        this._setCursorPosition(this.promptInput.length);
        break;
      case '\u0009': // tab

        // TODO: This not needed? Modules end up handling this
        // if (this._cursor !== this.promptInput.length) {
        //   throw new Error('NYI'); // TODO: Implement
        // }

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

  writeOsc(ident: number, data: string) {
    this._onDidWriteData.fire(`\x1b]${ident};${data}\x07`);
  }

  resize(columns: number, rows: number) {
    this.dimensions.columns = columns;
    this.dimensions.rows = rows;
  }

  registerCommand(name: string, command: ICommand): IDisposable {
    return this._commandRegistry.registerCommand(name, command);
  }

  setPromptVariable(variable: string, value: string | (() => string | Promise<string>) | undefined) {
    if (value === undefined) {
      this._promptVariables.delete(variable);
    } else {
      this._promptVariables.set(variable, value);
    }
  }

  private async _runCommand(input: string) {
    const argv = input.trim().split(' ');
    const name = argv[0];
    let exitCode: number | undefined;
    let eventCommand: IExecutedCommand;
    if (name.length > 0) {
      this._onDidWriteData.fire('\n\r');
      const command = this._commandRegistry.commands.get(name);
      eventCommand = {
        name,
        argv,
        commandLine: input
      };
      this._onBeforeExecuteCommand.fire(eventCommand);
      if (command) {
        try {
          exitCode = await command.run(this._onDidWriteData.fire.bind(this._onDidWriteData), ...argv);
        } catch (e) {
          this._onDidWriteData.fire('\x1b[31m');
          if (e && e instanceof Error) {
            this._onDidWriteData.fire(`${name}: ${e.message}`);
          } else {
            this._onDidWriteData.fire(`${name}: failed`);
          }
          this._onDidWriteData.fire('\x1b[0m');
          exitCode = -1;
        }
      } else {
        this._onDidWriteData.fire(`${name}: command not found`);
        exitCode = 1;
      }
    } else {
      eventCommand = { name: '', argv: [''], commandLine: input };
    }
    this._onDidExecuteCommand.fire({
      command: eventCommand,
      exitCode
    });
    await this._resetPromptInput();
  }

  private async _resetPromptInput(suppressNewLine: boolean = false) {
    this._setPromptInput('');
    this._cursor = 0;
    this._onDidWriteData.fire(suppressNewLine ? '' : '\r\n');
    this._onBeforeWritePrompt.fire();
    this._onDidWriteData.fire(await this._getNewPromptString());
    this._onDidWritePrompt.fire();
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
      this._bell();
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
      this._bell();
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

  private _deleteCursorWordLeft() {
    if (this._cursor === this.promptInput.length - 1) {
      this._bell();
      return;
    }

    let position = this._cursor;
    while (position > 0 && this.promptInput[position - 1] === ' ') {
      position--;
    }
    while (position > 0 && this.promptInput[position - 1] !== ' ') {
      position--;
    }
    const charCount = this._cursor - position
    this._onDidWriteData.fire('\b\x1b[P'.repeat(charCount));
    this._setPromptInput(this.promptInput.substring(0, position) + this.promptInput.substring(this._cursor));
    this._cursor -= charCount;
  }

  private _bell() {
    this._onDidWriteData.fire('\x07');
  }

  registerFileSystemProvider(fileSystemProvider: IFileSystemProvider): IDisposable {
    if (this.fileSystemProvider) {
      throw new Error('Multiple file system providers not supported');
    }
    this.fileSystemProvider = fileSystemProvider;
    const attached = attachFileSystemProvider(this, fileSystemProvider);;
    return getDisposeArrayDisposable([
      attached,
      toDisposable(() => this.fileSystemProvider = undefined)
    ]);
  }

  // TODO: environment variable provider should make a copy of the environment variables
  registerEnvironmentVariableProvider(environmentVariableProvider: IEnvironmentVariableProvider): IDisposable {
    if (this.environmentVariableProvider) {
      throw new Error('Multiple environment variable providers not supported');
    }
    this.environmentVariableProvider = environmentVariableProvider;
    return getDisposeArrayDisposable([
      toDisposable(() => this.environmentVariableProvider = undefined)
    ]);
  }
}
