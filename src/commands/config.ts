import { Command } from 'commander';

import type { CliRuntime } from '../runtime.js';
import type { ConfigFile, ProfileConfig } from '../types/config.js';
import { VALID_LOCATIONS } from '../types/config.js';
import { readImportedProfiles } from '../config/import-file.js';
import {
  formatJson,
  formatProfilesTable,
  summarizeProfiles
} from '../output/formatter.js';
import { CliError, EXIT_CODES } from '../utils/errors.js';

interface ConfigCommandOptions {
  alias: string;
  apiKey: string;
  authToken: string;
  projectId: string;
  location: string;
}

interface GlobalOptions {
  json?: boolean;
}

interface RemoveCommandOptions {
  alias: string;
}

interface SetDefaultCommandOptions {
  alias: string;
}

interface ImportCommandOptions {
  default?: string;
  file: string;
  force?: boolean;
  input?: boolean;
  location?: string;
  projectId?: string;
}

export function buildConfigCommand(runtime: CliRuntime): Command {
  const command = new Command('config').description(
    'Manage local e2ectl profiles and authentication settings.'
  );

  command.helpCommand('help [command]', 'Show help for a config command');

  command
    .command('add')
    .description(
      'Add or update a saved profile after validating the credentials.'
    )
    .requiredOption('--alias <alias>', 'Profile alias to save.')
    .requiredOption('--api-key <apiKey>', 'MyAccount API key for the profile.')
    .requiredOption(
      '--auth-token <authToken>',
      'MyAccount bearer token for the profile.'
    )
    .requiredOption('--project-id <projectId>', 'MyAccount project id.')
    .requiredOption(
      '--location <location>',
      'MyAccount location (Delhi or Chennai).'
    )
    .action(async (options: ConfigCommandOptions, commandInstance: Command) => {
      validateProfileInput(options);

      const alias = options.alias.trim();
      const profile: ProfileConfig = {
        api_key: options.apiKey.trim(),
        auth_token: options.authToken.trim(),
        project_id: options.projectId.trim(),
        location: options.location.trim()
      };

      await runtime.credentialValidator.validate(profile);
      const nextConfig = await runtime.store.upsertProfile(alias, profile);

      writeConfigOutput(
        runtime,
        commandInstance.optsWithGlobals<GlobalOptions>(),
        {
          action: 'saved',
          default: nextConfig.default,
          profiles: summarizeProfiles(nextConfig)
        },
        `Saved profile "${alias}".`
      );
    });

  command
    .command('import')
    .description(
      'Import aliases from a downloaded credential JSON file and validate them before saving.'
    )
    .requiredOption('--file <path>', 'Path to the downloaded credential file.')
    .option('--project-id <projectId>', 'MyAccount project id to apply.')
    .option(
      '--location <location>',
      'MyAccount location (Delhi or Chennai) to apply.'
    )
    .option('--default <alias>', 'Alias to make default after import.')
    .option('--force', 'Overwrite existing aliases without confirmation.')
    .option(
      '--no-input',
      'Disable prompts for missing metadata and default selection.'
    )
    .action(async (options: ImportCommandOptions, commandInstance: Command) => {
      const importedSecrets = await readImportedProfiles(options.file.trim());
      const importedAliases = Object.keys(importedSecrets).sort((left, right) =>
        left.localeCompare(right)
      );
      const firstImportedAlias = importedAliases[0];
      if (firstImportedAlias === undefined) {
        throw new CliError('Import file does not contain any aliases.', {
          code: 'EMPTY_IMPORT_FILE',
          exitCode: EXIT_CODES.config,
          suggestion:
            'Choose a file that includes at least one saved credential.'
        });
      }
      const canPrompt = canPromptForInput(runtime, options);
      const projectId = await resolveProjectId(runtime, options, canPrompt);
      const location = await resolveLocation(runtime, options, canPrompt);

      validateProfileInput({
        alias: firstImportedAlias,
        apiKey: getImportedProfile(importedSecrets, firstImportedAlias).api_key,
        authToken: getImportedProfile(importedSecrets, firstImportedAlias)
          .auth_token,
        projectId,
        location
      });

      const profilesToImport: Record<string, ProfileConfig> =
        Object.fromEntries(
          importedAliases.map((alias) => {
            const importedProfile = getImportedProfile(importedSecrets, alias);

            return [
              alias,
              {
                api_key: importedProfile.api_key,
                auth_token: importedProfile.auth_token,
                project_id: projectId,
                location
              } satisfies ProfileConfig
            ];
          })
        );

      const currentConfig = await runtime.store.read();
      await confirmOverwriteIfNeeded(
        runtime,
        options,
        canPrompt,
        currentConfig,
        importedAliases
      );

      for (const alias of importedAliases) {
        await runtime.credentialValidator.validate(
          getImportedProfile(profilesToImport, alias)
        );
      }

      const nextConfig: ConfigFile =
        currentConfig.default === undefined
          ? {
              profiles: {
                ...currentConfig.profiles,
                ...profilesToImport
              }
            }
          : {
              profiles: {
                ...currentConfig.profiles,
                ...profilesToImport
              },
              default: currentConfig.default
            };

      await runtime.store.write(nextConfig);

      if (!(commandInstance.optsWithGlobals<GlobalOptions>().json ?? false)) {
        runtime.stdout.write(
          formatImportSuccessMessage(options.file.trim(), importedAliases)
        );
      }

      const defaultAlias = await resolveImportedDefaultAlias(
        runtime,
        options,
        canPrompt,
        currentConfig,
        importedAliases
      );

      const finalConfig =
        defaultAlias === undefined
          ? await runtime.store.read()
          : await runtime.store.setDefault(defaultAlias);

      writeImportOutput(
        runtime,
        commandInstance.optsWithGlobals<GlobalOptions>(),
        importedAliases,
        finalConfig,
        currentConfig.default
      );
    });

  command
    .command('list')
    .description('List saved profiles with masked credentials.')
    .action(
      async (_options: Record<string, never>, commandInstance: Command) => {
        const config = await runtime.store.read();
        const summaries = summarizeProfiles(config);

        writeConfigOutput(
          runtime,
          commandInstance.optsWithGlobals<GlobalOptions>(),
          {
            action: 'list',
            default: config.default,
            profiles: summaries
          },
          summaries.length === 0
            ? 'No profiles saved.'
            : formatProfilesTable(summaries)
        );
      }
    );

  command
    .command('set-default')
    .description('Set the default saved profile.')
    .requiredOption('--alias <alias>', 'Profile alias to make default.')
    .action(
      async (options: SetDefaultCommandOptions, commandInstance: Command) => {
        const alias = options.alias.trim();
        await assertProfileExists(runtime, alias);
        const nextConfig = await runtime.store.setDefault(alias);

        writeConfigOutput(
          runtime,
          commandInstance.optsWithGlobals<GlobalOptions>(),
          {
            action: 'set-default',
            default: nextConfig.default,
            profiles: summarizeProfiles(nextConfig)
          },
          `Set "${alias}" as the default profile.`
        );
      }
    );

  command
    .command('remove')
    .description('Remove a saved profile.')
    .requiredOption('--alias <alias>', 'Profile alias to remove.')
    .action(async (options: RemoveCommandOptions, commandInstance: Command) => {
      const alias = options.alias.trim();
      await assertProfileExists(runtime, alias);
      const nextConfig = await runtime.store.removeProfile(alias);

      writeConfigOutput(
        runtime,
        commandInstance.optsWithGlobals<GlobalOptions>(),
        {
          action: 'removed',
          default: nextConfig.default,
          profiles: summarizeProfiles(nextConfig)
        },
        `Removed profile "${alias}".`
      );
    });

  command.action(() => {
    command.outputHelp();
  });

  return command;
}

