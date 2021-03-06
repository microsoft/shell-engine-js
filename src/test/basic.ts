/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Shell } from '../shell.js';

const shell = new Shell();
shell.onDidWriteData(e => console.log('onDidWriteData: ' + e));
shell.onDidChangePromptInput(e => console.log('onDidChangePromptInput: ' + e));
shell.onDidChangeCwd(e => console.log('onDidChangeCwd: ' + e));

shell.write('foo');
shell.write('\r');

shell.write('history');
shell.write('\r');
