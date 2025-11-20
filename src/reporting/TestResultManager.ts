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
import * as fs from 'fs-extra';
import * as path from 'path';
import { MqmTestResultsBuilder } from './MqmTestResultsBuilder';
import { Logger } from '../utils/logger'
import { config } from '../config/config';
import FTL from '../ft/FTL';
import { TestResult } from './TestResult';
import { BuildInfo } from './interfaces';
import GitHubClient from '../client/githubClient';

const logger = new Logger('TestResultManager');

export class TestResultManager {
  public static async buildOctaneXmlFile(buildInfo: BuildInfo, junitResult: TestResult): Promise<string> {
    logger.debug(`buildOctaneXmlFile: ...`, buildInfo);
    const mbtPath = path.join(config.runnerWorkspacePath, FTL._MBT);
    await fs.ensureDir(mbtPath);
    const junitResXmlFile = path.join(mbtPath, 'junitResult.xml');
    await fs.writeFile(junitResXmlFile, junitResult.toXML());
    const mqmTestsFile = path.join(mbtPath, 'mqmTests.xml');
    const runResultsFilesMap = await this.collectRunResultsXmlFiles(mbtPath);

    const runId2artifactIdMap = await this.buildArtifacts(buildInfo.buildId, mbtPath, runResultsFilesMap);

    const builder = new MqmTestResultsBuilder(junitResult, { ...buildInfo, runId2artifactIdMap }, mqmTestsFile, runResultsFilesMap);
    await builder.invoke();
    await GitHubClient.uploadArtifact(mbtPath, [junitResXmlFile, mqmTestsFile], `junit_results`);
    logger.debug(`buildOctaneXmlFile: Finished writing mqmTests.xml`);
    return mqmTestsFile;
  }

  private static async buildArtifacts(buildId: number, mbtPath: string, runResultsFilesMap: Map<number, string>): Promise<Map<number, number>> {
    logger.debug(`buildArtifacts: buildId=${buildId} ...`);

    const uploadPromises = Array.from(runResultsFilesMap.entries()).map(async ([runId, filePath]) => {
      const dir = path.dirname(filePath);
      const artifactId = await GitHubClient.uploadArtifact(mbtPath, [dir], `run_results_${runId}`);
      return { runId, artifactId };
    });

    const results = await Promise.allSettled(uploadPromises);
    const runId2ArtifactIdMap = new Map<number, number>();

    for (const [index, result] of results.entries()) {
      if (result.status === 'fulfilled') {
        const { runId, artifactId } = result.value;
        (runId > 0) && runId2ArtifactIdMap.set(runId, artifactId);
      } else {
        const runId = Array.from(runResultsFilesMap.keys())[index];
        const error = result.reason;
        logger.error(`Failed to upload artifact for runId ${runId}: ${error.message}`, error);
      }
    }
    return runId2ArtifactIdMap;
  }

  private static async collectRunResultsXmlFiles(mbtPath: string): Promise<Map<number, string>> {
    logger.debug(`collectRunResultsXmlFiles: mbtPath=[${mbtPath}] ...`);
    const runResultsFilesMap = new Map<number, string>();
    const files = await fs.readdir(mbtPath, { recursive: true, encoding: 'utf8' });
    const runResultsFiles = files.filter(file => file.endsWith('run_results.xml'));

    for (const file of runResultsFiles) {
      const filePath = path.join(mbtPath, file);
      const runId = this.extractRunIdFromPath(filePath);
      runResultsFilesMap.set(runId, filePath);
      logger.debug(`runId=${runId}, [${filePath}]`);
    }

    logger.debug(`Found ${runResultsFilesMap.size} run_results.xml files`);
    return runResultsFilesMap;
  }

  private static extractRunIdFromPath(filePath: string): number {
    logger.debug(`extractRunIdFromPath: [${filePath}]`);
    const dirParts = path.parse(filePath).dir.split(path.sep);
    const reportIndex = dirParts.lastIndexOf(dirParts.find(part => /^Report.*/.test(part)) || '');
    if (reportIndex > 1) return parseInt(dirParts[reportIndex - 2], 10);
    throw new Error(`extractRunIdFromPath: Invalid path [${filePath}]`);
  }
}