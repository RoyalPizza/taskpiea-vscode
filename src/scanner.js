/**
 * scanner.js
 *
 * Scans the codebase for keywords.
 * Uses settings to handle exclude paths.
 */

import * as vscode from 'vscode';
import * as core from './core.js';

export class Scanner {

    /**
     * Scan the workspace for lines containing specific keywords.
     * and generate issue objects with their location and content.
     *
     * @param {string} fileName - The taskp filename this scan is associated with. Currently unused but may be referenced in future enhancements.
     * @param {{ key: string, value: string }[]} settings - An array of key/value pairs representing scanner settings. Keywords to scan for and exclude patterns are extracted from this.
     * @param {number} issuesLineNumber - The starting line number in the document where new issues will be inserted. If -1, scanning is skipped.
     * @returns {Promise<{ issues: { keyword: string, file: string, lineNumber: number, content: string }[] }>} A promise that resolves with an object containing an array of issues found in the workspace.
     */
    async scan(fileName, settings, issuesLineNumber) {

        if (issuesLineNumber === -1) return;

        let issues = [];
        let keywords = [];
        let excludePatterns = [];
        let includePatterns = [];

        for (const setting of settings) {
            switch (setting.key) {
                case core.SETTINGS_KEYS.SCANNER_KEYWORD:
                    keywords.push(setting.value.trim());
                    break;
                case core.SETTINGS_KEYS.SCANNER_EXCLUDE:
                    // TODO: this is iffy. what if users want to be more explicity with this?
                    const trimmedValue = setting.value.trim();
                    if (!trimmedValue.startsWith('**/') || !trimmedValue.endsWith('/**')) {
                        excludePatterns.push(`**/${trimmedValue}/**`);
                    } else {
                        excludePatterns.push(trimmedValue);
                    }
                    break;
            }
        }

        // if we have no keywords, there is no way to scan
        if (keywords.length === 0) return;

        // we need to keep a line number with our TODO in the taskp file for vscode decorators
        let newIssueLineNumber = issuesLineNumber + 1;

        // add default incldues and excludes
        includePatterns.push(...core.CODE_FILE_EXTENSIONS.map(ext => `**/*${ext}`));
        excludePatterns.push(...core.EXCLUDED_DIRECTORIES.map(dir => `**/${dir}/**`));
        excludePatterns.push('*.taskp');

        const files = await vscode.workspace.findFiles(`{${includePatterns.join(',')}}`, `{${excludePatterns.join(',')}}`);
        //console.log(files.length + " files found to scan");
        for (const file of files) {
            //console.log("scanning " + file.path);
            try {
                const document = await vscode.workspace.openTextDocument(file);
                const text = document.getText().split(/\r?\n/);
                for (let i = 0; i < text.length; i++) {
                    const line = text[i];
                    for (const keyword of keywords) {
                        if (line.match(new RegExp(`\\b${keyword}\\b`, 'i'))) {
                            const issue = { keyword, file: vscode.workspace.asRelativePath(file), lineNumber: i, content: line.trim() };
                            newIssueLineNumber++;
                            issues.push(issue);
                            break;
                        }
                    }
                }
            } catch (e) {
                // Skip non-text files (e.g., binary)
                continue;
            }
        }

        return { issues };
    }
}