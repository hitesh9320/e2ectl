import type {
  ConfigFile,
  CredentialField,
  ProfileConfig,
  ResolvedCredentials
} from '../types/config.js';
import {
  ENV_VAR_BY_FIELD,
  REQUIRED_CREDENTIAL_FIELDS
} from '../types/config.js';
import { CliError, EXIT_CODES } from '../utils/errors.js';

export interface ResolveCredentialsOptions {
  alias?: string;
  config: ConfigFile;
  configPath?: string;
  env?: NodeJS.ProcessEnv;
}

type PartialProfileConfig = Partial<Record<CredentialField, string>>;

export function readCredentialsFromEnv(
  env: NodeJS.ProcessEnv = process.env
): PartialProfileConfig {
  const credentials: PartialProfileConfig = {};

  for (const field of REQUIRED_CREDENTIAL_FIELDS) {
    const value = env[ENV_VAR_BY_FIELD[field]];
    if (isNonEmptyString(value)) {
      credentials[field] = value.trim();
    }
  }

  return credentials;
}

export function resolveCredentials(
  options: ResolveCredentialsOptions
): ResolvedCredentials {
  const envCredentials = readCredentialsFromEnv(options.env);
  const profileAlias = options.alias ?? options.config.default;
  const profile = resolveProfile(
    options.config,
    profileAlias,
    options.configPath,
    options.alias
  );
  const mergedCredentials: PartialProfileConfig = {
    ...(profile ?? {}),
    ...envCredentials
  };

  const missingFields = REQUIRED_CREDENTIAL_FIELDS.filter((field) => {
    const value = mergedCredentials[field];
    return !isNonEmptyString(value);
  });

  if (missingFields.length > 0) {
    const missingEnvVars = missingFields.map(
      (field) => ENV_VAR_BY_FIELD[field]
    );
    const details = [
      `Missing required values: ${missingFields.join(', ')}`,
      profileAlias === undefined
        ? 'No profile alias was provided and no default profile exists.'
        : `Resolved profile alias: ${profileAlias}`,
      `Expected environment variables: ${missingEnvVars.join(', ')}`
    ];

    if (options.configPath !== undefined) {
      details.push(`Config path: ${options.configPath}`);
    }

    throw new CliError('Unable to resolve MyAccount credentials.', {
      code: 'MISSING_CREDENTIALS',
      details,
      exitCode: EXIT_CODES.auth,
      suggestion:
        'Set the missing E2E_* environment variables or add a complete profile before running API-backed commands.'
    });
  }

  const resolvedCredentials = {
    api_key: mergedCredentials.api_key ?? '',
    auth_token: mergedCredentials.auth_token ?? '',
    project_id: mergedCredentials.project_id ?? '',
    location: mergedCredentials.location ?? '',
    source: inferCredentialSource(profile, envCredentials)
  };

  return profileAlias === undefined
    ? resolvedCredentials
    : {
        ...resolvedCredentials,
        alias: profileAlias
      };
}

function resolveProfile(
  config: ConfigFile,
  alias: string | undefined,
  configPath: string | undefined,
  explicitAlias: string | undefined
): ProfileConfig | undefined {
  if (alias === undefined) {
    return undefined;
  }

  const profile = config.profiles[alias];
  if (profile !== undefined) {
    return profile;
  }

  const details = [`Unknown profile alias: ${alias}`];
  if (configPath !== undefined) {
    details.push(`Config path: ${configPath}`);
  }

  throw new CliError(`Profile "${alias}" was not found.`, {
    code: 'PROFILE_NOT_FOUND',
    details,
    exitCode: EXIT_CODES.config,
    suggestion:
      explicitAlias === undefined
        ? 'Create a default profile or set E2E_* environment variables.'
        : 'Choose an existing profile alias or set E2E_* environment variables.'
  });
}

function inferCredentialSource(
  profile: ProfileConfig | undefined,
  envCredentials: PartialProfileConfig
): ResolvedCredentials['source'] {
  const hasEnvOverride = REQUIRED_CREDENTIAL_FIELDS.some(
    (field) => envCredentials[field] !== undefined
  );

  if (profile !== undefined && hasEnvOverride) {
    return 'mixed';
  }

  if (profile !== undefined) {
    return 'profile';
  }

  return 'env';
}

function isNonEmptyString(value: string | undefined): value is string {
  return value !== undefined && value.trim().length > 0;
}
