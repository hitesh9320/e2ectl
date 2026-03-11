import { Command } from 'commander';
import { createRequire } from 'node:module';

import { buildConfigCommand } from './commands/config.js';
import { buildNodeCommand } from './commands/node.js';

interface PackageMetadata {
  version: string;
}

const require = createRequire(import.meta.url);
const packageMetadata = require('../package.json') as PackageMetadata;

export function createProgram(): Command {
  const program = new Command();

  program
    .name('e2ectl')
    .description('CLI for the E2E Networks MyAccount platform.')
    .version(packageMetadata.version)
    .option(
      '--alias <profile>',
      'Use a saved profile alias for the current command.'
    )
    .option('--json', 'Emit deterministic JSON output.')
    .showSuggestionAfterError()
    .showHelpAfterError('(use --help for usage)');

  program.addCommand(buildConfigCommand());
  program.addCommand(buildNodeCommand());
  program.helpCommand('help [command]', 'Show help for a command');

  program.action(() => {
    program.outputHelp();
  });

  return program;
}
