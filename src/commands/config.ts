import { Command } from 'commander';

export function buildConfigCommand(): Command {
  const command = new Command('config')
    .description('Manage local e2ectl profiles and authentication settings.')
    .addHelpText(
      'after',
      '\nUser-facing config subcommands are planned for M3. This milestone only ships the config/auth internals.\n'
    );

  command.action(() => {
    command.outputHelp();
  });

  return command;
}
