/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { disposeArray, toDisposable } from "../lifecycle.js";
import { IDisposable, Shell } from "../types.js";

export function initVscodeShellIntegration(shell: Shell): IDisposable {
  const disposables: IDisposable[] = [];
  disposables.push(shell.onBeforeWritePrompt(   () => shell.writeOsc(633, 'A')));
  disposables.push(shell.onDidWritePrompt(      () => shell.writeOsc(633, 'B')));
  disposables.push(shell.onBeforeExecuteCommand(() => shell.writeOsc(633, 'C')));
  disposables.push(shell.onDidExecuteCommand(e => {
    const sanitizedCommandLine = e.command.commandLine
      .replace(/\n/g, '<LF>')
      .replace(/;/g, '<CL>');
    shell.writeOsc(633, `E;${sanitizedCommandLine}`);
    if (e.exitCode === undefined) {
      shell.writeOsc(633, `D`);
    } else {
      shell.writeOsc(633, `D;${e.exitCode}`);
    }
  }));
  return toDisposable(() => disposeArray(disposables));
}