function validateProfileInput(options: ConfigCommandOptions): void {
  if (
    !VALID_LOCATIONS.includes(
      options.location.trim() as (typeof VALID_LOCATIONS)[number]
    )
  ) {
    throw new CliError(`Unsupported location "${options.location}".`, {
      code: 'INVALID_LOCATION',
      details: [`Expected one of: ${VALID_LOCATIONS.join(', ')}`],
      exitCode: EXIT_CODES.usage,
      suggestion: 'Use one of the supported locations from the MyAccount API.'
    });
  }

  if (!/^\d+$/.test(options.projectId.trim())) {
    throw new CliError('Project ID must be numeric.', {
      code: 'INVALID_PROJECT_ID',
      exitCode: EXIT_CODES.usage,
      suggestion: 'Pass the numeric MyAccount project id with --project-id.'
    });
  }
}

async function assertProfileExists(
  runtime: CliRuntime,
  alias: string
): Promise<void> {
  const exists = await runtime.store.hasProfile(alias);
  if (!exists) {
    throw new CliError(`Profile "${alias}" was not found.`, {
      code: 'PROFILE_NOT_FOUND',
      exitCode: EXIT_CODES.config,
      suggestion: 'Run `e2ectl config list` to inspect the saved aliases.'
    });
  }
}

