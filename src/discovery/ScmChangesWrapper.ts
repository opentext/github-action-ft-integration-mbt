/*
 * Copyright 2025 Open Text.
 *
 * The only warranties for products and services of Open Text and
 * its affiliates and licensors (“Open Text”) are as may be set forth
 * in the express warranty statements accompanying such products and services.
 * Nothing herein should be construed as constituting an additional warranty.
 * Open Text shall not be liable for technical or editorial errors or
 * omissions contained herein. The information contained herein is subject
 * to change without notice.
 *
 * Except as specifically indicated otherwise, this document contains
 * confidential information and a valid license is required for possession,
 * use or copying. If this work is provided to the U.S. Government,
 * consistent with FAR 12.211 and 12.212, Commercial Computer Software,
 * Computer Software Documentation, and Technical Data for Commercial Items are
 * licensed to the U.S. Government under vendor's standard commercial license.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *   http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import * as core from '@actions/core';
import * as git from 'isomorphic-git';
import * as fs from 'fs';
import * as path from 'path';
import * as Diff from 'diff';
import { Logger } from '../utils/logger';

const logger: Logger = new Logger('ScmChangesWrapper');

export interface ScmAffectedFileWrapper {
  newPath: string;
  oldPath: string | null;
  changeType: 'ADD' | 'DELETE' | 'EDIT';
  oldId: string;
  newId: string;
}

interface DiffEntry {
  from: string;
  to: string;
  fromId: string | null;
  toId: string | null;
  op?: 'ADD' | 'DEL' | 'MODIFY' | 'RENAME';
}

export default class ScmChangesWrapper {
  public static async getScmChanges(dir: string, oldCommit: string, newCommit: string): Promise<ScmAffectedFileWrapper[]> {
    return wrapScmChanges(dir, oldCommit, newCommit);
  }
}
async function wrapScmChanges(dir: string, oldCommit: string, newCommit: string): Promise<ScmAffectedFileWrapper[]> {
  const affectedFiles: ScmAffectedFileWrapper[] = [];
  
  try {
    // Get diff between old and new commits
    const diffs = await getDiffEntries(dir, oldCommit, newCommit); // Compare to latest commit

    // Rename detection settings
    const renameThreshold = 0.5; // 50% similarity for rename detection

    // First pass: Identify adds, deletes, and potential renames/modifies
    for (const diff of diffs) {
      if (diff.op === 'ADD') {
        affectedFiles.push({
          newPath: diff.to,
          oldPath: null,
          changeType: 'ADD',
          oldId: '', // No old ID for ADD
          newId: diff.toId || '',
        });
      } else if (diff.op === 'DEL') {
        affectedFiles.push({
          newPath: diff.from,
          oldPath: diff.from,
          changeType: 'DELETE',
          oldId: diff.fromId || '',
          newId: '', // No new ID for DELETE
        });
      } else if (diff.op === 'RENAME') {
        affectedFiles.push({
          newPath: diff.to,
          oldPath: diff.from,
          changeType: 'EDIT',
          oldId: (await git.resolveRef({ fs, dir, ref: oldCommit })) || '',
          newId: (await git.resolveRef({ fs, dir, ref: newCommit })) || '',
        });
      } else {
        // Potential MODIFY or RENAME
        const similarity = await calculateSimilarity(dir, oldCommit, newCommit, diff.from, diff.to);
        if (similarity >= renameThreshold) { // only files that have less than 50% change (similarity >= 50%) will be considered as rename
          affectedFiles.push({
            newPath: diff.to,
            oldPath: diff.from,
            changeType: 'EDIT',
            oldId: (await git.resolveRef({ fs, dir, ref: oldCommit })) || '',
            newId: (await git.resolveRef({ fs, dir, ref: newCommit })) || '',
          });
        } else { // COPY, MODIFY
          affectedFiles.push({
            newPath: diff.to,
            oldPath: diff.from,
            changeType: 'EDIT',
            oldId: diff.toId || '',
            newId: diff.toId || '',
          });
        }
      }
    }

    return affectedFiles;
  } catch (error) {
    throw new Error(`Failed to process SCM changes: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Get diff entries between two commits
async function getDiffEntries(dir: string, oldCommit: string, newCommit: string): Promise<DiffEntry[]> {
  const gitdir = path.join(dir, '.git');
  logger.debug('Starting getDiffEntries with:', { dir, gitdir, oldCommit, newCommit });

  const allowedExtensions = /\.(tsp|st)$/i;
  const allowedFilenames = /^(ACTIONS\.XML|Resource\.MTR)$/i;

  const results = await git.walk({
    fs,
    dir,
    gitdir,
    trees: [
      git.TREE({ ref: oldCommit }),
      git.TREE({ ref: newCommit }),
    ],
    map: async function (filepath, [oldEntry, newEntry]) {
      const from = oldEntry ? filepath : 'dev/null';
      const to = newEntry ? filepath : 'dev/null';
      const fromId = oldEntry ? await oldEntry.oid() : null;
      const toId = newEntry ? await newEntry.oid() : null;

      // Return null for no change or non-existent in both
      if (fromId === toId && fromId !== null) {
        return null;
      }
      if (from === 'dev/null' && to === 'dev/null') {
        return null;
      }

      return { from, to, fromId, toId };
    },
    reduce: async function (parent, children) {
      let result: DiffEntry[] = [];

      // Helper function to check if a diff entry matches our filter
      const matchesFilter = (entry: DiffEntry): boolean => {
        // Use from path for deleted files, to path otherwise
        const relevantPath = (entry.from !== 'dev/null' && entry.to === 'dev/null') 
          ? entry.from 
          : entry.to;
        
        // Skip root directory check (we want to process all directories)
        if (relevantPath === '.') {
          return true;
        }

        const filename = path.basename(relevantPath);
        return allowedExtensions.test(filename) || allowedFilenames.test(filename);
      };

      // Include parent if it’s a DiffEntry and not the root "."
      if (parent && 'from' in parent && parent.from !== '.' && parent.to !== '.') {
        if (matchesFilter(parent)) {
          result.push(parent);
        }
      }

      // Process children
      for (const child of children) {
        if (child && 'from' in child) {
          if (matchesFilter(child)) {
            result.push(child);
          }
        } else if (Array.isArray(child)) { // Flatten nested arrays and filter
          result = result.concat(child.filter((item): item is DiffEntry => item !== null && 'from' in item && matchesFilter(item)));
        }
      }

      return result;
    }
  }) ?? [];

  if (!results?.length) {
    console.warn('No differences found.');
    return [];
  }

  // Post-process to detect renames
  const deletes: DiffEntry[] = [];
  const adds: DiffEntry[] = [];
  const others: DiffEntry[] = [];

  // Categorize filtered entries
  for (const entry of results) {
    if (entry.from !== 'dev/null' && entry.to === 'dev/null') {
      deletes.push(entry);
    } else if (entry.from === 'dev/null' && entry.to !== 'dev/null') {
      adds.push(entry);
    } else {
      others.push(entry);
    }
  }

  // Process renames
  const finalResults: DiffEntry[] = [];
  const usedAdds = new Set<DiffEntry>();

  for (const del of deletes) {
    const matchingAdd = adds.find(
      add => add.toId === del.fromId && !usedAdds.has(add)
    );
    if (matchingAdd) {
      // Found a rename
      usedAdds.add(matchingAdd);
      finalResults.push({
        from: del.from,
        to: matchingAdd.to,
        fromId: del.fromId,
        toId: matchingAdd.toId,
        op: 'RENAME',
      });
    } else {// Regular delete
      finalResults.push({ ...del, op: 'DEL' });
    }
  }

  // Add remaining adds
  for (const add of adds) {
    if (!usedAdds.has(add)) {
      finalResults.push({ ...add, op: 'ADD' });
    }
  }

  // Add other operations (modifications, including root directory)
  for (const other of others) {
    finalResults.push({ ...other, op: 'MODIFY' });
  }

  if (!finalResults?.length) {
    console.warn('No differences found.');
  }

  return finalResults;
}

// Calculate similarity using the diff library
async function calculateSimilarity(dir: string, oldCommit: string, newCommit: string, oldPath: string, newPath: string ): Promise<number> {
  try {
    const oldContent = await git.readBlob({ fs, dir, gitdir: path.join(dir, '.git'), oid: oldCommit, filepath: oldPath });
    const newContent = await git.readBlob({ fs, dir, gitdir: path.join(dir, '.git'), oid: newCommit, filepath: newPath });

    // Convert Uint8Array to UTF-8 string using Buffer
    const oldStr = Buffer.from(oldContent.blob).toString('utf8');
    const newStr = Buffer.from(newContent.blob).toString('utf8');

    // Use diff library to compute line-by-line differences
    const differences = Diff.diffLines(oldStr, newStr, { ignoreWhitespace: true });
    let unchangedLines = 0;
    let totalLines = 0;

    for (const part of differences) {
      const lines = part.value.split('\n').length - 1; // Count lines (subtract 1 for trailing newline)
      totalLines += lines;
      if (!part.added && !part.removed) {
        unchangedLines += lines; // Count unchanged lines
      }
    }

    // Calculate similarity as the ratio of unchanged lines to total lines
    return totalLines > 0 ? unchangedLines / totalLines : 0;
  } catch (error) {
    const err = `Failed to compute similarity for ${oldPath} -> ${newPath}: ${error}`
    logger.error(err);
    core.error(err);
    return 0; // Default to no similarity if content can't be read
  }
}
