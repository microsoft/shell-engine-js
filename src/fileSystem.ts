import { isAbsolute, join, resolve } from "./path.js";
import { IDisposable, IFileSystemProvider, Shell as ShellApi } from "./types.js";
import * as minimist from 'minimist';

export function attachFileSystemProvider(shell: ShellApi, fileSystemProvider: IFileSystemProvider): IDisposable {
  shell.setPromptVariable('cwd', () => fileSystemProvider.cwd);
  shell.commands.registerCommand('cd', {
    async run(write, ...args) {
      const dir = args[1];
      const target = resolve(isAbsolute(dir) ? dir : join(fileSystemProvider.cwd, dir))
      const result = await fileSystemProvider.stat(target);
      // TODO: Resolve symlinks
      if (result.type !== FileType.Directory) {
        write('not a directory\n\r');
        return 1;
      }
      fileSystemProvider.cwd = target;
      return 0;
    },
  });
  shell.commands.registerCommand('ls', {
    async run(write, ...args) {
      function formatFile(file: [string, FileType]): string {
        const color = fileTypeSgr(file[1]);
        const isDir = file[1] === FileType.Directory
        if (color) {
          return `\x1b[${color}m${file[0]}${isDir ? '/' : ''}\x1b[0m`;
        }
        return file[0];
      }
      function fileTypeSgr(fileType: FileType): string | undefined {
        switch (fileType) {
          case FileType.Directory: return '1;34';
          case FileType.SymbolicLink: return '32';
        }
        return undefined;
      }

      const result = await fileSystemProvider.readDirectory(fileSystemProvider.cwd);
      result.sort((a, b) => {
        if (a[1] !== b[1]) {
          // This puts symlinks at the top which is a bit weird
          return b[1] - a[1];
        }
        return a[0].localeCompare(b[0]);
      });
      for (const file of result) {
        write(`${formatFile(file)}\n\r`);
      }
      return 0;
    }
  });
  shell.commands.registerCommand('mkdir', {
    async run(write, ...args) {
      if (args.length < 2) {
        throw new Error('Must specify directory to create');
      }
      await fileSystemProvider.createDirectory(join(fileSystemProvider.cwd, args[1]));
      return 0;
    }
  });
  shell.commands.registerCommand('rm', {
    async run(write, ...args) {
      // TODO: Report usage for unknown args
      const parsedArgs = minimist(args, {
        boolean: ['r']
      });
      const options: Parameters<IFileSystemProvider['delete']>[1] = {
        recursive: parsedArgs['r']
      };
      let file: string;
      let deleteCount = 0;
      for (let i = 1; i < parsedArgs._.length; i++) {
        file = parsedArgs._[i];
        if (file.length === 0) {
          continue;
        }
        if (!isAbsolute(file)) {
          file = join(fileSystemProvider.cwd, file);
        }
        await fileSystemProvider.delete(file, options);
        deleteCount++;
      }
      if (deleteCount === 0) {
        throw new Error('No files specified');
      }
      return 0;
    }
  });
  // TODO: Return disposable
  return null!;
}

const enum FileType {
  Unknown = 0,
  File = 1,
  Directory = 2,
  SymbolicLink = 64
}
