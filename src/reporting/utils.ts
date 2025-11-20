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
import * as fs from 'fs';
import * as xml2js from 'xml2js';
import { UftResultStepData, UftResultIterationData, RunResultsSteps, ReportNode, UftResultStepParameter, Parameter } from './interfaces';

const notFinalNodeType = new Set(['Iteration', 'Action', 'Context']);

function toCamelCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^[A-Z]/, c => c.toLowerCase());
}

export async function getMBTData(file: string): Promise<RunResultsSteps[]> {
  const fileContent = fs.readFileSync(file, 'utf-8');
  const parser = new xml2js.Parser({
    mergeAttrs: true,
    explicitArray: false,
    explicitCharkey: false,
    tagNameProcessors: [toCamelCase],
    attrNameProcessors: [toCamelCase],
  });

  const r = await parser.parseStringPromise(fileContent);
  const reportNode = r.results?.reportNode as ReportNode;

  if (!reportNode) {
    console.error(`Failed to find UFT result data file for file ${file}`);
    return [];
  }

  const iterationRptNodes: ReportNode[] = [];
  getMBTIterationsInternal(reportNode, [], iterationRptNodes, 'Iteration', 2);

  const iterations: UftResultIterationData[] = iterationRptNodes.map(reportNode => {
    const steps: UftResultStepData[] = [];
    getMBTDataInternal(reportNode, [], steps, 'Action', 3);
    return { steps, duration: reportNode.data.duration ?? 0 };
  });

  return convertIterationsToRunResults(iterations);
}

function convertIterationsToRunResults(iterations: UftResultIterationData[]): RunResultsSteps[] {
  return iterations.map(uftIteration => {
    const steps = uftIteration.steps.map(uftStep => {
      const { parents, result, message, duration, inputParameters, outputParameters } = uftStep;
      return {
        name: parents[parents.length - 1],
        status: result,
        errorMessage: message,
        duration,
        inputParameters: inputParameters || [],
        outputParameters: outputParameters || [],
      };
    });
    return { steps, duration: uftIteration.duration };
  });
}

function getMBTIterationsInternal(node: ReportNode, parents: string[], results: ReportNode[], nodeType: string, targetLevel: number): void {
  parents.push(node.data.name || '');

  if (parents.length === targetLevel && nodeType === node.type) {
    results.push(node);
  }

  if (node.reportNode && parents.length < targetLevel) {
    const children = Array.isArray(node.reportNode) ? node.reportNode : [node.reportNode];
    children.forEach(n => getMBTIterationsInternal(n, [...parents], results, nodeType, targetLevel));
  }
}

function getMBTDataInternal(node: ReportNode, parents: string[], results: UftResultStepData[], nodeType: string, targetLevel: number): void {
  parents.push(node.data.name || '');

  const failed = /failed|warning/i.test(node.data.result || '');

  if (parents.length === targetLevel && nodeType === node.type) {
    let errorMessage = '';
    if (failed) {
      const errors: UftResultStepData[] = [];
      getErrorDataInternal(node, [...parents], errors);
      errorMessage = getAggregatedErrorMessage(errors);
    }

    const { inputParameters, outputParameters, duration, result } = node.data;
    const status = /warning/i.test(result) ? 'Passed' : result || 'Passed';

    // Helper function to normalize parameters
    const normalizeParameters = (params?: { parameter: Parameter | Parameter[] }): UftResultStepParameter[] => {
      const paramOrParams = params?.parameter;
      if (!paramOrParams) {
        return [];
      }

      return Array.isArray(paramOrParams) ? paramOrParams.map(p => ({ ...p })) : [{ ...paramOrParams }];
    };

    results.push({
      parents,
      type: node.type,
      result: status,
      message: errorMessage,
      duration: duration ?? 0,
      inputParameters: normalizeParameters(inputParameters),
      outputParameters: normalizeParameters(outputParameters)
    });
  }

  if (node.reportNode && parents.length < targetLevel) {
    const children = Array.isArray(node.reportNode) ? node.reportNode : [node.reportNode];
    children.forEach(n => getMBTDataInternal(n, [...parents], results, nodeType, targetLevel));
  }
}

function getErrorDataInternal(node: ReportNode, parents: string[], errors: UftResultStepData[]): void {
  parents.push(node.data.name || '');

  const hasDescription = isNotEmpty(node.data.description);
  const failed = /failed|warning/i.test(node.data.result || '');

  if (failed) {
    if (!notFinalNodeType.has(node.type) && hasDescription) {
      let error = isNotEmpty(node.data.errorText) ? node.data.errorText : node.data.description;
      error = error
        ?.replace("Verify that this object's properties match an object currently displayed in your application.", '')
        .replace(/\n/g, '')
        .replace(/\u00A0/g, ' ')
        .trim();

      if (parents?.length && error?.startsWith(parents[parents.length - 1])) {
        parents.pop();
      }
      errors.push({
        parents,
        type: node.type,
        result: node.data.result || 'Failed',
        message: error || '',
        duration: node.data.duration ?? 0,
      });
    }
    if (node.reportNode) {
      const children = Array.isArray(node.reportNode) ? node.reportNode : [node.reportNode];
      children.forEach(n => getErrorDataInternal(n, [...parents], errors));
    }
  }
}

function getAggregatedErrorMessage(errors: UftResultStepData[]): string {
  return errors
    .map(e => e.message.trim() + (/warning/i.test(e.result) ? ' (Warning)' : '') + (e.message.trim().endsWith('.') ? '' : '. '))
    .filter((msg, index, self) => self.indexOf(msg) === index)
    .join('\n');
}

function isNotEmpty(str: string | null | undefined): boolean {
  return str ? str.length > 0 : false;
}