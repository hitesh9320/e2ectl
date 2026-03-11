import { createProgram } from '../../../src/cli.js';
import { MyAccountApiClient } from '../../../src/client/api.js';
import {
  ApiCredentialValidator,
  type CredentialValidationResult
} from '../../../src/client/credential-validator.js';
import { ConfigStore } from '../../../src/config/store.js';
import type { CliRuntime } from '../../../src/runtime.js';
import type {
  ProfileConfig,
  ResolvedCredentials
} from '../../../src/types/config.js';
import { createTestConfigPath, MemoryWriter } from '../../helpers/runtime.js';

class StubCredentialValidator extends ApiCredentialValidator {
  readonly calls: ProfileConfig[] = [];
  private readonly result: CredentialValidationResult;

  constructor(result: CredentialValidationResult = { valid: true }) {
    super();
    this.result = result;
  }

  override validate(
    profile: ProfileConfig
  ): Promise<CredentialValidationResult> {
    this.calls.push(profile);
    return Promise.resolve(this.result);
  }
}

describe('config commands', () => {
  function createRuntimeFixture(): {
    runtime: CliRuntime;
    stdout: MemoryWriter;
    validator: StubCredentialValidator;
    store: ConfigStore;
  } {
    const configPath = createTestConfigPath('config-test');
    const stdout = new MemoryWriter();
    const validator = new StubCredentialValidator();
    const store = new ConfigStore({ configPath });

    return {
      runtime: {
        confirm: vi.fn(() => Promise.resolve(true)),
        createApiClient: (credentials: ResolvedCredentials) =>
          new MyAccountApiClient(credentials),
        credentialValidator: validator,
        isInteractive: true,
        stderr: new MemoryWriter(),
        stdout,
        store
      },
      stdout,
      validator,
      store
    };
  }

  it('adds a profile after validation and prints masked json output', async () => {
    const { runtime, stdout, validator } = createRuntimeFixture();
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      'e2ectl',
      '--json',
      'config',
      'add',
      '--alias',
      'prod',
      '--api-key',
      'api-123456',
      '--auth-token',
      'auth-654321',
      '--project-id',
      '12345',
      '--location',
      'Delhi'
    ]);

    expect(validator.calls).toHaveLength(1);
    expect(stdout.buffer).toContain('"action": "saved"');
    expect(stdout.buffer).toContain('"alias": "prod"');
    expect(stdout.buffer).toContain('"api_key": "******3456"');
    expect(stdout.buffer).toContain('"auth_token": "*******4321"');
  });

  it('lists profiles with masked table output', async () => {
    const { runtime, stdout, store } = createRuntimeFixture();
    const program = createProgram(runtime);

    await store.upsertProfile('prod', {
      api_key: 'api-123456',
      auth_token: 'auth-654321',
      project_id: '12345',
      location: 'Delhi'
    });

    await program.parseAsync(['node', 'e2ectl', 'config', 'list']);

    expect(stdout.buffer).toContain('prod');
    expect(stdout.buffer).toContain('******3456');
    expect(stdout.buffer).toContain('*******4321');
  });

  it('sets the default alias', async () => {
    const { runtime, stdout, store } = createRuntimeFixture();
    const program = createProgram(runtime);

    await store.upsertProfile('prod', {
      api_key: 'api-123456',
      auth_token: 'auth-654321',
      project_id: '12345',
      location: 'Delhi'
    });
    await store.upsertProfile('staging', {
      api_key: 'api-999999',
      auth_token: 'auth-888888',
      project_id: '67890',
      location: 'Chennai'
    });

    await program.parseAsync([
      'node',
      'e2ectl',
      '--json',
      'config',
      'set-default',
      '--alias',
      'staging'
    ]);

    expect(stdout.buffer).toContain('"default": "staging"');
  });

  it('removes a saved profile', async () => {
    const { runtime, stdout, store } = createRuntimeFixture();
    const program = createProgram(runtime);

    await store.upsertProfile('prod', {
      api_key: 'api-123456',
      auth_token: 'auth-654321',
      project_id: '12345',
      location: 'Delhi'
    });

    await program.parseAsync([
      'node',
      'e2ectl',
      '--json',
      'config',
      'remove',
      '--alias',
      'prod'
    ]);

    expect(stdout.buffer).toContain('"profiles": []');
  });

  it('rejects unsupported locations before validation', async () => {
    const { runtime, validator } = createRuntimeFixture();
    const program = createProgram(runtime);

    await expect(
      program.parseAsync([
        'node',
        'e2ectl',
        'config',
        'add',
        '--alias',
        'prod',
        '--api-key',
        'api-123456',
        '--auth-token',
        'auth-654321',
        '--project-id',
        '12345',
        '--location',
        'Noida'
      ])
    ).rejects.toThrow(/Unsupported location/i);
    expect(validator.calls).toHaveLength(0);
  });
});
