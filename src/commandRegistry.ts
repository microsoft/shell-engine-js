import { ICommand } from "js-shell-engine";
import { Disposable, toDisposable } from "./lifecycle.js";

export class CommandRegistry extends Disposable {
  commands: Map<string, ICommand> = new Map();

  registerCommand(name: string, command: ICommand) {
    console.log(`Registered command ${name}`);
    this.commands.set(name, command);
    return toDisposable(() => this._removeCommand(name, command));
  }

  private _removeCommand(name: string, command: ICommand) {
    const match = this.commands.get(name);
    if (match === command) {
      this.commands.delete(name);
    }
  }
}
