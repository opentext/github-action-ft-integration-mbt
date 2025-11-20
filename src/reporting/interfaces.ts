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
export interface ResultFields {
  framework: string;
  testingTool: string;
  // Add other fields as needed
}

export interface XmlWritableTestResult {
  writeXmlElement(writer: any): void;
}

// Define interfaces for the nested structures in resultData
export interface Step {
  name: string;
  duration: number;
  status: string;
  errorMessage?: string;
  inputParameters: Param[];
  outputParameters: Param[];
}

export interface Param {
  name: string;
  value: string;
  type: string;
}

export interface ResultDataItem {
  steps: Step[];
}

export interface ReportResults {
  version: string;
  reportNode: ReportNode;
}

export interface ReportNode {
  type: string;
  reportNode?: ReportNode | ReportNode[];
  data: ReportNodeData;
}

export interface ReportNodeData {
  name: string;
  description?: string;
  errorText?: string;
  duration: number;
  result: string;
  inputParameters?: { parameter: Parameter | Parameter[] };
  outputParameters?: { parameter: Parameter | Parameter[] };
}

export interface Parameter {
  name: string;
  value: string;
  type: string; // default type is String
}

export interface UftResultStepParameter {
  name: string;
  value: string;
  type: string; // default type is String
}

export interface UftResultStepData {
  parents: string[];
  type: string;
  result: string;
  message: string;
  duration: number;
  inputParameters?: UftResultStepParameter[];
  outputParameters?: UftResultStepParameter[];
}

export interface UftResultIterationData {
  steps: UftResultStepData[];
  duration: number;
}

export interface RunResults {
  iterations: RunResultsSteps[];
}

export interface RunResultsStepParameter {
  name: string;
  value: string;
  type: string; // default type is String
}

export interface RunResultsStep {
  name: string; // name of the test method
  status: string;
  errorMessage: string;
  duration: number;
  inputParameters?: RunResultsStepParameter[];
  outputParameters?: RunResultsStepParameter[];
}

export interface RunResultsSteps {
  steps: RunResultsStep[];
  duration: number;
}

export interface BuildInfo {
  serverId: string;
  jobId: string;
  buildId: number;
  artifactId?: number;
  runId2artifactIdMap?: Map<number, number>;
}

export interface TestErr {
  errorType: string;
  errorMsg: string;
  stackTraceStr: string;
}
