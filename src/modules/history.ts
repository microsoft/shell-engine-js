import { ICommand, IExecutedCommand, Shell } from "../types.js";
import { Disposable } from "../lifecycle.js";

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
  const registry = new HistoryRegistry();
  shell.onDidExecuteCommand(e => registry.addEntry(e));
  shell.commands.registerCommand('history', new HistoryCommand(registry));
}
