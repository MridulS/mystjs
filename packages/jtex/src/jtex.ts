import fs from 'fs';
import { extname, dirname } from 'path';
import type MystTemplate from 'myst-templates';
import { TEMPLATE_FILENAME } from 'myst-templates';
import nunjucks from 'nunjucks';
import { renderImports } from './imports';
import type { TexRenderer, TemplateImports } from './types';
import version from './version';

function ensureDirectoryExists(directory: string) {
  if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });
}

function getDefaultEnv(template: MystTemplate) {
  const env = nunjucks
    .configure(template.templatePath, {
      trimBlocks: true,
      autoescape: false, // Ensures that we are not writing to HTML!
      tags: {
        blockStart: '[#',
        blockEnd: '#]',
        variableStart: '[-',
        variableEnd: '-]',
        commentStart: '%#',
        commentEnd: '#%',
      },
    })
    .addFilter('len', (array) => array.length);
  return env;
}

export function renderTex(
  template: MystTemplate,
  opts: {
    contentOrPath: string;
    outputPath: string;
    frontmatter: any;
    parts: any;
    options: any;
    bibliography?: string[];
    sourceFile?: string;
    imports?: string | TemplateImports;
    force?: boolean;
    packages?: string[];
    filesPath?: string;
  },
) {
  if (extname(opts.outputPath) !== '.tex') {
    throw new Error(`outputPath must be a ".tex" file, not "${opts.outputPath}"`);
  }
  let content: string;
  if (fs.existsSync(opts.contentOrPath)) {
    template.session.log.debug(`Reading content from ${opts.contentOrPath}`);
    content = fs.readFileSync(opts.contentOrPath).toString();
  } else {
    content = opts.contentOrPath;
  }
  const { options, parts, doc } = template.prepare(opts);
  const renderer: TexRenderer = {
    CONTENT: content,
    doc,
    parts,
    options,
    IMPORTS: renderImports(opts.imports, opts?.packages),
  };
  const env = getDefaultEnv(template);
  const rendered = env.render(TEMPLATE_FILENAME, renderer);
  const outputDirectory = dirname(opts.outputPath);
  ensureDirectoryExists(outputDirectory);
  template.copyTemplateFiles(dirname(opts.outputPath), { force: opts.force });
  fs.writeFileSync(opts.outputPath, `% Created with jtex v.${version}\n${rendered}`);
}
