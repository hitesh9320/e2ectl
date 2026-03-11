import { createProgram } from '../../../src/cli.js';
import type { MyAccountClient } from '../../../src/client/api.js';
import { ConfigStore } from '../../../src/config/store.js';
import type { CliRuntime } from '../../../src/runtime.js';
import type { NodeCreateRequest } from '../../../src/types/node.js';
import { createTestConfigPath, MemoryWriter } from '../../helpers/runtime.js';

function createNodeClientStub() {
  const listNodes = vi.fn(() =>
    Promise.resolve({
      code: 200,
      data: [
        {
          id: 101,
          is_locked: false,
          name: 'node-a',
          plan: 'C3.8GB',
          private_ip_address: '10.0.0.1',
          public_ip_address: '1.1.1.1',
          status: 'Running'
        }
      ],
      errors: {},
      message: 'Success',
      total_count: 1,
      total_page_number: 1
    })
  );
  const getNode = vi.fn(() =>
    Promise.resolve({
      code: 200,
      data: {
        created_at: '2026-03-11T10:00:00Z',
        disk: '100 GB',
        id: 101,
        location: 'Delhi',
        memory: '8 GB',
        name: 'node-a',
        plan: 'C3.8GB',
        private_ip_address: '10.0.0.1',
        public_ip_address: '1.1.1.1',
        status: 'Running',
        vcpus: '4'
      },
      errors: {},
      message: 'Success'
    })
  );
  const createNode = vi.fn((body: NodeCreateRequest) =>
    Promise.resolve({
      code: 200,
      data: {
        node_create_response: [
          {
            created_at: '2026-03-11T10:00:00Z',
            id: 205,
            location: 'Delhi',
            name: body.name,
            plan: 'C3.8GB',
            private_ip_address: '10.0.0.2',
            public_ip_address: '1.1.1.2',
            status: 'Creating'
          }
        ],
        total_number_of_node_created: 1,
        total_number_of_node_requested: 1
      },
      errors: {},
      message: 'Success'
    })
  );
  const deleteNode = vi.fn(() =>
    Promise.resolve({
      code: 200,
      data: {},
      errors: {},
      message: 'Success'
    })
  );

  const stub: MyAccountClient = {
    createNode,
    delete: vi.fn(),
    deleteNode,
    get: vi.fn(),
    getNode,
    listNodes,
    post: vi.fn(),
    request: vi.fn(),
    validateCredentials: vi.fn()
  };

  return {
    createNode,
    deleteNode,
    getNode,
    listNodes,
    stub
  };
}

describe('node commands', () => {
  function createRuntimeFixture(options?: {
    confirmResult?: boolean;
    isInteractive?: boolean;
  }): {
    confirm: ReturnType<typeof vi.fn>;
    runtime: CliRuntime;
    stdout: MemoryWriter;
    stub: ReturnType<typeof createNodeClientStub>;
  } {
    const configPath = createTestConfigPath('node-test');
    const store = new ConfigStore({ configPath });
    const stdout = new MemoryWriter();
    const stub = createNodeClientStub();
    const confirm = vi.fn(() =>
      Promise.resolve(options?.confirmResult ?? true)
    );

    const runtime: CliRuntime = {
      confirm,
      createApiClient: () => stub.stub,
      credentialValidator: {
        validate: vi.fn()
      },
      isInteractive: options?.isInteractive ?? true,
      stderr: new MemoryWriter(),
      stdout,
      store
    };

    return {
      confirm,
      runtime,
      stdout,
      stub
    };
  }

  async function seedProfile(runtime: CliRuntime): Promise<void> {
    await runtime.store.upsertProfile('prod', {
      api_key: 'api-key',
      auth_token: 'auth-token',
      project_id: '12345',
      location: 'Delhi'
    });
  }

  it('lists nodes in deterministic json mode', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      'e2ectl',
      '--json',
      'node',
      'list',
      '--alias',
      'prod'
    ]);

    expect(stdout.buffer).toContain('"action": "list"');
    expect(stdout.buffer).toContain('"name": "node-a"');
  });

  it('gets a node in human-readable mode', async () => {
    const { runtime, stdout } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      'e2ectl',
      'node',
      'get',
      '101',
      '--alias',
      'prod'
    ]);

    expect(stdout.buffer).toContain('ID: 101');
    expect(stdout.buffer).toContain('Name: node-a');
    expect(stdout.buffer).toContain('Status: Running');
  });

  it('creates a node with the prototype defaults', async () => {
    const { runtime, stdout, stub } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      'e2ectl',
      '--json',
      'node',
      'create',
      '--name',
      'new-node',
      '--plan',
      'plan-123',
      '--image',
      'Ubuntu-24.04-Distro',
      '--alias',
      'prod'
    ]);

    expect(stub.createNode).toHaveBeenCalledWith({
      backups: false,
      default_public_ip: false,
      disable_password: true,
      enable_bitninja: false,
      image: 'Ubuntu-24.04-Distro',
      is_ipv6_availed: false,
      is_saved_image: false,
      label: 'default',
      name: 'new-node',
      number_of_instances: 1,
      plan: 'plan-123',
      ssh_keys: [],
      start_scripts: []
    });
    expect(stdout.buffer).toContain('"action": "create"');
    expect(stdout.buffer).toContain('"created": 1');
  });

  it('cancels deletion when the confirmation is declined', async () => {
    const { confirm, runtime, stdout, stub } = createRuntimeFixture({
      confirmResult: false,
      isInteractive: true
    });
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      'e2ectl',
      '--json',
      'node',
      'delete',
      '101',
      '--alias',
      'prod'
    ]);

    expect(confirm).toHaveBeenCalledWith(
      'Delete node 101? This cannot be undone.'
    );
    expect(stub.deleteNode).not.toHaveBeenCalled();
    expect(stdout.buffer).toContain('"cancelled": true');
  });

  it('requires force outside an interactive terminal', async () => {
    const { runtime, stub } = createRuntimeFixture({
      isInteractive: false
    });
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await expect(
      program.parseAsync([
        'node',
        'e2ectl',
        'node',
        'delete',
        '101',
        '--alias',
        'prod'
      ])
    ).rejects.toThrow(/requires confirmation/i);
    expect(stub.deleteNode).not.toHaveBeenCalled();
  });

  it('deletes a node when force is supplied', async () => {
    const { confirm, runtime, stdout, stub } = createRuntimeFixture({
      isInteractive: false
    });
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await program.parseAsync([
      'node',
      'e2ectl',
      '--json',
      'node',
      'delete',
      '101',
      '--alias',
      'prod',
      '--force'
    ]);

    expect(confirm).not.toHaveBeenCalled();
    expect(stub.deleteNode).toHaveBeenCalledWith('101');
    expect(stdout.buffer).toContain('"cancelled": false');
  });

  it('rejects non-numeric node identifiers', async () => {
    const { runtime } = createRuntimeFixture();
    await seedProfile(runtime);
    const program = createProgram(runtime);

    await expect(
      program.parseAsync([
        'node',
        'e2ectl',
        'node',
        'get',
        'node-abc',
        '--alias',
        'prod'
      ])
    ).rejects.toThrow(/Node ID must be numeric/i);
  });
});
