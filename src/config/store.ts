import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { ConfigFile, ProfileConfig } from '../types/config.js';
import { stableStringify, type JsonValue } from '../utils/json.js';

const DEFAULT_DIRECTORY_NAME = '.e2e';
const DEFAULT_CONFIG_FILE_NAME = 'config.json';

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
    await mkdir(path.dirname(this.configPath), { recursive: true });
    const payload = stableStringify(normalizedConfig as unknown as JsonValue);
    await writeFile(this.configPath, `${payload}\n`, 'utf8');
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
}

export function createEmptyConfig(): ConfigFile {
  return {
    profiles: {}
  };
}

export function normalizeConfig(config: ConfigFile): ConfigFile {
  const sortedProfiles = Object.fromEntries(
    Object.entries(config.profiles).sort(([leftAlias], [rightAlias]) =>
      leftAlias.localeCompare(rightAlias)
    )
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

function firstProfileAlias(
  profiles: Record<string, ProfileConfig>
): string | undefined {
  return Object.keys(profiles).sort()[0];
}

function isFileNotFound(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
