/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ICommand } from './types.js';
import { Disposable, toDisposable } from './lifecycle.js';

export class CommandRegistry extends Disposable {
  commands: Map<string, ICommand> = new Map();

  get commandNames() { return this.commands.keys(); }

  registerCommand(name: string, command: ICommand) {
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
