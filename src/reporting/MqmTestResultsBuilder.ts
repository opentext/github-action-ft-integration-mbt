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