/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ICommand, IDisposable, IExecutedCommand, Shell } from "../types.js";
import { Disposable, disposeArray, toDisposable } from "../lifecycle.js";

class HistoryRegistry extends Disposable {
  entries: IExecutedCommand[] = [];

  addEntry(entry: IExecutedCommand) {
    // Don't add empty entry
    if (entry.name.length === 0) {
      return;
    }
    // Don't add duplicates
    if (this.entries.length > 0 && this.entries[this.entries.length - 1] === entry) {
      return;
    }
    this.entries.push(entry);
  }
}

class HistoryCommand implements ICommand {
  constructor(
    private readonly historyRegistry: HistoryRegistry
  ) {
  }

  async run(write: (data: string) => void, ...argv: string[]): Promise<number> {
    const padding = this.historyRegistry.entries.length.toString().length + 2;
    write(this.historyRegistry.entries.map((e, i) => {
      return `${i.toString().padStart(padding, ' ')}  ${e.argv.join(' ')}`;
    }).join('\n\r'));
    return 0;
  }
}

export function initHistory(shell: Shell) {
  const disposables: IDisposable[] = [];
  const registry = new HistoryRegistry();
  disposables.push(registry);
  disposables.push(shell.onBeforeExecuteCommand(e => registry.addEntry(e)));
  disposables.push(shell.commands.registerCommand('history', new HistoryCommand(registry)));
  return toDisposable(() => disposeArray(disposables));
}
