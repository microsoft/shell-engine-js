import { Shell } from "js-shell-engine";

export function initTabCompletion(shell: Shell) {
  shell.onDidPressTab(() => {
    const input = shell.promptInput;

    // Get all possible completions matching the first part of the command
    let completions: string[] = [];
    for (const name of shell.commands.commandNames) {
      if (name.startsWith(input)) {
        completions.push(name);
      }
    }

    // Return early
    if (completions.length === 0) {
      return;
    }

    // Get the shortest possible completion fragment from completions
    let completion = completions[completions.length - 1];
    for (let i = 1; i < completions.length; i++) {
      completion = getCommonStart(completions[i], completion);
    }

    // Write the completion, excluding the prefix that already exists
    shell.write(completion.substring(input.length));
  });
}

function getCommonStart(a: string, b: string): string {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) {
    i++
  }
  return a.substring(0, i);
}
