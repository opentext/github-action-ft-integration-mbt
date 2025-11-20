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
import { XMLElement } from 'xmlbuilder';
import { XmlWritableTestResult, RunResultsSteps, RunResultsStep, UftResultStepParameter, TestErr } from './interfaces';

export class JUnitTestResult implements XmlWritableTestResult {
  public moduleName: string;
  public packageName: string;
  public className: string;
  public testName: string;
  public description: string;
  public started: number;
  public externalReportUrl: string;
  public resultData: RunResultsSteps[];
  public result: string;
  public duration: number;
  public testError: TestErr | null;
  public runId: number | null;
  public externalAssets: string;

  constructor(
    moduleName: string,
    packageName: string,
    className: string,
    testName: string,
    result: string,
    duration: number,
    started: number,
    testError: any | null,
    externalReportUrl: string,
    description: string,
    resultData: any[],
    runId: number | null,
    externalAssets: string
  ) {
    this.moduleName = moduleName;
    this.packageName = packageName;
    this.className = className;
    this.testName = testName;
    this.description = description;
    this.started = started;
    this.externalReportUrl = externalReportUrl;
    this.resultData = resultData;
    this.result = result;
    this.duration = duration;
    this.testError = testError;
    this.runId = runId;
    this.externalAssets = externalAssets;
  }

  public writeXmlElement(root: XMLElement): void {
    let attrs: { [key: string]: string } = {
      module: this.moduleName,
      package: this.packageName,
      class: this.className,
      name: this.testName,
      duration: `${Math.round(this.duration * 1000)}`,
      status: this.result,
      started: this.started.toString(),
      external_assets: this.externalAssets,
      run_type: "MBT"
    };
    if (this.externalReportUrl) {
      attrs = { ...attrs, external_report_url: this.externalReportUrl };
    }

    const testRun = root.e('test_run', attrs);

    if (this.testError) {
      const error = testRun.e('error', {
        type: this.testError.errorType,
        message: this.testError.errorMsg
      });
      error.raw(this.testError.stackTraceStr);
    }

    if (this.description) {
      testRun.e('description', {}, this.description);
    }

    if (this.resultData.length) {
      this.resultData.forEach((step: RunResultsSteps, index: number) => {
        const steps = testRun.e('steps', { iteration: (index + 1).toString() });
        step.steps.forEach((s: RunResultsStep, idx: number) => {
          const stepElement = steps.e('step', { name: s.name, duration: `${s.duration}`, status: s.status });
          if (s.errorMessage) {
            stepElement.e('error_message', {}, s.errorMessage);
          }

          if (s.inputParameters?.length) {
            const inputParameters = stepElement.e('input_parameters');
            s.inputParameters.forEach((p: UftResultStepParameter) => {
              inputParameters.e('parameter', { name: p.name, value: p.value, type: p.type });
            });
          }

          if (s.outputParameters?.length) {
            const outputParameters = stepElement.e('output_parameters');
            s.outputParameters.forEach((p: UftResultStepParameter) => {
              outputParameters.e('parameter', {
                name: p.name,
                value: p.value,
                type: p.type
              });
            });
          }
        });
      });
    }
  }
}