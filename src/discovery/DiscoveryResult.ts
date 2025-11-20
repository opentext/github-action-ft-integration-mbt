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
import { Logger } from '../utils/logger';
import AutomatedTest from '../dto/ft/AutomatedTest';
import ScmResourceFile from '../dto/ft/ScmResourceFile';
import { OctaneStatus } from '../dto/ft/OctaneStatus';

const logger: Logger = new Logger('Discovery');

export default class DiscoveryResult {
  private readonly _tests: ReadonlyArray<AutomatedTest>;
  private readonly _scmResxFiles: ReadonlyArray<ScmResourceFile>;
  private readonly _hasChanges: boolean = false;
  private readonly _newCommit: string;
  private readonly _isFullSync: boolean;
  constructor(newCommit: string, tests: AutomatedTest[], scmResxFiles: ScmResourceFile[], isFullSync: boolean) {
    logger.debug('DiscoveryResult constructor ...');
    this._newCommit = newCommit;
    this._isFullSync = isFullSync;
    this._tests = Object.freeze(tests);
    this._scmResxFiles = Object.freeze(scmResxFiles);
    this._hasChanges = tests.length > 0 || scmResxFiles.length > 0;
  }

  public isFullSync(): boolean {
    return this._isFullSync;
  }

  public getNewCommit(): string {
    return this._newCommit;
  }

  public hasChanges(): boolean {
    return this._hasChanges;
  }

  public getAllTests(): ReadonlyArray<AutomatedTest> {
    return this._tests;
  }

  public getNewTests(): ReadonlyArray<AutomatedTest> {
    return this._tests.filter(t => t.octaneStatus == OctaneStatus.NEW);
  }

  public getUpdatedTests(): ReadonlyArray<AutomatedTest> {
    return this._tests.filter(t => t.octaneStatus == OctaneStatus.MODIFIED);
  }

  public getDeletedTests(): ReadonlyArray<AutomatedTest> {
    return this._tests.filter(t => t.octaneStatus == OctaneStatus.DELETED);
  }

  public getScmResxFiles(): ReadonlyArray<ScmResourceFile> {
    return this._scmResxFiles;
  }
}

