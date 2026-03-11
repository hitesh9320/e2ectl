import Table from 'cli-table3';

import type { ConfigFile, ProfileSummary } from '../types/config.js';
import { stableStringify, type JsonValue } from '../utils/json.js';
import { maskSecret } from '../utils/mask.js';

export function formatJson(value: JsonValue): string {
  return `${stableStringify(value)}\n`;
}

export function summarizeProfiles(config: ConfigFile): ProfileSummary[] {
  return Object.entries(config.profiles).map(([alias, profile]) => ({
    alias,
    isDefault: config.default === alias,
    api_key: maskSecret(profile.api_key),
    auth_token: maskSecret(profile.auth_token),
    project_id: profile.project_id,
    location: profile.location
  }));
}

export function formatProfilesTable(profiles: ProfileSummary[]): string {
  const table = new Table({
    head: [
      'Alias',
      'Default',
      'API Key',
      'Auth Token',
      'Project ID',
      'Location'
    ]
  });

  for (const profile of profiles) {
    table.push([
      profile.alias,
      profile.isDefault ? 'yes' : '',
      profile.api_key,
      profile.auth_token,
      profile.project_id,
      profile.location
    ]);
  }

  return table.toString();
}
