export interface IDisposable {
  dispose(): void;
}

export interface IEvent<T> {
  (listener: (arg: T) => any): IDisposable;
}

// TODO: Should a command contribute tab completion?
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
   * The index of the cursor within {@link promptInput}.
   */
  readonly promptInputCursorIndex: number;

  /**
   * Gets or sets the prompt function or string. When this is a string it is printed directly to
   * the prompt similar to how $PS1 works, when this is a function the return value is printed.
   */
  prompt: (() => Promise<string> | string) | string;

  /** An event that's fired when the shell's current working directory changes. */
  readonly onDidChangeCwd: IEvent<string>;
  /** An event that's fired when the shell's prompt input changes. */
  readonly onDidChangePromptInput: IEvent<string>;
  /** An event that's fired _before_ the shell's prompt is written. */
  readonly onBeforeWritePrompt: IEvent<void>;
  /** An event that's fired _after_ the shell's prompt is written. */
  readonly onDidWritePrompt: IEvent<void>;
  /** An event that's fired _before_ a command is executed. */
  readonly onBeforeExecuteCommand: IEvent<IExecutedCommand>;
  /** An event that's fired _after_ a command is executed. */
  readonly onDidExecuteCommand: IEvent<IExecuteCommandEvent>;
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
   * Write an OSC sequence to the shell.
   */
  writeOsc(ident: number, data: string): void;

  /**
   * Resizes the shell.
   */
  resize(cols: number, rows: number): void;

  /**
   * Sets a variable's value to be used by the prompt.
   */
  setPromptVariable(variable: string, value: string): void;

  // TODO: Support plugin file systems
  registerFileSystemProvider(fileSystemProvider: IFileSystemProvider): IDisposable;

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

export interface IExecuteCommandEvent {
  /**
   * The command that was executed.
   */
  command: IExecutedCommand;
  /**
   * The exit code of the command. This is undefined when no command was executed (eg. enter on
   * empty prompt or ^C).
   */
  exitCode: number | undefined;
}

export interface IExecutedCommand {
  /**
   * The name of the command (ie. argv[0]).
   */
  name: string;
  /**
   * An array containing the command followed by each argument.
   */
  argv: string[];
  /**
   * The raw command line that was executed.
   */
  commandLine: string;
}

export interface IFileSystemProvider {
  cwd: string;
  stat(path: string): IFileStat | Promise<IFileStat>;
  readDirectory(path: string): [string, FileType][] | Promise<[string, FileType][]>;
  createDirectory(path: string): void | Promise<void>;
}

export interface IFileStat {
  type: FileType;
  ctime: number;
  mtime: number;
  size: number;
  permissions?: FilePermission;
}

/**
 * Unknown = 0,
 * File = 1,
 * Directory = 2,
 * SymbolicLink = 64
 */
export type FileType = 0 | 1 | 2 | 64;

export enum FilePermission {
  Readonly = 1
}
