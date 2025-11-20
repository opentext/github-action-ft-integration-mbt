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
import { calcByExpr, escapePropVal } from "../utils/utils";
import MbtTestData, { UnitDetails, MbtScriptData, TestParam, MbtDataSet, MbtTestInfo } from '../mbt/MbtTestData';
import { Buffer } from 'buffer';
import { Logger } from '../utils/logger';
import TestData from "./TestData";
const logger = new Logger('MbtDataPrepConverter');

export default class MbtDataPrepConverter {
  private static generateScriptData(units: UnitDetails[], repoFolderPath: string): MbtScriptData[] {
    logger.debug(`generateScriptData: units.length=${units.length}, repoFolderPath=[${repoFolderPath}] ...`);
    return units
      .filter(unit => unit.pathInScm.includes(':'))
      .map(unit => {
        const unitPathTmp = calcByExpr(unit.pathInScm, /(.*)\\Action/, 1);
        unit.testPath = `${repoFolderPath}\\${unitPathTmp}`;
        const action = calcByExpr(unit.pathInScm, /:(.*)/, 1);
        const actionPath = escapePropVal(`${repoFolderPath}\\${unitPathTmp}`);
        let script = `\\r\\nLoadAndRunAction "${actionPath}","${action}"`;
        if (unit?.parameters?.length) {
          script += `,rngAll${this.extractActionParams(unit.parameters)}`;
        }

        script += `\\r\\nIf Reporter.CurrentActionIterationStatus \\= 1 Then\\r\\nExitAction\\r\\nEnd If`;
        return { unitId: unit.unitId, testPath: unit.testPath, basicScript: script } as MbtScriptData;
      });
  }

  private static extractDataTableIterations(data: MbtDataSet, testName: string): string {
    logger.debug(`extractDataTableIterations: testName=${testName} ...`);
    if (data?.parameters?.length) {
      const csvRows: string[] = [];
      csvRows.push(data.parameters.map(this.escapeCsvVal).join(",")); // add header row
      data.iterations.forEach(iteration => {
        const row = iteration.map(this.escapeCsvVal).join(","); // add data row
        csvRows.push(row);
      });
      const csvStr = csvRows.join("\n");
      logger.debug(`csvStr=${csvStr}`);
      return Buffer.from(csvStr, 'utf-8').toString('base64');
    }
    return "";
  }

  public static buildMbtTestInfo(repoFolderPath: string, runId: number, mbtTestData: MbtTestData, testDataMap: Map<number, TestData>): MbtTestInfo {
    const testName = testDataMap.get(runId)?.testName!;
    logger.debug(`buildMbtTestInfo: testName=${testName}, runId=${runId} ...`);
    return {
      runId: runId,
      testName: testName,
      scriptData: this.generateScriptData(mbtTestData.actions, repoFolderPath),
      underlyingTests: mbtTestData.actions.map(ud => ud.testPath ?? ""),
      unitIds: mbtTestData.actions.map(ud => ud.unitId),
      encodedIterationsStr: this.extractDataTableIterations(mbtTestData.data, testName)
    };
  }

  private static escapeCsvVal(val: string | null | undefined): string {
    if (val == null)
      return "";

    // Remove the outer dbl-quotes
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }

    // Escape internal double quotes by doubling them
    if (val.includes('"')) {
      val = val.replace(/"/g, '""');
    }

    // Enclose in double quotes if it contains special characters
    return /[",\n\r]/.test(val) ? `"${val}"` : val;
  }

  private static extractActionParams(params: TestParam[]): string {
    const inParams = params
      .filter(p => p.type.toLowerCase() === 'input')
      .map(p => p.outputParameter ? `,${p.outputParameter}` : `,DataTable("${p.name}")`)
      .join('');

    const outParams = params
      .filter(p => p.type.toLowerCase() === 'output')
      .map(p => `,${p.name}`)
      .join('');

    return inParams + outParams;
  }
}
