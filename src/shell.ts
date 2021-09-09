import { IDisposable, Shell as ShellApi } from "js-shell-engine";
import { EventEmitter } from "./events";
import { Disposable, toDisposable } from "./lifecycle";

declare global {
  const console: {
    log(...data: any[]): void;
  };
}

export class Shell extends Disposable implements ShellApi {
  cwd: string = '';
  dimensions = {
    rows: 0,
    cols: 0
  };
  promptInput: string = '';

  private _onDidChangeCwd = new EventEmitter<string>();
  readonly onDidChangeCwd = this._onDidChangeCwd.event;
  private _onDidChangePromptInput = new EventEmitter<string>();
  readonly onDidChangePromptInput = this._onDidChangePromptInput.event;
  private _onDidWriteData = new EventEmitter<string>();
  readonly onDidWriteData = this._onDidWriteData.event;

  start() {
    this._resetPrompt(true);
  }

  async write(data: string) {
    switch (data) {
      case '\u0003': // Ctrl+C
        this._onDidWriteData.fire('^C');
        this._resetPrompt();
        break;
      case '\r': // Enter
        await this._runCommand(this.promptInput);
        this._setPrompt('');
        break;
      case '\u007F': // Backspace (DEL)
        this._onDidWriteData.fire('\b \b');
        if (this.promptInput.length > 0) {
          this._setPrompt(this.promptInput.substr(0, this.promptInput.length - 1));
        }
        break;
      default: // Print all other characters for demo
        if (data >= String.fromCharCode(0x20) && data <= String.fromCharCode(0x7B)) {
          this._setPrompt(this.promptInput + data);
          this._onDidWriteData.fire(data);
        }
    }
  }

  resize(cols: number, rows: number): void {

  }

  registerCommand(name: string, spec: any): IDisposable {
    console.log(`Registered ${name}`);
    return toDisposable(() => {
    });
  }

  private async _runCommand(input: string) {
    console.log(`Run command ${input}`);
    this._onDidWriteData.fire(`\n\r${input}`);
  }

  private _resetPrompt(suppressNewLine: boolean = false) {
    this._setPrompt('');
    this._onDidWriteData.fire(`${suppressNewLine ? '' : '\r\n'}$ `);
  }

  private _setPrompt(text: string) {
    if (this.promptInput !== text) {
      this.promptInput = text;
      this._onDidChangePromptInput.fire(text);
    }
  }
}
