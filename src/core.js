/**
 * core.js
 */

import * as vscode from 'vscode';

/** @type {number} Minimum numeric value for generated IDs (0 in decimal). */
export const MIN_ID = 0;

/** @type {number} Maximum numeric value for generated IDs (5-digit hex = 0xFFFFF = 1048575 in decimal). */
export const MAX_ID = 1048575;

/** @type {string} File extension used by Taskpiea documents. */
export const FILE_EXTENSION = ".taskp";

/** @type {string} Command identifier for jumping to an issue in a `.taskp` file. */
export const COMMAND_JUMP_TO_ISSUE = 'taskpiea.jumpToIssue';

/** @type {string} Command identifier for fully processing a `.taskp` file. */
export const COMMAND_PROCESS_DOCUMENT = 'taskpiea.processDocument';

/** @type {string} Command identifier for creating a new `.taskp` file. */
export const COMMAND_CREATE_TASKP = 'taskpiea.createTaskpFile';

/** @type {vscode.TextEditorDecorationType} Decoration style applied to issues (underline + pointer cursor). */
export const ISSUE_DECORATION_TYPE = vscode.window.createTextEditorDecorationType({ 
    textDecoration: 'underline', 
    cursor: 'pointer' 
});

/** @type {{NONE:string,TASKS:string,ISSUES:string,USERS:string,SETTINGS:string}} Logical sections used within `.taskp` documents. */
export const SECTIONS = {
    NONE: 'NONE',
    TASKS: 'TASKS',
    ISSUES: 'ISSUES',
    USERS: 'USERS',
    SETTINGS: 'SETTINGS',
};

/** @type {{SCANNER_KEYWORD:string,SCANNER_EXCLUDE:string}} Keys for extension settings stored in VSCode configuration. */
export const SETTINGS_KEYS = {
    SCANNER_KEYWORD: 'Scanner.Keyword',
    SCANNER_EXCLUDE: 'Scanner.Exclude',
};
export const NEW_FILE_TEXT = 
`[TASKS]
- Example task @alice [#A1B2C]
-- example comment

[ISSUES]

[USERS]
- alice

[SETTINGS]
Scanner.Keyword: TODO
Scanner.Keyword: FIXME
Scanner.Keyword: BUG
Scanner.Exclude: *.md
Scanner.Exclude: *.taskp
`;