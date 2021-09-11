import { Shell } from '../out/shell.js';
import { Terminal } from 'xterm';

const terminal = new Terminal();
terminal.open(document.querySelector('#terminal-container'));
window.term = terminal;

const shell = new Shell();
window.shell = shell;

terminal.onData(e => shell.write(e));
shell.onDidWriteData(e => terminal.write(e));

shell.start();
