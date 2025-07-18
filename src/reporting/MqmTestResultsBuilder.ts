import * as fs from 'fs-extra';
import { JUnitXmlIterator } from './JUnitXmlIterator';
import { create } from 'xmlbuilder';
import { TestResult } from './TestResult';
import { Logger } from '../utils/logger';

const logger = new Logger('MqmTestResultsBuilder');

export class MqmTestResultsBuilder {
  //private junitResFilePath: string;
  private junitResult: TestResult
  private jobName: string;
  private buildId: number;
  //private runFolder: string;
  private tmpMqmTestsFile: string;
  private buildStarted: number;
  private runResultsFilesMap: Map<number, string>;

  constructor(
    junitResult: TestResult, jobName: string, buildId: number, /*runFolder: string, */tmpMqmTestsFile: string, runResultsFilesMap: Map<number, string>) {
    //this.junitResFilePath = junitResFilePath;
    this.junitResult = junitResult;
    this.jobName = jobName;
    this.buildId = buildId;
    //this.runFolder = runFolder;
    this.buildStarted = Date.now();
    this.tmpMqmTestsFile = tmpMqmTestsFile;
    this.runResultsFilesMap = runResultsFilesMap;
  }

  public async invoke(): Promise<void> {
    //const xmlData = await fs.readFile(this.junitResFilePath, 'utf-8');
    try {
      logger.debug(`invoke: Processing JUnit test results for job: ${this.jobName}, build: ${this.buildId}`);

      const iterator = new JUnitXmlIterator(this.jobName, this.buildId, /*this.runFolder, */this.buildStarted, this.runResultsFilesMap);
      await iterator.processXmlResult(this.junitResult);
      const testResults = iterator.getTestResults();

      await fs.ensureFile(this.tmpMqmTestsFile as string);

      const xml = create('test_runs');
      for (const testResult of testResults) {
        testResult.writeXmlElement(xml);
      }

      const xmlString = xml.end({ pretty: true });
      logger.debug(xmlString); // Log the XML string to ensure it contains data

      // Use Promises for file stream operations
      await new Promise((resolve, reject) => {
        const tempFileStream = fs.createWriteStream(this.tmpMqmTestsFile, { flags: 'a' });

        tempFileStream.on('finish', () => {
          logger.debug('File has been written successfully');
          resolve(true);
        });

        tempFileStream.on('error', (err) => {
          logger.error('Error writing to file:', err);
          reject(err);
        });

        tempFileStream.write(xmlString);
        tempFileStream.end();
      });

      logger.debug(`invoke: Finished writing test results to ${this.tmpMqmTestsFile}`);

    } catch (error) {
      logger.error('Error in invoke method:', error as Error);
    }
  }
}