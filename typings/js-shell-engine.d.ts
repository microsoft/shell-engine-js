declare module 'js-shell-engine' {
  export interface IDisposable {
    dispose(): void;
  }

  export interface IEvent<T> {
    (listener: (arg: T) => any): IDisposable;
  }

  export type CommandSpec = any;

  export interface ICommand {
    run(write: (data: string) => void, ...args: string[]): Promise<number>;
  }

  export class Shell implements IDisposable {
    /**
     * The current working directory of the shell, this will be the empty string when no file system
     * provider is set.
     */
    readonly cwd: string;

    readonly dimensions: {
      readonly rows: number;
      readonly cols: number;
    };

    /**
     * The text being input into the prompt.
     */
    readonly promptInput: string;

    /** An event that's fired when the shell's current working directory changes. */
    readonly onDidChangeCwd: IEvent<string>;
    /** An event that's fired when the shell's prompt input changes. */
    readonly onDidChangePromptInput: IEvent<string>;
    /** An event that's fired when the shell writes to the terminal. */
    readonly onDidWriteData: IEvent<string>;

    /**
     * Creates a new shell object.
     */
    constructor();

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
     * Registers a command to the shell.
     */
    registerCommand(name: string, spec: CommandSpec | (() => Promise<CommandSpec>)): IDisposable;

    // TODO: Support plugin file systems
    // registerFileSystemProvider(fsProvider: any, cwd: string): IDisposable;

    // TODO: Support plugin environment provider (eg. `echo $ENV_VAR` support)
    // registerEnvironmentProvider(environmentProvider: any): IDisposable
  }
}
