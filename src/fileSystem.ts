import { isAbsolute, join, resolve } from "./path.js";
import { IDisposable, IFileSystemProvider, Shell } from "./types.js";
import * as minimist from 'minimist';

// Implemented using this standard:
// https://pubs.opengroup.org/onlinepubs/9699919799/utilities/cd.html
export function attachFileSystemProvider(shell: Shell, fileSystemProvider: IFileSystemProvider): IDisposable {
  // TODO: Move to using $PWD for cwd
  shell.setPromptVariable('cwd', () => fileSystemProvider.cwd);
  shell.commands.registerCommand('cd', {
    async run(write, ...args) {
      // Usage:
      //   cd [-L|-P] [directory]
      //   cd -
      const parsedArgs = minimist(args, {
        boolean: [
          'L',
          'P'
        ]
      });

      // TODO: Support resolving symlinks
      // let resolveSymlinks = false;
      // if (parsedArgs.L) {
      //   resolveSymlinks = false;
      // } else if (parsedArgs.P) {
      //   resolveSymlinks = true;
      // }

      if (parsedArgs._.length > 2) {
        throw new Error('too many arguments');
      }

      let curpath: string;
      if (parsedArgs._.length === 1) {
        const home = shell.environmentVariableProvider?.get('HOME');
        if (!home) {
          throw new Error('HOME not set');
        }
        curpath = home;
      } else {
        const rawTarget = parsedArgs._[1];
        if (rawTarget === '-') {
          const oldpwd = shell.environmentVariableProvider?.get('OLDPWD');
          if (!oldpwd) {
            throw new Error('OLDPWD not set');
          }
          curpath = oldpwd;
        } else {
          // TODO: Support CDPATH
          if (rawTarget.startsWith('/')) {
            curpath = rawTarget;
          } else {
            curpath = join(fileSystemProvider.cwd, rawTarget);
          }
        }
      }
      const result = await fileSystemProvider.stat(curpath);
      // TODO: Resolve symlinks
      if (result.type !== FileType.Directory) {
        write('not a directory\n\r');
        return 1;
      }
      shell.environmentVariableProvider?.set('OLDPWD', fileSystemProvider.cwd);
      // TODO: Move to $PWD
      fileSystemProvider.cwd = curpath;
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
