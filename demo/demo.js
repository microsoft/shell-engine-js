import { Shell } from '../out/shell.js';
import { Terminal } from 'xterm';

const terminal = new Terminal();
terminal.open(document.querySelector('#terminal-container'));

const shell = new Shell({
  welcomeMessage: [
    '    Xterm.js is the frontend component that powers many terminals including',
    '                           \x1b[3mVS Code\x1b[0m, \x1b[3mHyper\x1b[0m and \x1b[3mTheia\x1b[0m!',
    '',
    ' ┌ \x1b[1mFeatures\x1b[0m ──────────────────────────────────────────────────────────────────┐',
    ' │                                                                            │',
    ' │  \x1b[31;1mApps just work                         \x1b[32mPerformance\x1b[0m                        │',
    ' │   Xterm.js works with most terminal      Xterm.js is fast and includes an  │',
    ' │   apps like bash, vim and tmux           optional \x1b[3mWebGL renderer\x1b[0m           │',
    ' │                                                                            │',
    ' │  \x1b[33;1mAccessible                             \x1b[34mSelf-contained\x1b[0m                     │',
    ' │   A screen reader mode is available      Zero external dependencies        │',
    ' │                                                                            │',
    ' │  \x1b[35;1mUnicode support                        \x1b[36mAnd much more...\x1b[0m                   │',
    ' │   Supports CJK 語 and emoji \u2764\ufe0f            \x1b[3mLinks\x1b[0m, \x1b[3mthemes\x1b[0m, \x1b[3maddons\x1b[0m, \x1b[3mtyped API\x1b[0m  │',
    ' │                                            ^ Try clicking italic text      │',
    ' │                                                                            │',
    ' └────────────────────────────────────────────────────────────────────────────┘',
    ''
  ].join('\n\r')
});

terminal.onData(e => shell.write(e));
shell.onDidWriteData(e => terminal.write(e));

shell.start();

window.term = terminal;
window.shell = shell;