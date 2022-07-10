/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Shell } from "../types.js";

export function initHelp(shell: Shell) {
  shell.commands.registerCommand('help', {
    run: async (write) => {
      shell.write(`This shell is built with js-shell-engine.\r\n`);
      shell.write(`The following builtin commands are registered:\r\n\n`);
      for (const name of shell.commands.commandNames) {
        if (name === 'help') {
          continue;
        }
        shell.write(` ${name}\r\n`);
      }
      return 0;
    }
  });
}
