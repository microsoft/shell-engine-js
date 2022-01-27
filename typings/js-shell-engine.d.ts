export interface IDisposable {
  dispose(): void;
}

export interface IEvent<T> {
  (listener: (arg: T) => any): IDisposable;
}

export interface ICommand {
  run(write: (data: string) => void, ...args: string[]): Promise<number>;
}

export class Shell implements IDisposable {
  /**
   * The current working directory of the shell, this will be the empty string when no file system
   * provider is set.
   */
  readonly cwd: string;

  /**
   * The current dimensions of the shell, this is set via the {@link Shell.resize} method.
   */
  readonly dimensions: {
    /**
     * The number of rows of the shell.
     */
    readonly rows: number;
    /**
     * The number of columns of the shell.
     */
    readonly columns: number;
  };

  /**
   * The text being input into the prompt.
   */
  readonly promptInput: string;

  /**
   * Gets or sets the prompt function or string. When this is a string it is printed directly to
   * the prompt similar to how $PS1 works, when this is a function the return value is printed.
   */
  prompt: (() => Promise<string> | string) | string;

  /** An event that's fired when the shell's current working directory changes. */
  readonly onDidChangeCwd: IEvent<string>;
  /** An event that's fired when the shell's prompt input changes. */
  readonly onDidChangePromptInput: IEvent<string>;
  /** An event that's fired when a command is executed. */
  readonly onDidExecuteCommand: IEvent<IExecutedCommand>;
  /** An event that's fired when tab is pressed. */
  readonly onDidPressTab: IEvent<void>;
  /** An event that's fired when the shell writes to the terminal. */
  readonly onDidWriteData: IEvent<string>;

  /**
   * Contains APIs related to managing commands.
   */
  readonly commands: ICommandsNamespace;

  /**
   * Creates a new shell object.
   */
  constructor(options?: IShellOptions);

  /**
   * Starts the terminal, this should be called after all event listeners are initialized.
   */
  start(): void;

  /**
   * Disposes of the shell.
   */
  dispose(): void;

  /**
   * Writes data to the shell.
   */
  write(data: string): void;

  /**
   * Resizes the shell.
   */
  resize(cols: number, rows: number): void;

  /**
   * Sets a variable's value to be used by the prompt.
   */
  setPromptVariable(variable: string, value: string): void;

  // TODO: Support plugin file systems
  // registerFileSystemProvider(fsProvider: any, cwd: string): IDisposable;

  // TODO: Support plugin environment provider (eg. `echo $ENV_VAR` support)
  // registerEnvironmentProvider(environmentProvider: any): IDisposable
}

export interface IShellOptions {
  welcomeMessage: string;
}

export interface ICommandsNamespace {
  commandNames: IterableIterator<string>;

  /**
   * Registers a command to the shell.
   */
  registerCommand(name: string, command: ICommand): IDisposable;
}

export interface IExecutedCommand {
  name: string;
  argv: string[];
}
