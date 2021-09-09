import { HistoryRegistry } from "../historyRegistry";
import { ICommand } from "js-shell-engine";

export class HistoryCommand implements ICommand {
  constructor(
    private readonly historyRegistry: HistoryRegistry
  ) {
  }

  async run(write: (data: string) => void, ...args: string[]): Promise<number> {
    write(this.historyRegistry.history.join('\n\r'));
    return 0;
  }
}
