import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

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
    confirm: ReturnType<typeof vi.fn>;
    prompt: ReturnType<typeof vi.fn>;
    runtime: CliRuntime;
    stdout: MemoryWriter;
    validator: StubCredentialValidator;
    store: ConfigStore;
  } {
    const configPath = createTestConfigPath('config-test');
    const stdout = new MemoryWriter();
    const validator = new StubCredentialValidator();
    const store = new ConfigStore({ configPath });
    const confirm = vi.fn(() => Promise.resolve(true));
    const prompt = vi.fn(() => Promise.resolve(''));

    return {
      confirm,
      prompt,
      runtime: {
        confirm,
        createApiClient: (credentials: ResolvedCredentials) =>
          new MyAccountApiClient(credentials),
        credentialValidator: validator,
        isInteractive: true,
        prompt,
        stderr: new MemoryWriter(),
        stdout,
        store
      },
      stdout,
      validator,
      store
    };
  }

  async function createImportFile(payload: unknown): Promise<string> {
    const filePath = path.join(
      process.cwd(),
      '.tmp',
      `import-${Math.random().toString(36).slice(2)}.json`
    );
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(payload)}\n`, 'utf8');
    return filePath;
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
    expect(stdout.buffer).toContain('"api_key": "****3456"');
    expect(stdout.buffer).toContain('"auth_token": "****4321"');
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
    expect(stdout.buffer).toContain('****3456');
    expect(stdout.buffer).toContain('****4321');
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

  it('imports aliases, prompts for shared metadata, and offers a default alias', async () => {
    const { confirm, prompt, runtime, stdout, validator } =
      createRuntimeFixture();
    const program = createProgram(runtime);
    const filePath = await createImportFile({
      prod: {
        api_auth_token: 'auth-prod',
        api_key: 'api-prod'
      },
      staging: {
        api_auth_token: 'auth-staging',
        api_key: 'api-staging'
      }
    });

    confirm.mockResolvedValueOnce(true);
    prompt
      .mockResolvedValueOnce('46429')
      .mockResolvedValueOnce('Delhi')
      .mockResolvedValueOnce('prod');

    await program.parseAsync([
      'node',
      'e2ectl',
      'config',
      'import',
      '--file',
      filePath
    ]);

    expect(validator.calls).toEqual([
      {
        api_key: 'api-prod',
        auth_token: 'auth-prod',
        project_id: '46429',
        location: 'Delhi'
      },
      {
        api_key: 'api-staging',
        auth_token: 'auth-staging',
        project_id: '46429',
        location: 'Delhi'
      }
    ]);
    expect(stdout.buffer).toContain('Imported 2 profiles');
    expect(stdout.buffer).toContain('Saved aliases: prod, staging.');
    expect(stdout.buffer).toContain('Set "prod" as the default profile.');
  });

  it('sets the requested default alias during import without prompting', async () => {
    const { confirm, prompt, runtime, stdout } = createRuntimeFixture();
    const program = createProgram(runtime);
    const filePath = await createImportFile({
      prod: {
        api_auth_token: 'auth-prod',
        api_key: 'api-prod'
      }
    });

    await program.parseAsync([
      'node',
      'e2ectl',
      '--json',
      'config',
      'import',
      '--file',
      filePath,
      '--project-id',
      '46429',
      '--location',
      'Delhi',
      '--default',
      'prod',
      '--no-input'
    ]);

    expect(confirm).not.toHaveBeenCalled();
    expect(prompt).not.toHaveBeenCalled();
    expect(stdout.buffer).toContain('"action": "imported"');
    expect(stdout.buffer).toContain('"default": "prod"');
    expect(stdout.buffer).toContain('"imported_count": 1');
  });

  it('skips the default prompt when a default profile already exists', async () => {
    const { confirm, prompt, runtime, stdout, store } = createRuntimeFixture();
    const program = createProgram(runtime);
    const filePath = await createImportFile({
      prod: {
        api_auth_token: 'auth-prod',
        api_key: 'api-prod'
      }
    });

    await store.upsertProfile('existing', {
      api_key: 'api-existing',
      auth_token: 'auth-existing',
      project_id: '12345',
      location: 'Delhi'
    });

    await program.parseAsync([
      'node',
      'e2ectl',
      'config',
      'import',
      '--file',
      filePath,
      '--project-id',
      '46429',
      '--location',
      'Delhi',
      '--no-input'
    ]);

    expect(confirm).not.toHaveBeenCalled();
    expect(prompt).not.toHaveBeenCalled();
    expect(stdout.buffer).toContain('Default profile remains "existing".');
  });

  it('fails in non-interactive mode when project metadata is missing', async () => {
    const { runtime } = createRuntimeFixture();
    const program = createProgram({
      ...runtime,
      isInteractive: false
    });
    const filePath = await createImportFile({
      prod: {
        api_auth_token: 'auth-prod',
        api_key: 'api-prod'
      }
    });

    await expect(
      program.parseAsync([
        'node',
        'e2ectl',
        'config',
        'import',
        '--file',
        filePath,
        '--no-input'
      ])
    ).rejects.toThrow(/Project ID is required/i);
  });
});
