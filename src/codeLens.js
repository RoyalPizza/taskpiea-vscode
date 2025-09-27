/**
 * issueLens.js
 *
 * Provides CodeLens functionality for Taskpiea `.taskp` documents.
 *
 * Each line containing an issue reference in the form `[filename::line]`
 * will have a CodeLens rendered above it, allowing the user to jump
 * directly to the target file and line when clicked.
 *
 * The CodeLens passes the filename and line number as arguments
 * to the registered `COMMAND_JUMP_TO_ISSUE` command.
 *
 * This class does not modify the document content; it only provides
 * interactive UI elements for navigation within the VSCode editor.
 */

import * as vscode from 'vscode';
import * as core from './core.js';

export class IssueLens {

    /**
     * Provide CodeLenses for a document.
     * @param {vscode.TextDocument} document 
     * @param {vscode.CancellationToken} token 
     * @returns {vscode.CodeLens[]}
     */
    provideCodeLenses(document, token) {
        const lenses = [];

        for (let i = 0; i < document.lineCount; i++) {
            const lineText = document.lineAt(i).text;
            
            const match = lineText.match(/\[(.+?)::(\d+)\]/);
            if (match) {
                const issueFile = match[1];
                const issueLine = parseInt(match[2], 10);

                const range = new vscode.Range(i, 0, i, 0);
                lenses.push(new vscode.CodeLens(range, {
                    title: `Jump to ${issueFile}:${issueLine}`,
                    command: core.COMMAND_JUMP_TO_ISSUE,
                    arguments: [issueFile, issueLine]
                }));
            }
        }

        return lenses;
    }
}