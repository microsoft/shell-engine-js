import { Shell } from "../types.js";
import * as minimist from 'minimist';

export function registerEchoCommand(shell: Shell) {
  shell.commands.registerCommand('echo', {
    async run(write, ...args) {
      const parsedArgs = minimist(args, {
        boolean: ['e']
      });
      for (let i = 1; i < parsedArgs._.length; i++) {
        if (i > 1) {
          write(' ');
        }
        if (parsedArgs.e) {
          write(decodeEscapes(parsedArgs._[i]));
        } else {
          write(parsedArgs._[i]);
        }
      }
      return 0;
    },
  });
}

function decodeEscapes(data: string): string {
  let result = data
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r');
  while (true) {
    const match = result.match(/\\x([0-9a-fA-F]{2})/);
    if (match === null || match.index === undefined || match.length < 2) {
      break;
    }
    result = result.slice(0, match.index) + String.fromCharCode(parseInt(match[1], 16)) + result.slice(match.index + 4);
  }
  return result;
}
