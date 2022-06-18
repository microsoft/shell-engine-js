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

  async function assertBuffer(expected: string): Promise<void> {
    await lastWritePromise;
    strictEqual(termBuffer(), expected);
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
  });

  it('basic write', async () => {
    shell.write('foo\nbar\n\rfoobar');
    await assertBuffer('foo\n   bar\nfoobar');
  });
});
