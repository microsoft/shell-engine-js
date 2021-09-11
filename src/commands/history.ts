import { HistoryRegistry } from "../historyRegistry.js";
import { ICommand } from "js-shell-engine";

export class HistoryCommand implements ICommand {
  constructor(
    private readonly historyRegistry: HistoryRegistry
  ) {
  }

  async run(write: (data: string) => void, ...argv: string[]): Promise<number> {
    const padding = this.historyRegistry.entries.length.toString().length + 2;
    write(this.historyRegistry.entries.map((e, i) => {
      return `${i.toString().padStart(padding, ' ')}  ${e}`;
    }).join('\n\r'));
    return 0;
  }
}
