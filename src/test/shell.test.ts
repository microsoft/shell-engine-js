/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { strictEqual } from 'assert';
import { Terminal } from 'xterm-headless';
import { Shell } from '../shell.js';

describe('Shell', () => {
  let term: Terminal;
  let shell: Shell
  let lastWritePromise: Promise<void>;

  function termBuffer(): string {
    let lines: string[] = [];
    const buffer = term.buffer.active;
    for (let i = 0; i < buffer.length; i++) {
      lines.push(buffer.getLine(i)?.translateToString(true) ?? '');
    }
    // Trim trailing \n
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i] !== '') {
        break;
      }
      lines.pop();
    }
    return lines.join('\n');
  }

  async function assertBuffer(...expectedLines: string[]): Promise<void> {
    await lastWritePromise;
    strictEqual(termBuffer(), expectedLines.join('\n'));
  }

  beforeEach(() => {
    term = new Terminal();
    term.resize(80, 30);
    shell = new Shell();
    shell.resize(80, 30);
    term.onData(e => shell.write(e));
    shell.onDidWriteData(e => {
      lastWritePromise = new Promise<void>(r => {
        term.write(e, r);
      });
    });
    shell.prompt = '$ ';
  });

  it('basic line', async () => {
    await shell.start();
    shell.write('foo');
    await assertBuffer('$ foo');
    shell.write('\r');
    await assertBuffer(
      '$ foo',
      'foo: command not found',
      '$ '
    );
  });

  describe('keybindings', () => {
    beforeEach(async () => {
      await shell.start();
      shell.write(`foo bar baz`);
      // Move cursor to a in "bar"
      for (let i = 0; i < 6; i++) {
        shell.write('\x02');
      }
      strictEqual(shell.promptInputCursorIndex, 5);
      await lastWritePromise;
      strictEqual(term.buffer.active.cursorX, 7); // '$ ' + prompt input
    });
    it('ctrl+f      - move one character forward', async () => {
      shell.write('\x06');
      await assertBuffer('$ foo bar baz');
      strictEqual(shell.promptInputCursorIndex, 6);
      strictEqual(term.buffer.active.cursorX, 8);
    });
    it('right arrow - move one character forward', async () => {
      shell.write('\x1b[C');
      await assertBuffer('$ foo bar baz');
      strictEqual(shell.promptInputCursorIndex, 6);
      strictEqual(term.buffer.active.cursorX, 8);
    });
    it('ctrl+b      - move one character back', async () => {
      shell.write('\x02');
      await assertBuffer('$ foo bar baz');
      strictEqual(shell.promptInputCursorIndex, 4);
      strictEqual(term.buffer.active.cursorX, 6);
    });
    it('left arrow  - move one character back', async () => {
      shell.write('\x1b[D');
      await assertBuffer('$ foo bar baz');
      strictEqual(shell.promptInputCursorIndex, 4);
      strictEqual(term.buffer.active.cursorX, 6);
    });
    it('ctrl+a      - move to the start of the command line', async () => {
      shell.write('\x01');
      await assertBuffer('$ foo bar baz');
      strictEqual(shell.promptInputCursorIndex, 0);
      strictEqual(term.buffer.active.cursorX, 2);
    });
    it('home        - move to the start of the command line', async () => {
      shell.write('\x1b[H');
      await assertBuffer('$ foo bar baz');
      strictEqual(shell.promptInputCursorIndex, 0);
      strictEqual(term.buffer.active.cursorX, 2);
    });
    it('ctrl+e      - move to the end of the command line', async () => {
      shell.write('\x05');
      await assertBuffer('$ foo bar baz');
      strictEqual(shell.promptInputCursorIndex, 11);
      strictEqual(term.buffer.active.cursorX, 13);
    });
    it('end         - move to the end of the command line', async () => {
      shell.write('\x1b[F');
      await assertBuffer('$ foo bar baz');
      strictEqual(shell.promptInputCursorIndex, 11);
      strictEqual(term.buffer.active.cursorX, 13);
    });
    it('alt+f       - move one character forward', async () => {
      shell.write('\x1bf');
      await assertBuffer('$ foo bar baz');
      strictEqual(shell.promptInputCursorIndex, 6);
      strictEqual(term.buffer.active.cursorX, 8);
    });
    it('ctrl+right  - move one character forward', async () => {
      shell.write('\x1b[1;5C');
      await assertBuffer('$ foo bar baz');
      strictEqual(shell.promptInputCursorIndex, 6);
      strictEqual(term.buffer.active.cursorX, 8);
    });
    it('alt+b       - move one character backward', async () => {
      shell.write('\x1bb');
      await assertBuffer('$ foo bar baz');
      strictEqual(shell.promptInputCursorIndex, 4);
      strictEqual(term.buffer.active.cursorX, 6);
    });
    it('ctrl+left   - move one character backward', async () => {
      shell.write('\x1b[1;5D');
      await assertBuffer('$ foo bar baz');
      strictEqual(shell.promptInputCursorIndex, 4);
      strictEqual(term.buffer.active.cursorX, 6);
    });
  });
});
