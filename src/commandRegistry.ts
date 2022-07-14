/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ICommand, ICommandParser, IDisposable } from './types.js';
import { Disposable, toDisposable } from './lifecycle.js';

export class CommandRegistry extends Disposable {
  commands: Map<string, ICommand> = new Map();

  private _commandHandlers: ICommandParser[] = [];

  get commandNames() { return this.commands.keys(); }
  get commandHandlers() { return this._commandHandlers; }

  registerCommand(name: string, command: ICommand) {
    this.commands.set(name, command);
    return toDisposable(() => this._removeCommand(name, command));
  }

  registerCommandHandler(commandParser: ICommandParser): IDisposable {
    this._commandHandlers.unshift(commandParser);
    return toDisposable(() => this._removeCommandHandler(commandParser));
  }

  private _removeCommand(name: string, command: ICommand) {
    const match = this.commands.get(name);
    if (match === command) {
      this.commands.delete(name);
    }
  }

  private _removeCommandHandler(commandParser: ICommandParser) {
    this._commandHandlers = this._commandHandlers.filter(e => e !== commandParser);
  }
}
