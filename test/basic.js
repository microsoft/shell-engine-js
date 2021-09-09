const Shell = require('../out/shell.js').Shell;

const shell = new Shell();
shell.onDidWriteData(e => console.log('onDidWriteData: ' + e));
shell.onDidChangePromptInput(e => console.log('onDidChangePromptInput: ' + e));
shell.onDidChangeCwd(e => console.log('onDidChangeCwd: ' + e));

shell.write('foo');
shell.write('\r');

shell.write('history');
shell.write('\r');
