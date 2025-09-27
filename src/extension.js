import * as vscode from 'vscode';
import * as core from './core.js';
import * as tpParser from './parser.js';
import * as tpScanner from './scanner.js';
import * as tpLens from './codeLens.js'

/** @type {Set<string>} Tracks files currently being processed */
const processingFiles = new Set();

/** 
 * Caches vscode.CompletionItem arrays for each Taskp file.
 * Autocompletion for users does not trigger file parsing.
 * Instead we use this cache from the last parse.
 * @type {Map<string, vscode.CompletionItem[]>}
 */
let userCompletionItems = new Map();

/**
 * @param {import('vscode').ExtensionContext} context - The VSCode extension context
 */
export async function activate(context) {
    console.log("activate");

    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider(
            { pattern: `**/*${core.FILE_EXTENSION}` },
            new tpLens.IssueLens()
        )
    );

    vscode.commands.registerCommand(core.COMMAND_JUMP_TO_ISSUE, async (file, line) => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return;
        let fileUri = vscode.Uri.joinPath(workspaceFolder.uri, file);

        const document = await vscode.workspace.openTextDocument(fileUri);
        await vscode.window.showTextDocument(document, {
            selection: new vscode.Range(line, 0, line + 1, 0)
        });
    });

    vscode.commands.registerCommand(core.COMMAND_PROCESS_DOCUMENT, async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !editor.document.fileName.endsWith(core.FILE_EXTENSION)) return;
        await _processDocument(editor.document, true);
    });

    vscode.commands.registerCommand(core.COMMAND_CREATE_TASKP, async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return;

        const fileName = await vscode.window.showInputBox({ prompt: 'Enter .taskp file name', value: 'tasks.taskp' });
        if (!fileName) return;

        const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, fileName.endsWith('.taskp') ? fileName : `${fileName}.taskp`);
        const exampleData = core.NEW_FILE_TEXT;

        await vscode.workspace.fs.writeFile(fileUri, Buffer.from(exampleData));
        const document = await vscode.workspace.openTextDocument(fileUri);
        await vscode.window.showTextDocument(document);
        await _processDocument(document, true);
    });

    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders(async () => {
            // TODO: reset our scanner because the workspace changed?
            const openDocuments = vscode.workspace.textDocuments;
            for (const document of openDocuments) {
                if (!document.fileName.endsWith(core.FILE_EXTENSION)) return;
                await _processDocument(document, true);
            }
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(document => {
            // Dev Note: the scanner causes this event fire when it opens a document to scan code.
            if (!document.fileName.endsWith(core.FILE_EXTENSION)) return;
            _processDocument(document, false);
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(document => {
            if (!document.fileName.endsWith(core.FILE_EXTENSION)) return;
            _processDocument(document, false);
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            if (!event.document.fileName.endsWith(core.FILE_EXTENSION)) return;
            _processDocumentChanges(event.document, event.contentChanges);
        })
    );

    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            [{ language: 'taskp', scheme: 'file' }, { language: 'taskp', scheme: 'untitled' }],
            { provideCompletionItems: _provideCompletionItems.bind(this) },
            '@'
        )
    );

    // Run parser on currently open .taskp files when extension activates
    const openDocuments = vscode.workspace.textDocuments;
    for (const document of openDocuments) {
        await _processDocument(document, true);
    }
}

export function deactivate() {
    console.log("deactivate");
}

/**
 * Parses and updates a `.taskp` document.
 *
 * @async
 * @param {import('vscode').TextDocument} document - The VSCode document to process.
 * @param {boolean} useScanner - If true, instructs the scanner to rescan the entire codebase.
 */
async function _processDocument(document, useScanner) {
    if (!document.fileName.endsWith(core.FILE_EXTENSION)) return;
    if (processingFiles.has(document.fileName)) return;
    processingFiles.add(document.fileName);

    const parser = new tpParser.Parser();
    parser.parse(document, useScanner);
    if (useScanner && parser.issuesLineNumber != -1) {
        let scanner = new tpScanner.Scanner();
        let scanData = await scanner.scan(document.fileName, parser.settings, parser.issuesLineNumber);
        parser.addScanData(scanData)
    }
    _cacheUsersForAutocomplete(document.fileName, parser.users);

    const text = parser.textData.join('\n');
    await _applyTextEdit(document, text);

    processingFiles.delete(document.fileName);
}

/**
 * Replaces the entire content of a VSCode text document with new text.
 *
 * This function works on both open and closed documents. It creates a full-range
 * WorkspaceEdit and applies it. The function validates the range before applying
 * the edit and logs warnings if the document is closed or if the edit fails.
 *
 * @param {import('vscode').TextDocument} document - The VSCode document to update.
 * @param {string} newText - The new text to replace the document content with.
 * @returns {Promise<boolean>} Resolves to true if the edit was successfully applied, false otherwise.
 */
async function _applyTextEdit(document, newText) {
    if (document.isClosed) {
        console.warn("Document is closed");
        return false;
    }

    const fullRange = new vscode.Range(
        document.positionAt(0),
        // TODO: pull this from a cache instead of calling this again
        document.positionAt(document.getText().length)
    );
    if (!document.validateRange(fullRange)) {
        console.warn(`Invalid edit range in ${document.uri.toString()}`);
        return false;
    }

    const edit = new vscode.WorkspaceEdit();
    edit.replace(document.uri, fullRange, newText);

    // TODO: this method will not mark the file as dirty of the taskp file is open. But hitting save will save changes. Find solution that shows the file as dirty.
    const success = await vscode.workspace.applyEdit(edit);
    if (!success) console.warn("Failed to apply edit for:", document.uri.fsPath);
    return success;
}

/**
 * Caches vscode.CompletionItem objects for a specific Taskp file.
 *
 * Each string in the `users` array is converted into a CompletionItem
 * of kind `User` and stored in `this.userCompletionItems` keyed by filename.
 *
 * @param {string} filename - The name or path of the Taskp file.
 * @param {string[]} users - Array of user names to create completion items for.
 */
function _cacheUsersForAutocomplete(filename, users) {
    let completionItems = [];
    for (const user of users) {
        const item = new vscode.CompletionItem(user, vscode.CompletionItemKind.User);
        item.insertText = user;
        completionItems.push(item);
    }
    userCompletionItems.set(filename, completionItems);
}

/**
 * Provides completion items for user mentions in a Taskp document.
 * 
 * This function is called by the VSCode completion provider when the user types.
 * It only triggers if the current line contains an '@' character.
 * Completion items are retrieved from the cached user list for the current file.
 *
 * @param {import('vscode').TextDocument} document - The document in which completion is requested.
 * @param {import('vscode').Position} position - The position of the cursor in the document.
 * @returns {import('vscode').CompletionItem[]} An array of completion items for the current document.
 */
function _provideCompletionItems(document, position) {
    const line = document.lineAt(position.line).text.substring(0, position.character);
    if (!line.includes('@')) return [];
    const items = userCompletionItems.get(document.fileName) || [];
    return [...items];
}

/**
 * Handles text changes in a document.
 * If any change inserts a newline, triggers a re-process of the document.
 * Only the first newline change matters — once detected, processing runs and the rest are ignored.
 *
 * @param {import('vscode').TextDocument} document - The document being edited.
 * @param {readonly import('vscode').TextDocumentContentChangeEvent[]} changes - The list of text changes.
 */
function _processDocumentChanges(document, changes) {
    if (changes.length === 0) return;
    for (const change of changes) {
        if (change.text.includes('\n')) {
            _processDocument(document, false);
            return; // no need to check further, just perform the process
        }
    }
}