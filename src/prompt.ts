/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isCharPrintable } from "./charCode";
import { EventEmitter } from "./events";
import { clamp } from "./number";

export class Prompt {
  prompt: (() => Promise<string> | string) | string = 'shell-engine> ';

  // private _inputStartIndex: number = 0;
  private _inputCursorIndex: number = 0;
  private _input: string = '';

  private readonly _promptVariables: Map<string, string | (() => string | Promise<string>)> = new Map();

  get input(): string { return this._input; }
  get inputCursorIndex(): number { return this._inputCursorIndex; }

  private _onDidChangePromptInput = new EventEmitter<string>();
  readonly onDidChangePromptInput = this._onDidChangePromptInput.event;
  private _onBeforeWritePrompt = new EventEmitter<void>();
  readonly onBeforeWritePrompt = this._onBeforeWritePrompt.event;
  private _onDidWritePrompt = new EventEmitter<void>();
  readonly onDidWritePrompt = this._onDidWritePrompt.event;
  private _onDidWriteData = new EventEmitter<string>();
  readonly onDidWriteData = this._onDidWriteData.event;

  async reset(suppressNewLine: boolean = false) {
    this._setPromptInput('');
    this._inputCursorIndex = 0;
    this._onDidWriteData.fire(suppressNewLine ? '' : '\r\n');
    this._onBeforeWritePrompt.fire();
    this._onDidWriteData.fire(await this._getNewPromptString());
    this._onDidWritePrompt.fire();
  }

  insertChar(char: string) {
    if (!isCharPrintable(char)) {
      return false;
    }
    if (char === '\n') {
      this._onDidWriteData.fire('\x1b[K\r\n');
      if (this._inputCursorIndex !== this._input.length) {
        // TODO: Reprint lines below properly
        this._onDidWriteData.fire(this._input.slice(this._inputCursorIndex));
        this._onDidWriteData.fire('\x1b[G');
      }
      this._setPromptInput(this._input.slice(0, this._inputCursorIndex) + char + this._input.slice(this._inputCursorIndex));
      this._inputCursorIndex += char.length;
      return true;
    }

    // Shift cells right if not at the end
    if (this._inputCursorIndex !== this._input.length) {
      this._onDidWriteData.fire('\x1b[@');
    }
    this._setPromptInput(this._input.slice(0, this._inputCursorIndex) + char + this._input.slice(this._inputCursorIndex));
    this._inputCursorIndex += char.length;
    this._onDidWriteData.fire(char);
    return true;
  }

  backspace(): boolean {
    if (this._input.length === 0 || this._inputCursorIndex === 0) {
      return false;
    }
    if (this._input[this._inputCursorIndex - 1] === '\n') {
      throw new Error('Cannot backspace to previous lines yet');
    }
    this._onDidWriteData.fire('\b\x1b[P');
    this._inputCursorIndex--;
    this._setPromptInput(this._input.substring(0, this._inputCursorIndex) + this._input.substring(this._inputCursorIndex + 1));
    return true;
  }

  setPromptVariable(variable: string, value: string | (() => string | Promise<string>) | undefined) {
    if (value === undefined) {
      this._promptVariables.delete(variable);
    } else {
      this._promptVariables.set(variable, value);
    }
  }

  moveCursor(position: number): boolean {
    if (position < 0 || position > this._input.length) {
      return false;
    }
    const clampedPosition = clamp(position, this._getNewLineBoundaryStart(), this._getNewLineBoundaryEnd());
    if (this._inputCursorIndex === clampedPosition) {
      return false;
    }
    const change = this._inputCursorIndex - clampedPosition;
    const code = change > 0 ? 'D' : 'C';
    const sequence = `\x1b[${code}`.repeat(Math.abs(change));
    this._onDidWriteData.fire(sequence);
    this._inputCursorIndex = clampedPosition;
    return true;
  }

  shouldContinueLine(): boolean {
    let topLevelQuote: string | undefined;
    let escapeChar = false
    let char: string;
    for (let i = 0; i < this._input.length; i++) {
      char = this._input[i];
      if (topLevelQuote) {
        if (!escapeChar && char === topLevelQuote) {
          topLevelQuote = undefined;
        }
      } else {
        if (char === '\'' || char === '"') {
          topLevelQuote = char;
        }
      }
      escapeChar = (char === '\\');
    }
    return !!topLevelQuote;
  }

  private _setPromptInput(text: string) {
    if (this._input !== text) {
      this._input = text;
      this._onDidChangePromptInput.fire(text);
    }
  }

  private async _getNewPromptString(): Promise<string> {
    const unresolved = typeof this.prompt === 'string' ? this.prompt : await this.prompt();
    return this._resolveVariables(unresolved);
  }

