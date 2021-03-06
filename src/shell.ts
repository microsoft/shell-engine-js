/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CommandRegistry } from "./commandRegistry.js";
import { registerEchoCommand } from "./commands/echo.js";
import { EventEmitter, forwardEvent } from "./events.js";
import { attachFileSystemProvider } from "./fileSystem.js";
import { Disposable, getDisposeArrayDisposable, toDisposable } from "./lifecycle.js";
import { Prompt } from "./prompt.js";
import { ICommand, ICommandHandlerCommand, IDisposable, IEnvironmentVariableProvider, IFileSystemProvider, IShellOptions, Shell as ShellApi } from "./types.js";

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

  private readonly _commandRegistry = new CommandRegistry();
  private readonly _prompt = new Prompt();

  get commands() { return this._commandRegistry; }
  get prompt() { return this._prompt; }

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

    this.register(forwardEvent(this._prompt.onBeforeWritePrompt, this._onBeforeWritePrompt));
    this.register(forwardEvent(this._prompt.onDidChangePromptInput, this._onDidChangePromptInput));
    this.register(forwardEvent(this._prompt.onDidWriteData, this._onDidWriteData));
    this.register(forwardEvent(this._prompt.onDidWritePrompt, this._onDidWritePrompt));

    registerEchoCommand(this);
  }

  async start() {
    if (this.options?.welcomeMessage) {
      this._onDidWriteData.fire(this.options.welcomeMessage + '\n\r');
    }
    await this._prompt.reset(true);
  }

  async write(data: string) {
    // TODO: This should change to a parser with a state machine so it reads a single characters at a time, \x02\x02 for example doesn't get handled
    switch (data) {
      case '\x03': // ctrl+C
        // ^C is treated like a command
        const eventCommand = {
          name: '',
          argv: [''],
          commandLine: this._prompt.input
        };
        this._onBeforeExecuteCommand.fire(eventCommand);
        this._onDidWriteData.fire('\x1b[31m^C\x1b[0m');
        this._onDidExecuteCommand.fire({
          command: eventCommand,
          exitCode: undefined
        });
        await this._prompt.reset();
        break;
      case '\r': // enter
        this.handleEnter();
        break;
      case '\x08': // shift+backspace
      case '\x7F': // backspace (DEL)
        this._bellIfFalse(this._prompt.backspace());
        break;
      case '\x1b\x7f': // ctrl+backspace
        this._bellIfFalse(this._prompt.deleteCursorWordLeft());
        break;
      case '\x1b[A': // up
        this._bell();
        break;
      case '\x1b[B': // down
        this._bell();
        break;
      case '\x06': // ctrl+f
      case '\x1b[C': // right
        this._bellIfFalse(this._prompt.moveCursorRelative(1));
        break;
      case '\x1bf': // alt+f
      case '\x1b[1;5C': // ctrl+right
        this._bellIfFalse(this._prompt.moveCursorWordRight());
        break;
      case '\x02': // ctrl+b
      case '\x1b[D': // left
        this._bellIfFalse(this._prompt.moveCursorRelative(-1));
        break;
      case '\x1bb': // alt+b
      case '\x1b[1;5D': // ctrl+left
        this._bellIfFalse(this._prompt.moveCursorWordLeft());
        break;
      case '\x01': // ctrl+a
      case '\x1b[H': // home
        this._bellIfFalse(this._prompt.moveCursorStartOfLine());
        break;
      case '\x05': // ctrl+e
      case '\x1b[F': // end
        this._bellIfFalse(this._prompt.moveCursorEndOfLine());
        break;
      case '\x09': // tab
        this._onDidPressTab.fire();
        break;
      default:
        if (data[0] === '\x1b') {
          throw new Error(`Unrecognized escape sequence \\x1b${data.slice(1)}`);
        }
        // Print all printable characters for demo
        for (let i = 0; i < data.length; i++) {
          this._bellIfFalse(this._prompt.insertChar(data[i]));
        }
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

  handleEnter() {
    if (this._prompt.shouldContinueLine()) {
      this._prompt.insertChar('\n');
    } else {
      this._runCommand(this._prompt.input);
    }
  }

  private async _runCommand(input: string) {
    const argv = input.trim().split(' ');
    const name = argv[0];
    let exitCode: number | undefined;
    let eventCommand: IExecutedCommand;
    if (name.length > 0) {
      this._onDidWriteData.fire('\n\r');

      let customCommand: ICommandHandlerCommand | undefined;
      for (const handler of this.commands.commandHandlers) {
        customCommand = handler.handleCommand(input, ...argv);
        if (customCommand) {
          break;
        }
      }

      const command = this._commandRegistry.commands.get(name);
      eventCommand = customCommand?.command || {
        name,
        argv,
        commandLine: input
      };
      this._onBeforeExecuteCommand.fire(eventCommand);

      if (customCommand) {
        try {
          exitCode = await customCommand.run(this._onDidWriteData.fire.bind(this._onDidWriteData));
        } catch (e) {
          exitCode = this._handleRunCommandError(name, e);
        }
      } else if (command) {
        try {
          exitCode = await command.run(this._onDidWriteData.fire.bind(this._onDidWriteData), ...argv);
        } catch (e) {
          exitCode = this._handleRunCommandError(name, e);
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
    await this._prompt.reset();
  }

  private _handleRunCommandError(name: string, error: unknown): number {
    this._onDidWriteData.fire('\x1b[31m');
    if (error && error instanceof Error) {
      this._onDidWriteData.fire(`${name}: ${error.message}`);
    } else {
      this._onDidWriteData.fire(`${name}: failed`);
    }
    this._onDidWriteData.fire('\x1b[0m');
    return -1;
  }

  private _bellIfFalse(result: boolean) {
    if (!result) {
      this._bell();
    }
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
