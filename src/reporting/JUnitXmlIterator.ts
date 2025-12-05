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
import { BuildInfo, RunResultsSteps, TestErr } from './interfaces';
import { JUnitTestResult } from './JUnitTestResult';
import { Logger } from '../utils/logger';
import { TestResult } from './TestResult';
import { CaseResult } from './CaseResult';
import { getMBTData } from './utils';
import { config } from '../config/config';

const logger = new Logger('JUnitXmlIterator');
export class JUnitXmlIterator {
  private readonly buildStarted: number;
  private readonly buildInfo: BuildInfo;
  private readonly runResultsFilesMap: Map<number, string>;
  private testNameToJunitResultMap: Map<string, JUnitTestResult> = new Map();
  private resultData: RunResultsSteps[] = [];

  constructor(buildInfo: BuildInfo, buildStarted: number, runResultsFilesMap: Map<number, string>) {
    this.buildInfo = buildInfo;
    this.buildStarted = buildStarted;
    this.runResultsFilesMap = runResultsFilesMap;
  }

  public async processXmlResult(result: TestResult): Promise<void> {
    if (result.suites) {
      for (const suite of result.suites) {
        if (suite.cases) {
          for (const testCase of suite.cases) {
            await this.processTestCase(testCase);
          }
        }
      }
    }
  }

  private async processTestCase(tc: CaseResult): Promise<void> {
    const testName = (tc.testName || ''); //getLastFolderFromPath
    const testDuration = tc.duration || 0;
    let status = tc.skipped ? 'Skipped' : 'Passed';
    let errorType = '';
    let errorMsg = '';
    let stackTraceStr = '';
    if (tc.errorStackTrace || tc.errorDetails) {
      status = 'Failed';
      stackTraceStr = tc.errorStackTrace;
      errorMsg = tc.errorDetails;
      let idx = tc.errorStackTrace.indexOf("at ");
      if (idx >= 0) {
        errorType = tc.errorStackTrace.substring(0, idx);
      } else {
        idx = tc.errorDetails.indexOf(":");
        if (idx >= 0) {
          errorType = tc.errorDetails.substring(0, idx);
        }
      }
    }
    const runId = tc.runId;
    let externalURL = '';
    if (this.runResultsFilesMap.has(runId)) {
      const runResXmlFilePath = this.runResultsFilesMap.get(runId);
      try {
        this.resultData = await getMBTData(runResXmlFilePath!) || [];
      } catch (e) {
        logger.error(`getMBTData: ${(e as Error).message}`);
        logger.error(`processTestCase: Error parsing run results file: [${runResXmlFilePath}]`);
      }
      const repoUrl = config.repoUrl.replace(/\.git$/, '');
      if (this.buildInfo.runId2artifactIdMap?.has(runId)) {
        externalURL = `${repoUrl}/actions/runs/${this.buildInfo.buildId}/artifacts/${this.buildInfo.runId2artifactIdMap.get(runId)}`;
      }
    } else {
      logger.error(`processTestCase: Run results file not found for runId: ${runId}`);
    }

    const description = tc.stdout ?
      this.extractValueFromStdout(tc.stdout, '__octane_description_start__', '__octane_description_end__', '') :
      '';

    const testError: TestErr | null = stackTraceStr || errorMsg ? { errorType, errorMsg, stackTraceStr } : null;

    const testResult = new JUnitTestResult(
      "", //moduleName
      "", //packageName
      "", //className
      testName,
      status,
      testDuration,
      this.buildStarted,
      testError,
      externalURL,
      description,
      this.resultData,
      runId,
      '' //externalAssets
    );

    this.testNameToJunitResultMap.set(testName, testResult);
  }

  private extractValueFromStdout(stdoutValue: string, startString: string, endString: string, defaultValue: string): string {
    let result = defaultValue;
    const startIndex = stdoutValue.indexOf(startString);
    if (startIndex > 0) {
      const endIndex = stdoutValue.indexOf(endString, startIndex);
      if (endIndex > 0) {
        result = stdoutValue.substring(startIndex + startString.length, endIndex).trim();
      }
    }
    return result;
  }

  public getTestResults(): JUnitTestResult[] {
    return Array.from(this.testNameToJunitResultMap.values());
  }
}