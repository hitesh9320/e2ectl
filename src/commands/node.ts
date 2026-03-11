import { Command } from 'commander';
import type { CliRuntime } from '../runtime.js';

export function buildNodeCommand(runtime: CliRuntime): Command {
  void runtime;

  const command = new Command('node')
    .description('Manage MyAccount nodes.')
    .addHelpText(
      'after',
      '\nNode read and write commands are planned for M4 and M5. This milestone only wires the command namespace.\n'
    );

  command.action(() => {
    command.outputHelp();
  });

  return command;
}
