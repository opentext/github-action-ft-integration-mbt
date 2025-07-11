import * as fs from 'fs';
import { SuiteResult } from './SuiteResult';
import { Logger } from '../utils/logger';

const logger: Logger = new Logger('TestResult');
export class TestResult {
  public suites: SuiteResult[];
  public keepLongStdio: boolean;
  public duration: number;

  constructor(keepLongStdio: boolean = false) {
    this.suites = [];
    this.keepLongStdio = keepLongStdio;
    this.duration = 0;
  }

  public async parsePossiblyEmpty(xmlResFilePath: string, externalAssets: string): Promise<void> {
    if (fs.statSync(xmlResFilePath).size === 0) {
      const sr = new SuiteResult(xmlResFilePath);
      //sr.addCase(new CaseResult(sr, "[empty]", "Test report file " + xmlResFilePath + " was length 0"));
      this.add(sr);
    } else {
      await this.parse(xmlResFilePath, externalAssets);
    }
  }

  private async parse(xmlResFilePath: string, externalAssets: string): Promise<void> {
    logger.debug(`parse: Parsing XML file [${xmlResFilePath}], keepLongStdio=${this.keepLongStdio} ...`);
    try {
      for (const suiteResult of await SuiteResult.parse(xmlResFilePath, this.keepLongStdio)) {
        if (externalAssets) {
          suiteResult.externalAssets = this.updateExternalAssetPath(suiteResult, externalAssets);
        }
        this.add(suiteResult);
      }
    } catch (e) {
      logger.error(`parse: Failed to parse [${xmlResFilePath}]`, e as Error);
    }
  }

  private add(sr: SuiteResult): void {
    for (const s of this.suites) {
      if (s.name === sr.name &&
        s.id === sr.id /*&&
        s.enclosingBlocks === sr.enclosingBlocks &&
        s.enclosingBlockNames === sr.enclosingBlockNames*/  //TODO check if really needed
      ) {

        if (s.timestamp === sr.timestamp) {
          return;
        }

        this.duration += sr.duration;
        s.merge(sr);
        return;
      }
    }

    this.suites.push(sr);
    this.duration += sr.duration;
  }

  private updateExternalAssetPath(suite: SuiteResult, externalAssets: string): string {
    if (!externalAssets) {
      logger.debug(`updateExternalAssetPath: There is no external assets for suite ${suite.name}`);
      return "";
    }

    // TODO Parse and update external assets
    return externalAssets;
  }

  public toXML(): string {
    let xml = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n';
    xml += '<result>\n';
    xml += `\t<keepLongStdio>${this.keepLongStdio}</keepLongStdio>\n`;
    xml += `\t<duration>${this.duration.toFixed(5)}</duration>\n`;
    xml += '\t<suites>\n';
    for (const suite of this.suites) {
      xml += suite.toXML(2); // Indent suite elements by 2 tabs
    }
    xml += '\t</suites>\n';
    xml += '</result>\n';
    return xml;
  }
}