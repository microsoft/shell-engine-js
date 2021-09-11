import { ICommand } from "js-shell-engine";
import { Disposable } from "./lifecycle.js";

export class CommandRegistry extends Disposable {
  commands: Map<string, ICommand> = new Map();

  registerCommand(name: string, command: ICommand) {
    this.commands.set(name, command);
  }
}
