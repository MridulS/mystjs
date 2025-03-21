import fs from 'fs';
import path from 'path';
import util from 'util';
import { pdfExportCommand } from 'jtex';
import { exec, tic } from 'myst-cli-utils';
import MystTemplate from 'myst-templates';
import type { ISession } from '../../session/types';
import { createTempFolder, uniqueArray } from '../../utils';
import type { ExportWithOutput } from '../types';
import { cleanOutput } from '../utils/cleanOutput';
import { TemplateKind } from 'myst-common';
import chalk from 'chalk';

const copyFile = util.promisify(fs.copyFile);

function copyContents(srcFolder: string, destFolder: string) {
  fs.readdirSync(srcFolder).forEach((item) => {
    const srcItemPath = path.join(srcFolder, item);
    const destItemPath = path.join(destFolder, item);
    if (fs.lstatSync(srcItemPath).isDirectory()) {
      fs.mkdirSync(destItemPath);
      copyContents(srcItemPath, destItemPath);
    } else {
      fs.copyFileSync(srcItemPath, destItemPath);
    }
  });
}

export function getLogOutputFolder(pdfOutput: string) {
  const pdfBasename = path.basename(pdfOutput, path.extname(pdfOutput));
  return path.join(path.dirname(pdfOutput), `${pdfBasename}_pdf_logs`);
}

export function getTexOutputFolder(pdfOutput: string) {
  const pdfBasename = path.basename(pdfOutput, path.extname(pdfOutput));
  return path.join(path.dirname(pdfOutput), `${pdfBasename}_pdf_tex`);
}

export async function createPdfGivenTexExport(
  session: ISession,
  texExportOptions: ExportWithOutput,
  pdfOutput: string,
  copyLogs?: boolean,
  clean?: boolean,
) {
  if (clean) cleanOutput(session, pdfOutput);
  const { output: texOutput, template } = texExportOptions;

  const templateLogString = template ? ` (${template})` : '';

  const buildPath = createTempFolder(session);
  const texFile = path.basename(texOutput);
  const texBuild = path.join(buildPath, texFile);
  copyContents(path.dirname(texOutput), buildPath);

  if (!fs.existsSync(texBuild)) {
    throw Error(`Error exporting: ${pdfOutput}\nCould not find tex file: ${texOutput}`);
  }

  const pdfBasename = path.basename(pdfOutput, path.extname(pdfOutput));
  const pdfFile = `${pdfBasename}.pdf`;
  const pdfBuild = path.join(buildPath, pdfFile);

  const logFile = `${pdfBasename}.log`;
  const texLogFile = `${pdfBasename}.shell.log`;
  // Temporary log file locations
  const logBuild = path.join(buildPath, logFile);
  const texLogBuild = path.join(buildPath, texLogFile);
  // Log file location saved alongside pdf
  const logOutputFolder = getLogOutputFolder(pdfOutput);
  const logOutput = path.join(logOutputFolder, logFile);
  const texLogOutput = path.join(logOutputFolder, texLogFile);
  if (clean) cleanOutput(session, logOutputFolder);

  let buildCommand: string;
  if (!template) {
    buildCommand = pdfExportCommand(texFile, texLogFile);
  } else {
    const mystTemplate = new MystTemplate(session, {
      kind: TemplateKind.tex,
      template: template || undefined,
      buildDir: session.buildPath(),
    });
    buildCommand = pdfExportCommand(texFile, texLogFile, mystTemplate);
  }
  const toc = tic();
  try {
    session.log.info(`🖨  Rendering PDF ${templateLogString} to ${pdfBuild}`);
    session.log.debug(`Running command:\n> ${buildCommand}`);
    await exec(buildCommand, { cwd: buildPath });
    session.log.debug(`Done building LaTeX.`);
  } catch (err) {
    session.log.debug((err as Error).stack);
    session.log.error(
      `🛑 LaTeX reported an error building your PDF${templateLogString} for ${texFile}`,
    );
    session.log.info('\n   Please check your PDF, it may actually be fine? 🤷');
    session.log.info(
      chalk.dim(
        `\n     Console:        ${texLogBuild}\n     Detailed logs:  ${logBuild}\n     Build path:     ${buildPath}\n`,
      ),
    );
    const logs = uniqueArray(
      fs
        .readFileSync(texLogBuild)
        .toString()
        .split('\n')
        .filter((line) => line.includes('WARN ') || line.includes('LaTeX Error')),
      (line) => (line.indexOf('WARN') > -1 ? line.slice(line.indexOf('WARN')) : line),
    );
    if (logs.length > 0) {
      session.log.info(
        `\n     ${chalk.dim('Preview:')}\n     ${logs
          .map((line) =>
            line.includes('LaTeX Error') ? chalk.red(line) : chalk.yellowBright(line),
          )
          .join('\n     ')}\n`,
      );
    }
  }

  const pdfBuildExists = fs.existsSync(pdfBuild);
  const logBuildExists = fs.existsSync(logBuild);
  const texLogBuildExists = fs.existsSync(texLogBuild);

  if (pdfBuildExists && !fs.existsSync(path.dirname(pdfOutput))) {
    fs.mkdirSync(path.dirname(pdfOutput), { recursive: true });
  }

  if (pdfBuildExists) {
    session.log.info(toc(`📄 Exported PDF ${templateLogString} in %s, copying to ${pdfOutput}`));
    await copyFile(pdfBuild, pdfOutput);
    session.log.debug(`Copied PDF file to ${pdfOutput}`);
  } else {
    session.log.error(`Could not find ${pdfBuild} as expected`);
  }
  if (copyLogs) {
    if ((logBuildExists || texLogBuildExists) && !fs.existsSync(path.dirname(logOutput))) {
      fs.mkdirSync(path.dirname(logOutput), { recursive: true });
    }
    if (logBuildExists) {
      session.log.debug(`Copying log file: ${logOutput}`);
      await copyFile(logBuild, logOutput);
    }

    if (texLogBuildExists) {
      session.log.debug(`Copying log file: ${texLogOutput}`);
      await copyFile(texLogBuild, texLogOutput);
    }
  }
  if (!fs.existsSync(pdfOutput)) {
    throw Error(`Error exporting: ${pdfOutput}`);
  }
}
