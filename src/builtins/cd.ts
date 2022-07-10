/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ICommand, IFileSystemProvider, Shell } from "../types";
import * as minimist from 'minimist';
import { join } from "../path";
import { FileType } from "../constants";

// Implemented using this standard:
// https://pubs.opengroup.org/onlinepubs/9699919799/utilities/cd.html
export function createCdCommand(shell: Shell): ICommand {
  const fileSystemProvider = shell.fileSystemProvider;
  if (!fileSystemProvider) {
    throw new Error('Cannot create cd command without file system provider');
  }
  return {
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
    }
  };
}
