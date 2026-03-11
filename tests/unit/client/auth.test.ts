import { resolveCredentials } from '../../../src/client/auth.js';
import type { ConfigFile } from '../../../src/types/config.js';

describe('resolveCredentials', () => {
  const config: ConfigFile = {
    profiles: {
      prod: {
        api_key: 'api-prod',
        auth_token: 'auth-prod',
        project_id: '123',
        location: 'Delhi'
      }
    },
    default: 'prod'
  };

  it('returns the default profile when environment overrides are not set', () => {
    const result = resolveCredentials({
      config,
      configPath: '/tmp/config.json',
      env: {}
    });

    expect(result).toEqual({
      api_key: 'api-prod',
      auth_token: 'auth-prod',
      project_id: '123',
      location: 'Delhi',
      alias: 'prod',
      source: 'profile'
    });
  });

  it('overrides profile values with environment variables', () => {
    const result = resolveCredentials({
      alias: 'prod',
      config,
      env: {
        E2E_PROJECT_ID: '456'
      }
    });

    expect(result.project_id).toBe('456');
    expect(result.api_key).toBe('api-prod');
    expect(result.source).toBe('mixed');
  });

  it('uses environment credentials without a saved profile', () => {
    const result = resolveCredentials({
      config: { profiles: {} },
      env: {
        E2E_API_KEY: 'api-env',
        E2E_AUTH_TOKEN: 'auth-env',
        E2E_PROJECT_ID: '789',
        E2E_LOCATION: 'Chennai'
      }
    });

    expect(result).toEqual({
      api_key: 'api-env',
      auth_token: 'auth-env',
      project_id: '789',
      location: 'Chennai',
      source: 'env'
    });
    expect(result.alias).toBeUndefined();
  });

  it('throws an actionable error when credentials are incomplete', () => {
    expect(() =>
      resolveCredentials({
        config: { profiles: {} },
        configPath: '/tmp/config.json',
        env: {
          E2E_API_KEY: 'api-env'
        }
      })
    ).toThrowError(/Unable to resolve MyAccount credentials/);
  });
});