  private async _resolveVariables(prompt: string): Promise<string> {
    // TODO: Extracting should be done once when the prompt changes
    // Extract variables to resolve
    const vars: {
      name: string;
      start: number;
      end: number;
    }[] = [];
    let state: 'normal' | 'dollar' | 'curly' = 'normal';
    let earlyExit = false;
    let start = -1;
    for (let i = 0; i < prompt.length; i++) {
      switch (state) {
        case 'normal':
          if (prompt[i] === '$') {
            state = 'dollar';
            start = i;
          }
          break;
        case 'dollar':
          if (prompt[i] === '{') {
            state = 'curly';
          } else if (prompt[i] === '$') {
            start = i;
          } else {
            state = 'normal';
          }
          break;
        case 'curly':
          const end = prompt.indexOf('}', i);
          if (end === -1) {
            earlyExit = true;
          }
          vars.push({
            name: prompt.substring(start + 2, end),
            start,
            end: end + 1
          });
          i = end + 1;
          state = 'normal';
          break;
      }
      if (earlyExit) {
        break;
      }
    }

    // Nothing to resolve
    if (vars.length === 0) {
      return prompt;
    }

    // Resolve all variables asynchronously
    const promises: Promise<{ variable: string, result: string | undefined }>[] = [];
    for (let i = 0; i < vars.length; i++) {
      promises.push(this._resolveVariable(vars[i].name).then(result => ({
        variable: vars[i].name,
        result
      })));
    }
    const results = await Promise.all(promises);

    // TODO: Could be optimized
    // Replace variables in prompt string, in reverse order to avoid shifting indexes
    for (let i = results.length - 1; i >= 0; i--) {
      const result = results[i];
      if (result.result === undefined) {
        console.warn(`Could not resolve variable ${result.variable}`);
        continue;
      }
      prompt = `${prompt.substring(0, vars[i].start)}${result.result}${prompt.substring(vars[i].end)}`;
    }

    return prompt;
  }

  private async _resolveVariable(variable: string): Promise<string | undefined> {
    const promptVariable = this._promptVariables.get(variable);
    if (promptVariable === undefined || typeof promptVariable === 'string') {
      return promptVariable;
    }
    return promptVariable();
  }

  private _getNewLineBoundaryStart(): number {
    let i = this._inputCursorIndex;
    for (; i >= 0; i--) {
      if (this._input[i] === '\n') {
        break;
      }
    }
    return i + 1;
  }

  private _getNewLineBoundaryEnd(): number {
    let i = this._inputCursorIndex;
    // <= because the cursor can be after the last input char
    for (; i <= this._input.length; i++) {
      if (this._input[i] === '\n') {
        break;
      }
    }
    return i - 1;
  }

  moveCursorRelative(amount: number): boolean {
    return this.moveCursor(this._inputCursorIndex + amount);
  }

  moveCursorStartOfLine(): boolean {
    const i = this._getNewLineBoundaryStart();
    if (i === this._inputCursorIndex) {
      return false;
    }
    return this.moveCursor(i);
  }

  moveCursorEndOfLine(): boolean {
    const i = this._getNewLineBoundaryEnd();
    if (i === this._inputCursorIndex) {
      return false;
    }
    return this.moveCursor(i);
  }

  moveCursorWordLeft(): boolean {
    if (this._inputCursorIndex === 0) {
      return false;
    }
    let position = this._inputCursorIndex;
    const boundaryIndex = Math.max(this._getNewLineBoundaryStart(), 0);
    // Skip any adjacent whitespace
    while (position > boundaryIndex && this._input[position - 1] === ' ') {
      position--;
    }
    while (position > boundaryIndex && this._input[position - 1] !== ' ') {
      position--;
    }
    return this.moveCursor(position);
  }

  moveCursorWordRight() {
    if (this._inputCursorIndex === this._input.length - 1) {
      return false;
    }
    let position = this._inputCursorIndex;
    const boundaryIndex = Math.max(this._getNewLineBoundaryEnd(), this._input.length - 1);
    // Skip any adjacent whitespace
    while (position < boundaryIndex && this._input[position + 1] === ' ') {
      position++;
    }
    while (position < boundaryIndex && this._input[position + 1] !== ' ') {
      position++;
    }
    return this.moveCursor(position);
  }

  deleteCursorWordLeft() {
    if (this._inputCursorIndex === this._input.length - 1) {
      return false;
    }

    let position = this._inputCursorIndex;
    const boundaryIndex = Math.max(this._getNewLineBoundaryStart(), 0);
    while (position > boundaryIndex && this._input[position - 1] === ' ') {
      position--;
    }
    while (position > boundaryIndex && this._input[position - 1] !== ' ') {
      position--;
    }
    const charCount = this._inputCursorIndex - position
    this._onDidWriteData.fire('\b\x1b[P'.repeat(charCount));
    this._setPromptInput(this._input.substring(0, position) + this._input.substring(this._inputCursorIndex));
    this._inputCursorIndex -= charCount;
    return true;
  }

  private _reprintPromptInput() {
    const originalCursorPosition = this._inputCursorIndex;
    this.moveCursor(0);
    this._onDidWriteData.fire('\x1b[K');
    this._onDidWriteData.fire(this._input);
    this._inputCursorIndex = this._input.length;
    this.moveCursor(originalCursorPosition);
  }
}
