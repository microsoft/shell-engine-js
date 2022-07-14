import { Shell } from '../../out/shell.js';
import { initHistory } from '../../out/modules/history.js';
// import { initTabCompletion } from '../../out/modules/tabCompletion.js';
import { initHelp } from '../../out/modules/help.js';
import { initVscodeShellIntegration } from '../../out/modules/vscodeShellIntegration.js';
import { Terminal } from 'xterm';

const terminal = new Terminal({
  fontFamily: 'Hack, "Fira Code", monospace'
});
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
    ' │                                                                            │',
    ' └────────────────────────────────────────────────────────────────────────────┘',
    ''
  ].join('\n\r')
});

// Initialize all modules
initHistory(shell);
// initTabCompletion(shell);
initHelp(shell);
initVscodeShellIntegration(shell);

// Set prompt and register some prompt variables
shell.prompt.prompt = '\x1b[1;34m${hostname}\x1b[39m@\x1b[32m${time}\x1b[39m>\x1b[0m ';
shell.prompt.setPromptVariable('hostname', 'my-pc');
shell.prompt.setPromptVariable('time', () => {
  const now = new Date();
  return `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
})

// Attach terminal <-> shell
terminal.onData(e => shell.write(e));
shell.onDidWriteData(e => terminal.write(e));

// Start the shell
shell.start();



// Demo buttons
function setupDebugButtons() {
  document.querySelector('#enable-debug-logs').addEventListener('click', () => terminal.options.logLevel = 'debug');
}
setupDebugButtons();

// Demo debug info
function setupDebugInfo() {
  const promptElement = document.querySelector('#debug-prompt');
  shell.onDidChangePromptInput(e => {
    promptElement.innerHTML = e.replace(/ /g, '&nbsp;').replace(/\n/g, '<br>');
  });
  const bellElement = document.querySelector('#debug-bell');
  terminal.onBell(() => bellElement.innerText = new Date().toLocaleTimeString());
}
setupDebugInfo();


// Setup globals for debugging
window.term = terminal;
window.shell = shell;



// Example of custom command handler
shell.commands.registerCommandHandler({
  handleCommand(input, ...argv) {
    if (argv[0] === 'custom') {
      return {
        command: {
          name: argv[0],
          argv,
          commandLine: input
        },
        async run(write) {
          write(`Custom command running: ["${argv.join('", "')}"]`);
          return 0;
        }
      };
    }
    return undefined;
  },
  shouldWrap(input) {
    return input.split(' ')[0] === 'custom';
  }
});



// Example of native autocomplete via communicating with shell
// initCustomTabCompletion(shell);
// const completionElement = document.createElement('div');
// document.body.appendChild(completionElement);
// terminal.parser.registerOscHandler(633, data => {
//   const [command, ...args] = data.split(';');
//   if (command === 'P' && args[0] === 'CompletionsSupport?') {
//     shell.write('\x1b]633;P;Yes\x07');
//     return true;
//   }
//   if (command === 'Completions') {
//     completionElement.innerHTML = 'Completions:<br>';
//     const completions = args[1].split('<CL>');
//     const fragment = new DocumentFragment();
//     for (const c of completions) {
//       const element = document.createElement('button');
//       element.innerText = c;
//       element.addEventListener('click', () => {
//         shell.write(c.substring(args[0].length));
//         completionElement.innerHTML = '';
//         terminal.focus();
//       });
//       fragment.appendChild(element);
//     }
//     completionElement.appendChild(fragment);
//     return true;
//   }
//   return false
// });
// // Ask if completions are supported
// shell.writeOsc(633, 'P;CompletionsSupport?');

// function initCustomTabCompletion(shell) {
//   return shell.onDidPressTab(() => {
//     const input = shell.promptInput;

//     // Get all possible completions matching the first part of the command
//     let completions = [];
//     for (const name of shell.commands.commandNames) {
//       if (name.startsWith(input)) {
//         completions.push(name);
//       }
//     }

//     // Return early
//     if (completions.length === 0) {
//       shell.write('\x07');
//       return;
//     }

//     shell.write(`\x1b]633;Completions;${input};${completions.join('<CL>')}\x07`);
//   });
// }
