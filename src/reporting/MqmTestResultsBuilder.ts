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
import { JUnitXmlIterator } from './JUnitXmlIterator';
import { create } from 'xmlbuilder';
import { TestResult } from './TestResult';
import { Logger } from '../utils/logger';
import { BuildInfo } from './interfaces';

const logger = new Logger('MqmTestResultsBuilder');

export class MqmTestResultsBuilder {
  private junitResult: TestResult
  private buildInfo: BuildInfo;
  private mqmTestsFile: string;
  private buildStarted: number;
  private runResultsFilesMap: Map<number, string>;

  constructor(
    junitResult: TestResult, buildInfo: BuildInfo, mqmTestsFile: string, runResultsFilesMap: Map<number, string>) {
    this.junitResult = junitResult;
    this.buildInfo = buildInfo;
    this.buildStarted = Date.now();
    this.mqmTestsFile = mqmTestsFile;
    this.runResultsFilesMap = runResultsFilesMap;
  }

  public async invoke(): Promise<void> {
    try {
      logger.debug(`invoke: Processing JUnit test results ...`);

      const iterator = new JUnitXmlIterator(this.buildInfo, this.buildStarted, this.runResultsFilesMap);
      await iterator.processXmlResult(this.junitResult);
      const testResults = iterator.getTestResults();

      await fs.ensureFile(this.mqmTestsFile as string);

      const root = create('test_result');
      root.e('build', {
        server_id: this.buildInfo.serverId,
        job_id: this.buildInfo.jobId,
        build_id: this.buildInfo.buildId/*,
        artifact_id: this.buildInfo.artifactId*/
      });

      const testRuns = root.e('test_runs');
      for (const testResult of testResults) {
        testResult.writeXmlElement(testRuns);
      }

      const xmlString = root.end({ pretty: true });

      // Use Promises for file stream operations
      await new Promise((resolve, reject) => {
        const mqmFileStream = fs.createWriteStream(this.mqmTestsFile, { flags: 'a' });

        mqmFileStream.on('finish', () => {
          logger.debug('File has been written successfully');
          resolve(true);
        });

        mqmFileStream.on('error', (err) => {
          logger.error('Error writing to file:', err);
          reject(err);
        });

        mqmFileStream.write(xmlString);
        mqmFileStream.end();
      });

      logger.debug(`invoke: Finished writing test results to ${this.mqmTestsFile}`);

    } catch (error) {
      logger.error('Error in invoke method:', error as Error);
    }
  }
}