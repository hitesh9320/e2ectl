import { randomUUID } from 'node:crypto';
import {
  chmod,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { stableStringify, type JsonValue } from '../core/json.js';
import type { ConfigFile, ProfileConfig } from './types.js';

const DEFAULT_DIRECTORY_NAME = '.e2e';
const DEFAULT_CONFIG_FILE_NAME = 'config.json';
const CONFIG_DIRECTORY_MODE = 0o700;
const CONFIG_FILE_MODE = 0o600;

export interface ConfigStoreOptions {
  configPath?: string;
}

export class ConfigStore {
  readonly configPath: string;

  constructor(options: ConfigStoreOptions = {}) {
    this.configPath =
      options.configPath ??
      path.join(os.homedir(), DEFAULT_DIRECTORY_NAME, DEFAULT_CONFIG_FILE_NAME);
  }

  async read(): Promise<ConfigFile> {
    try {
      const content = await readFile(this.configPath, 'utf8');
      return normalizeConfig(JSON.parse(content) as ConfigFile);
    } catch (error: unknown) {
      if (isFileNotFound(error)) {
        return createEmptyConfig();
      }

      throw error;
    }
  }

  async write(config: ConfigFile): Promise<void> {
    const normalizedConfig = normalizeConfig(config);
    const directoryPath = path.dirname(this.configPath);
    await ensureSecureDirectory(directoryPath);
    const payload = stableStringify(normalizedConfig as unknown as JsonValue);
    await writeSecureConfigFile(this.configPath, `${payload}\n`);
  }

  async upsertProfile(
    alias: string,
    profile: ProfileConfig
  ): Promise<ConfigFile> {
    const config = await this.read();
    const nextConfig: ConfigFile = {
      ...config,
      profiles: {
        ...config.profiles,
        [alias]: profile
      },
      default: config.default ?? alias
    };
    await this.write(nextConfig);
    return normalizeConfig(nextConfig);
  }

  async removeProfile(alias: string): Promise<ConfigFile> {
    const config = await this.read();
    const nextProfiles = Object.fromEntries(
      Object.entries(config.profiles).filter(
        ([profileAlias]) => profileAlias !== alias
      )
    );

    const nextDefault =
      config.default === alias
        ? firstProfileAlias(nextProfiles)
        : config.default;
    const nextConfig =
      nextDefault === undefined
        ? {
            profiles: nextProfiles
          }
        : {
            profiles: nextProfiles,
            default: nextDefault
          };
    await this.write(nextConfig);
    return normalizeConfig(nextConfig);
  }

  async setDefault(alias: string): Promise<ConfigFile> {
    const config = await this.read();
    const nextConfig: ConfigFile = {
      ...config,
      default: alias
    };
    await this.write(nextConfig);
    return normalizeConfig(nextConfig);
  }

  async updateProfile(
    alias: string,
    patch: Partial<ProfileConfig>
  ): Promise<ConfigFile> {
    const config = await this.read();
    const currentProfile = config.profiles[alias];
    const nextConfig: ConfigFile = {
      ...config,
      profiles: {
        ...config.profiles,
        [alias]: normalizeProfile({
          ...currentProfile,
          ...patch
        } as ProfileConfig)
      }
    };
    await this.write(nextConfig);
    return normalizeConfig(nextConfig);
  }

  async hasProfile(alias: string): Promise<boolean> {
    const config = await this.read();
    return config.profiles[alias] !== undefined;
  }
}

export function createEmptyConfig(): ConfigFile {
  return {
    profiles: {}
  };
}

export function normalizeConfig(config: ConfigFile): ConfigFile {
  const sortedProfiles = Object.fromEntries(
    Object.entries(config.profiles)
      .map(([alias, profile]) => [alias, normalizeProfile(profile)] as const)
      .sort(([leftAlias], [rightAlias]) => leftAlias.localeCompare(rightAlias))
  );

  return config.default === undefined
    ? {
        profiles: sortedProfiles
      }
    : {
        profiles: sortedProfiles,
        default: config.default
      };
}

function normalizeProfile(profile: ProfileConfig): ProfileConfig {
  const normalizedProfile: ProfileConfig = {
    api_key: profile.api_key.trim(),
    auth_token: profile.auth_token.trim()
  };

  if (isNonEmptyString(profile.default_project_id)) {
    normalizedProfile.default_project_id = profile.default_project_id.trim();
  }

  if (isNonEmptyString(profile.default_location)) {
    normalizedProfile.default_location = profile.default_location.trim();
  }

  return normalizedProfile;
}

function firstProfileAlias(
  profiles: Record<string, ProfileConfig>
): string | undefined {
  return Object.keys(profiles).sort()[0];
}

function isFileNotFound(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

function isNonEmptyString(value: string | undefined): value is string {
  return value !== undefined && value.trim().length > 0;
}

async function ensureSecureDirectory(directoryPath: string): Promise<void> {
  await mkdir(directoryPath, {
    recursive: true,
    mode: CONFIG_DIRECTORY_MODE
  });
  await chmod(directoryPath, CONFIG_DIRECTORY_MODE);
}

async function writeSecureConfigFile(
  configPath: string,
  payload: string
): Promise<void> {
  const tempPath = path.join(
    path.dirname(configPath),
    `.${path.basename(configPath)}.${randomUUID()}.tmp`
  );

  try {
    await writeFile(tempPath, payload, {
      encoding: 'utf8',
      flag: 'wx',
      mode: CONFIG_FILE_MODE
    });
    await chmod(tempPath, CONFIG_FILE_MODE);
    await rename(tempPath, configPath);
    await chmod(configPath, CONFIG_FILE_MODE);
  } finally {
    await rm(tempPath, { force: true });
  }
}