function writeConfigOutput(
  runtime: CliRuntime,
  options: GlobalOptions,
  payload: {
    action: string;
    default: ConfigFile['default'];
    profiles: ReturnType<typeof summarizeProfiles>;
  },
  humanOutput: string
): void {
  if (options.json ?? false) {
    runtime.stdout.write(
      formatJson({
        action: payload.action,
        default: payload.default ?? null,
        profiles: payload.profiles
      })
    );
    return;
  }

  runtime.stdout.write(`${humanOutput}\n`);
}

function writeImportOutput(
  runtime: CliRuntime,
  options: GlobalOptions,
  importedAliases: string[],
  config: ConfigFile,
  previousDefault: string | undefined
): void {
  if (options.json ?? false) {
    runtime.stdout.write(
      formatJson({
        action: 'imported',
        default: config.default ?? null,
        imported_aliases: importedAliases,
        imported_count: importedAliases.length,
        profiles: summarizeProfiles(config)
      })
    );
    return;
  }

  if (config.default !== undefined && config.default !== previousDefault) {
    runtime.stdout.write(`Set "${config.default}" as the default profile.\n`);
    return;
  }

  if (config.default !== undefined) {
    runtime.stdout.write(`Default profile remains "${config.default}".\n`);
    return;
  }

  runtime.stdout.write('No default profile was set.\n');
}

function formatImportSuccessMessage(
  filePath: string,
  aliases: string[]
): string {
  const noun = aliases.length === 1 ? 'profile' : 'profiles';
  return `Imported ${aliases.length} ${noun} from "${filePath}".\nSaved aliases: ${aliases.join(', ')}.\n`;
}

function getImportedProfile<T>(profiles: Record<string, T>, alias: string): T {
  const profile = profiles[alias];
  if (profile === undefined) {
    throw new CliError(`Imported alias "${alias}" could not be resolved.`, {
      code: 'IMPORT_ALIAS_LOOKUP_FAILED',
      exitCode: EXIT_CODES.config,
      suggestion:
        'Retry the import. If the problem persists, inspect the import file for duplicate or malformed aliases.'
    });
  }

  return profile;
}

function canPromptForInput(
  runtime: CliRuntime,
  options: Pick<ImportCommandOptions, 'input'>
): boolean {
  return runtime.isInteractive && (options.input ?? true);
}

async function resolveProjectId(
  runtime: CliRuntime,
  options: ImportCommandOptions,
  canPrompt: boolean
): Promise<string> {
  const projectId = options.projectId?.trim();
  if (projectId !== undefined && projectId.length > 0) {
    return projectId;
  }

  if (!canPrompt) {
    throw new CliError('Project ID is required for config import.', {
      code: 'MISSING_IMPORT_PROJECT_ID',
      exitCode: EXIT_CODES.usage,
      suggestion:
        'Pass --project-id or run the command in an interactive terminal.'
    });
  }

  return (await runtime.prompt('Project ID: ')).trim();
}

