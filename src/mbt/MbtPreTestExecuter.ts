import * as path from 'path';
import { promises as fs } from 'fs';
import { spawn } from 'child_process';
import { Logger } from '../utils/logger';
import { TestResources, RecoveryScenarioData } from './TestResources';
import { escapePropVal, formatTimestamp, getGuiTestDocument } from '../utils/utils';
import { TspParseError } from '../utils/TspParseError';
import { MbtScriptData, MbtTestInfo } from './MbtTestData';
import { ExitCode } from './ExitCode';

const _logger = new Logger('MbtPreTestExecuter');
const HP_TL_EXE = 'HpToolsLauncher.exe';

export default class MbtPreTestExecuter {
  public static async preProcess(mbtTestInfos: MbtTestInfo[]): Promise<ExitCode> {
    _logger.debug(`preProcess: mbtTestInfos.length=${mbtTestInfos.length} ...`);

    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith('GITHUB_') || key.startsWith('RUNNER_')) {
        _logger.debug(`${key}=${value}`);
      }
    }

    const mbtPropsFullPath = await this.createMbtPropsFile(mbtTestInfos);
    const exitCode = await this.runHpToolsLauncher(mbtPropsFullPath);
    return exitCode;
  }

  private static async ensureHTLExists(): Promise<void> {
    const actionPath = process.env.GITHUB_ACTION_PATH; // e.g., C:\GitHub_runner\_work\_actions\dorin7bogdan\github-action-ft-integration\main
    _logger.debug(`ensureHpToolsLauncher: actionPath=[${actionPath}] ...`);
    if (!actionPath) {
      const err = `Missing environment variable: GITHUB_ACTION_PATH`;
      _logger.error(err);
      throw new Error(err);
    }

    const exeFullPath = path.join(actionPath, 'bin', HP_TL_EXE);
    try {
      await fs.access(exeFullPath, fs.constants.F_OK);
      _logger.debug(`Located [${exeFullPath}]`);
    } catch (error: any) {
      const err = `Failed to locate [${exeFullPath}]: ${error.message}`;
      _logger.error(err);
      throw new Error(err);
    }
  }

  private static async ensureMbtPropsExists(mbtPropsFullPath: string): Promise<void> {
    try {
      await fs.access(mbtPropsFullPath, fs.constants.F_OK | fs.constants.R_OK);
      _logger.debug(`Located [${mbtPropsFullPath}]`);
    } catch (error: any) {
      const err = `Failed to locate [${mbtPropsFullPath}]: ${error.message}`;
      _logger.error(err);
      throw new Error(err);
    }
  }

  private static async runHpToolsLauncher(mbtPropsFullPath: string): Promise<ExitCode> {
    _logger.debug(`runHpToolsLauncher: mbtPropsFullPath=[${mbtPropsFullPath}] ...`);
    await this.ensureHTLExists();
    await this.ensureMbtPropsExists(mbtPropsFullPath);
    const actionPath = process.env.GITHUB_ACTION_PATH!; // e.g., C:\GitHub_runner\_work\_actions\dorin7bogdan\github-action-ft-integration\main
    const binPath = path.join(actionPath, 'bin');
    const args = ['-paramfile', mbtPropsFullPath];
    try {
      await fs.access(path.join(binPath, HP_TL_EXE), fs.constants.F_OK | fs.constants.X_OK);
      _logger.info(`runHpToolsLauncher: ${HP_TL_EXE} ${args.join(' ')}`);

      return await new Promise<ExitCode>((resolve, reject) => {
        const launcher = spawn(HP_TL_EXE, args, {
          stdio: ['ignore', 'pipe', 'pipe'],
          cwd: binPath, // Set working directory to action's bin folder
        });
        launcher.stdout.on('data', (data) => {
          const msg = data?.toString().trim();
          msg && _logger.info(msg);
        });

        launcher.stderr.on('data', (data) => {
          const err = data?.toString().trim();
          err && _logger.error(err);
        });

        launcher.on('error', (error) => {
          reject(new Error(`Failed to start HpToolsLauncher: ${error.message}`));
        });

        launcher.on('close', (code) => {
          _logger.debug(`runHpToolsLauncher: ExitCode=${code}`);
          // Map exit code to ExitCode enum, default to Aborted for unknown codes
          const exitCode = Object.values(ExitCode)
            .filter((v): v is number => typeof v === 'number')
            .includes(code ?? -3)
            ? (code as ExitCode)
            : ExitCode.Unkonwn;
          resolve(exitCode);
        });
      });
    } catch (error: any) {
      _logger.error(`runHpToolsLauncher: ${error.message}`);
      throw new Error(`Failed to run HpToolsLauncher: ${error.message}`);
    }
  }

  private static async createMbtPropsFile(testInfos: MbtTestInfo[]): Promise<string> {
    if (!testInfos.length) return '';
    _logger.debug(`createMbtPropsFile: testInfos.length=${testInfos.length} ...`);
    const tempDir = process.env.RUNNER_TEMP; // e.g., C:\GitHub_runner\_work\_temp\
    if (!tempDir) {
      const err = `Missing environment variable: RUNNER_TEMP`;
      _logger.error(err);
      throw new Error(err);
    }
    // Check read/write access to RUNNER_TEMP
    try {
      await fs.access(tempDir, fs.constants.R_OK | fs.constants.W_OK);
      _logger.debug(`Read/write access confirmed for [${tempDir}]`);
    } catch (error: any) {
      const err = `No read/write access to [${tempDir}]: ${error.message}`;
      _logger.error(err);
      throw new Error(err);
    }

    const props: { [key: string]: string } = {
      runType: 'MBT',
      resultsFilename: 'must be here',
      parentFolder: escapePropVal(tempDir),
      repoFolder: escapePropVal(process.cwd()),
    };
    await Promise.all(testInfos.map(async (testInfo, i) => {
      const idx = i + 1;
      props[`test${idx}`] = testInfo.testName;
      props[`package${idx}`] = `_${idx}`;
      props[`script${idx}`] = await this.updateTestScriptResources(testInfo.scriptData);
      props[`unitIds${idx}`] = testInfo.unitIds.join(';');
      props[`underlyingTests${idx}`] = escapePropVal(testInfo.underlyingTests.join(';'));
      props[`datableParams${idx}`] = testInfo.encodedIterationsStr;
    }));

    const mbtPropsFullPath = path.join(tempDir, `mbt_props_${formatTimestamp()}.txt`);

    try {
      await fs.writeFile(mbtPropsFullPath, Object.entries(props).map(([k, v]) => `${k}=${v}`).join('\n'));
    } catch (error: any) {
      _logger.error(`createMbtPropsFile: ${error.message}`);
      throw new Error('Failed when creating MBT properties file');
    }

    return mbtPropsFullPath;
  }

  private static extractTestResources = async (testPath: string): Promise<TestResources> => {
    _logger.debug(`extractTestResources: testPath=${testPath}`);
    const content: TestResources = {
      functionLibraries: [],
      recoveryScenarioData: []
    };

    try {
      const doc = await getGuiTestDocument(`${testPath}`);
      if (!doc) {
        throw new TspParseError("No document parsed");
      }

      const flNodes = doc.getElementsByTagName('FuncLib');
      for (let i = 0; i < flNodes.length; i++) {
        const fl = flNodes.item(i)?.textContent;
        fl && content.functionLibraries.push(path.join(testPath, fl));
      }

      const rsNode = doc.getElementsByTagName('RecoveryScenarios').item(0);
      if (rsNode) {
        const rsParts = rsNode.textContent?.split('*') || [];
        rsParts.forEach(rsPart => {
          const rsAsArray = rsPart.split('|');
          if (rsAsArray.length > 1) {
            const rsPath = path.join(testPath, rsAsArray[0]);
            const rsData: RecoveryScenarioData = { path: rsPath, name: rsAsArray[1] };
            content.recoveryScenarioData.push(rsData);
          }
        });
      }
    } catch (error: any) {
      _logger.error(`extractTestResources: ${error.message}; Continuing with empty resources`);
    }

    return content;
  }

  private static updateTestScriptResources = async (scriptData: MbtScriptData[]): Promise<string> => {
    let index = 0;
    const scriptLines: string[] = [];
    _logger.debug(`updateTestScriptResources: scriptData.length=${scriptData.length}`);

    for (const unit of scriptData) {
      let script = '';

      if (index === 0 || (scriptData[index - 1] && unit.testPath !== scriptData[index].testPath)) {
        const testPath = unit.testPath;
        if (!await this.isTestFolder(testPath)) {
          throw new Error(`updateTestScriptResources: invalid test path [${testPath}] of unit id ${unit.unitId}`);
        }

        const testResources = await this.extractTestResources(testPath);

        if (testResources.functionLibraries.length) {
          script += 'RestartFLEngine\\r\\n';
          for (const fl of testResources.functionLibraries) {
            script += ` LoadFunctionLibrary "${escapePropVal(fl)}"\\r\\n`;
          }
        }

        if (testResources.recoveryScenarioData.length) {
          const scenarios = testResources.recoveryScenarioData.map(rs => `"${escapePropVal(rs.path)}|${rs.name}|1|1*"`).join(',');
          script += `LoadRecoveryScenario ${scenarios}`;
        }
      }

      script += unit.basicScript;
      scriptLines.push(script);
      index++;
    }

    return scriptLines.join('\\r\\n');
  }

  private static async isTestFolder(testPath: string): Promise<boolean> {
    const testName = path.basename(testPath);
    try {
      await fs.access(path.join(testPath, 'Test.tsp'));
      return true;
    } catch {
      try {
        await fs.access(path.join(testPath, `${testName}.st`));
        return true;
      } catch {
        return false;
      }
    }
  }
}