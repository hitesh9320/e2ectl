export interface ProfileConfig {
  api_key: string;
  auth_token: string;
  project_id: string;
  location: string;
}

export const VALID_LOCATIONS = ['Delhi', 'Chennai'] as const;

export interface ConfigFile {
  profiles: Record<string, ProfileConfig>;
  default?: string;
}

export interface ResolvedCredentials extends ProfileConfig {
  alias?: string;
  source: 'env' | 'profile' | 'mixed';
}

export interface ProfileSummary {
  alias: string;
  isDefault: boolean;
  api_key: string;
  auth_token: string;
  project_id: string;
  location: string;
}

export const REQUIRED_CREDENTIAL_FIELDS = [
  'api_key',
  'auth_token',
  'project_id',
  'location'
] as const;

export type CredentialField = (typeof REQUIRED_CREDENTIAL_FIELDS)[number];

export const ENV_VAR_BY_FIELD: Record<CredentialField, string> = {
  api_key: 'E2E_API_KEY',
  auth_token: 'E2E_AUTH_TOKEN',
  project_id: 'E2E_PROJECT_ID',
  location: 'E2E_LOCATION'
};