async function resolveLocation(
  runtime: CliRuntime,
  options: ImportCommandOptions,
  canPrompt: boolean
): Promise<string> {
  const location = options.location?.trim();
  if (location !== undefined && location.length > 0) {
    return location;
  }

  if (!canPrompt) {
    throw new CliError('Location is required for config import.', {
      code: 'MISSING_IMPORT_LOCATION',
      exitCode: EXIT_CODES.usage,
      suggestion: `Pass --location (${VALID_LOCATIONS.join(', ')}) or run the command in an interactive terminal.`
    });
  }

  return (
    await runtime.prompt(`Location (${VALID_LOCATIONS.join('/')}): `)
  ).trim();
}

async function confirmOverwriteIfNeeded(
  runtime: CliRuntime,
  options: ImportCommandOptions,
  canPrompt: boolean,
  currentConfig: ConfigFile,
  importedAliases: string[]
): Promise<void> {
  const existingAliases = importedAliases.filter(
    (alias) => currentConfig.profiles[alias] !== undefined
  );

  if (existingAliases.length === 0 || (options.force ?? false)) {
    return;
  }

  if (!canPrompt) {
    throw new CliError(
      `Import would overwrite existing aliases: ${existingAliases.join(', ')}.`,
      {
        code: 'IMPORT_OVERWRITE_REQUIRED',
        exitCode: EXIT_CODES.config,
        suggestion:
          'Re-run with --force or use an interactive terminal to confirm overwriting.'
      }
    );
  }

  const confirmed = await runtime.confirm(
    `Overwrite existing aliases: ${existingAliases.join(', ')}?`
  );

  if (!confirmed) {
    throw new CliError(
      'Import cancelled before overwriting existing aliases.',
      {
        code: 'IMPORT_CANCELLED',
        exitCode: EXIT_CODES.config,
        suggestion:
          'Re-run with --force if you want to replace the saved aliases.'
      }
    );
  }
}

async function resolveImportedDefaultAlias(
  runtime: CliRuntime,
  options: ImportCommandOptions,
  canPrompt: boolean,
  currentConfig: ConfigFile,
  importedAliases: string[]
): Promise<string | undefined> {
  if (options.default !== undefined) {
    const defaultAlias = options.default.trim();
    if (!importedAliases.includes(defaultAlias)) {
      throw new CliError(
        `Default alias "${defaultAlias}" was not part of this import.`,
        {
          code: 'INVALID_IMPORT_DEFAULT_ALIAS',
          exitCode: EXIT_CODES.usage,
          suggestion: `Choose one of the imported aliases: ${importedAliases.join(', ')}.`
        }
      );
    }

    return defaultAlias;
  }

  if (currentConfig.default !== undefined || !canPrompt) {
    return undefined;
  }

  if (importedAliases.length === 1) {
    const alias = importedAliases[0];
    const confirmed = await runtime.confirm(
      `Set "${alias}" as the default profile now?`
    );
    return confirmed ? alias : undefined;
  }

  const setDefault = await runtime.confirm(
    'Set one of the imported aliases as the default profile now?'
  );
  if (!setDefault) {
    return undefined;
  }

  const enteredAlias = (
    await runtime.prompt(
      `Default alias (${importedAliases.join(', ')}), or press Enter to skip: `
    )
  ).trim();
  if (enteredAlias.length === 0) {
    return undefined;
  }

  if (!importedAliases.includes(enteredAlias)) {
    throw new CliError(
      `Default alias "${enteredAlias}" was not part of this import.`,
      {
        code: 'INVALID_IMPORT_DEFAULT_ALIAS',
        exitCode: EXIT_CODES.usage,
        suggestion: `Choose one of the imported aliases: ${importedAliases.join(', ')}.`
      }
    );
  }

  return enteredAlias;
}
