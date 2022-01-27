/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IDisposable, IEvent } from './types';

interface IListener<T> {
  (arg: T): void;
}

export interface IEventEmitter<T> {
  event: IEvent<T>;
  fire(arg1: T): void;
  dispose(): void;
}

export class EventEmitter<T> implements IEventEmitter<T> {
  private _listeners: IListener<T>[] = [];
  private _event?: IEvent<T>;
  private _disposed: boolean = false;

  public get event(): IEvent<T> {
    if (!this._event) {
      this._event = (listener: (arg: T) => any) => {
        this._listeners.push(listener);
        const disposable = {
          dispose: () => {
            if (!this._disposed) {
              for (let i = 0; i < this._listeners.length; i++) {
                if (this._listeners[i] === listener) {
                  this._listeners.splice(i, 1);
                  return;
                }
              }
            }
          }
        };
        return disposable;
      };
    }
    return this._event;
  }

  public fire(arg: T): void {
    const queue: IListener<T>[] = [];
    for (let i = 0; i < this._listeners.length; i++) {
      queue.push(this._listeners[i]);
    }
    for (let i = 0; i < queue.length; i++) {
      queue[i].call(undefined, arg);
    }
  }

  public dispose(): void {
    if (this._listeners) {
      this._listeners.length = 0;
    }
    this._disposed = true;
  }
}

export function forwardEvent<T>(from: IEvent<T>, to: IEventEmitter<T>): IDisposable {
  return from(e => to.fire(e));
}
