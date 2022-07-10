/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDisposable } from './types.js';

/**
 * A base class that can be extended to provide convenience methods for managing the lifecycle of an
 * object and its components.
 */
export abstract class Disposable implements IDisposable {
  protected _disposables: IDisposable[] = [];
  protected _isDisposed: boolean = false;

  constructor() {
  }

  /**
   * Disposes the object, triggering the `dispose` method on all registered IDisposables.
   */
  public dispose(): void {
    this._isDisposed = true;
    for (const d of this._disposables) {
      d.dispose();
    }
    this._disposables.length = 0;
  }

  /**
   * Registers a disposable object.
   * @param d The disposable to register.
   * @returns The disposable.
   */
  public register<T extends IDisposable>(d: T): T {
    this._disposables.push(d);
    return d;
  }

  /**
   * Unregisters a disposable object if it has been registered, if not do
   * nothing.
   * @param d The disposable to unregister.
   */
  public unregister<T extends IDisposable>(d: T): void {
    const index = this._disposables.indexOf(d);
    if (index !== -1) {
      this._disposables.splice(index, 1);
    }
  }
}

/**
 * Dispose of all disposables in an array and set its length to 0.
 */
export function disposeArray(disposables: IDisposable[]): void {
  for (const d of disposables) {
    d.dispose();
  }
  disposables.length = 0;
}

/**
 * Creates a disposable that will dispose of an array of disposables when disposed.
 */
export function getDisposeArrayDisposable(array: IDisposable[]): IDisposable {
  return { dispose: () => disposeArray(array) };
}

export function toDisposable(f: () => any): IDisposable {
  return { dispose: f }
}
