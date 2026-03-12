import { EXIT_CODES } from '../../../src/core/errors.js';
import { MyAccountApiClient } from '../../../src/myaccount/client.js';

describe('MyAccountApiClient', () => {
  const credentials = {
    api_key: 'api-key',
    auth_token: 'auth-token',
    project_id: '123',
    location: 'Delhi',
    source: 'profile' as const
  };

  it('injects bearer auth and required query params', async () => {
    let seenInput = '';
    let seenInit: RequestInit | undefined;

    const fetchFn = vi.fn((input: string, init?: RequestInit) => {
      seenInput = input;
      seenInit = init;

      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () =>
          Promise.resolve({
            code: 200,
            data: { ok: true },
            errors: {},
            message: 'Success'
          })
      });
    });

    const client = new MyAccountApiClient(credentials, {
      baseUrl: 'https://example.test/root',
      fetchFn
    });

    await client.get('/nodes/', {
      query: {
        page_no: '2'
      }
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(seenInput).toBe(
      'https://example.test/root/nodes/?apikey=api-key&project_id=123&location=Delhi&page_no=2'
    );
    expect(seenInit?.headers).toMatchObject({
      Authorization: 'Bearer auth-token'
    });
  });

  it('omits project context for credential validation', async () => {
    let seenInput = '';

    const fetchFn = vi.fn((input: string) => {
      seenInput = input;

      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () =>
          Promise.resolve({
            code: 200,
            data: { valid: true },
            errors: {},
            message: 'Success'
          })
      });
    });

    const client = new MyAccountApiClient(
      {
        api_key: 'api-key',
        auth_token: 'auth-token',
        source: 'profile'
      },
      {
        baseUrl: 'https://example.test/',
        fetchFn
      }
    );

    await client.validateCredentials();

    expect(seenInput).toBe(
      'https://example.test/iam/multi-crn/?apikey=api-key'
    );
  });

  it('fails early when a project-scoped request has no resolved context', async () => {
    const client = new MyAccountApiClient(
      {
        api_key: 'api-key',
        auth_token: 'auth-token',
        source: 'profile'
      },
      {
        fetchFn: vi.fn()
      }
    );

    await expect(client.listNodes()).rejects.toThrow(
      /project context is required/i
    );
  });

  it('serializes a public-node create request that matches backend serializer expectations', async () => {
    let seenInput = '';
    let seenInit: RequestInit | undefined;

    const fetchFn = vi.fn((input: string, init?: RequestInit) => {
      seenInput = input;
      seenInit = init;

      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () =>
          Promise.resolve({
            code: 200,
            data: {
              node_create_response: [],
              total_number_of_node_created: 1,
              total_number_of_node_requested: 1
            },
            errors: {},
            message: 'Success'
          })
      });
    });

    const client = new MyAccountApiClient(credentials, {
      baseUrl: 'https://example.test/',
      fetchFn
    });

    await client.createNode({
      backups: false,
      default_public_ip: false,
      disable_password: true,
      enable_bitninja: false,
      image: 'Ubuntu-24.04-Distro',
      is_ipv6_availed: false,
      is_saved_image: false,
      label: 'default',
      name: 'node-a',
      number_of_instances: 1,
      plan: 'plan-123',
      ssh_keys: [],
      start_scripts: []
    });

    expect(seenInput).toBe(
      'https://example.test/nodes/?apikey=api-key&project_id=123&location=Delhi'
    );
    expect(seenInit?.method).toBe('POST');
    expect(seenInit?.headers).toMatchObject({
      Authorization: 'Bearer auth-token',
      'Content-Type': 'application/json'
    });
    expect(typeof seenInit?.body).toBe('string');
    const body = JSON.parse(seenInit?.body as string) as Record<
      string,
      unknown
    >;

    expect(body).toMatchObject({
      backups: false,
      default_public_ip: false,
      disable_password: true,
      enable_bitninja: false,
      image: 'Ubuntu-24.04-Distro',
      is_ipv6_availed: false,
      is_saved_image: false,
      label: 'default',
      name: 'node-a',
      number_of_instances: 1,
      plan: 'plan-123',
      ssh_keys: [],
      start_scripts: []
    });
    expect(body).not.toHaveProperty('security_group_id');
    expect(body).not.toHaveProperty('vpc_id');
    expect(body).not.toHaveProperty('subnet_id');
    expect(body).not.toHaveProperty('reserve_ip');
    expect(body).not.toHaveProperty('reserve_ip_pool');
    expect(body).not.toHaveProperty('image_id');
    expect(body).not.toHaveProperty('disk');
    expect(body).not.toHaveProperty('is_encryption_required');
    expect(body).not.toHaveProperty('isEncryptionEnabled');
    expect(body).not.toHaveProperty('saved_image_template_id');
  });

  it('requests the OS catalog from the docs-backed discovery path', async () => {
    let seenInput = '';

    const fetchFn = vi.fn((input: string) => {
      seenInput = input;

      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () =>
          Promise.resolve({
            code: 200,
            data: {
              category_list: []
            },
            errors: {},
            message: 'Success'
          })
      });
    });

    const client = new MyAccountApiClient(credentials, {
      baseUrl: 'https://example.test/',
      fetchFn
    });

    await client.listNodeCatalogOs();

    expect(seenInput).toBe(
      'https://example.test/images/os-category/?apikey=api-key&project_id=123&location=Delhi'
    );
  });

  it('serializes catalog plan queries with the required filters', async () => {
    let seenInput = '';

    const fetchFn = vi.fn((input: string) => {
      seenInput = input;

      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () =>
          Promise.resolve({
            code: 200,
            data: [],
            errors: {},
            message: 'Success'
          })
      });
    });

    const client = new MyAccountApiClient(credentials, {
      baseUrl: 'https://example.test/',
      fetchFn
    });

    await client.listNodeCatalogPlans({
      category: 'Ubuntu',
      display_category: 'Linux Virtual Node',
      os: 'Ubuntu',
      osversion: '24.04'
    });

    expect(seenInput).toBe(
      'https://example.test/images/?apikey=api-key&project_id=123&location=Delhi&category=Ubuntu&display_category=Linux+Virtual+Node&os=Ubuntu&osversion=24.04'
    );
  });

  it('issues delete requests against the node resource path', async () => {
    let seenInput = '';
    let seenInit: RequestInit | undefined;

    const fetchFn = vi.fn((input: string, init?: RequestInit) => {
      seenInput = input;
      seenInit = init;

      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () =>
          Promise.resolve({
            code: 200,
            data: {},
            errors: {},
            message: 'Success'
          })
      });
    });

    const client = new MyAccountApiClient(credentials, {
      baseUrl: 'https://example.test/',
      fetchFn
    });

    await client.deleteNode('101');

    expect(seenInput).toBe(
      'https://example.test/nodes/101/?apikey=api-key&project_id=123&location=Delhi'
    );
    expect(seenInit?.method).toBe('DELETE');
  });

  it('issues node action requests with PUT and the expected body payload', async () => {
    let seenInput = '';
    let seenInit: RequestInit | undefined;

    const fetchFn = vi.fn((input: string, init?: RequestInit) => {
      seenInput = input;
      seenInit = init;

      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () =>
          Promise.resolve({
            code: 200,
            data: {
              action_type: 'save_images',
              created_at: '2026-03-12T09:00:00Z',
              id: 301,
              image_id: 'img-123',
              resource_id: '101',
              resource_name: 'node-a',
              status: 'in_progress'
            },
            errors: {},
            message: 'Image creation initiated'
          })
      });
    });

    const client = new MyAccountApiClient(credentials, {
      baseUrl: 'https://example.test/',
      fetchFn
    });

    await client.runNodeAction('101', {
      name: 'golden-image',
      type: 'save_images'
    });

    expect(seenInput).toBe(
      'https://example.test/nodes/101/actions/?apikey=api-key&project_id=123&location=Delhi'
    );
    expect(seenInit?.method).toBe('PUT');
    expect(seenInit?.headers).toMatchObject({
      Authorization: 'Bearer auth-token',
      'Content-Type': 'application/json'
    });
    expect(seenInit?.body).toBe(
      JSON.stringify({
        name: 'golden-image',
        type: 'save_images'
      })
    );
  });

  it('raises a CLI error when the API envelope indicates failure', async () => {
    const client = new MyAccountApiClient(credentials, {
      fetchFn: () =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () =>
            Promise.resolve({
              code: 401,
              data: {},
              errors: {
                auth: ['invalid']
              },
              message: 'Unauthorized'
            })
        })
    });

    await expect(client.validateCredentials()).rejects.toMatchObject({
      code: 'API_REQUEST_FAILED',
      exitCode: EXIT_CODES.auth,
      message: 'MyAccount API request failed: Unauthorized',
      json: {
        code: 'API_REQUEST_FAILED',
        exit_code: EXIT_CODES.auth,
        http_status: 200,
        http_status_text: 'OK',
        message: 'MyAccount API request failed: Unauthorized',
        backend_payload: {
          code: 401,
          data: {},
          errors: {
            auth: ['invalid']
          },
          message: 'Unauthorized'
        }
      }
    });
  });

  it('treats string-shaped api errors as actionable api failures', async () => {
    const client = new MyAccountApiClient(credentials, {
      fetchFn: () =>
        Promise.resolve({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          json: () =>
            Promise.resolve({
              code: 400,
              data: {},
              errors: 'VM already in state of action to be performed',
              message: 'Bad Request'
            })
        })
    });

    await expect(
      client.runNodeAction('298189', {
        type: 'power_on'
      })
    ).rejects.toThrow(/Bad Request/);
  });

  it('extracts DRF-style detail errors and preserves auth exit codes', async () => {
    const client = new MyAccountApiClient(credentials, {
      fetchFn: () =>
        Promise.resolve({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          json: () =>
            Promise.resolve({
              detail: 'Authentication credentials were not provided.'
            })
        })
    });

    await expect(client.validateCredentials()).rejects.toMatchObject({
      code: 'API_REQUEST_FAILED',
      exitCode: EXIT_CODES.auth,
      message:
        'MyAccount API request failed: Authentication credentials were not provided.',
      json: {
        code: 'API_REQUEST_FAILED',
        exit_code: EXIT_CODES.auth,
        http_status: 401,
        http_status_text: 'Unauthorized',
        message:
          'MyAccount API request failed: Authentication credentials were not provided.',
        backend_payload: {
          detail: 'Authentication credentials were not provided.'
        }
      }
    });
  });

  it('treats status_code envelopes and extra backend fields as actionable failures', async () => {
    const client = new MyAccountApiClient(credentials, {
      fetchFn: () =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () =>
            Promise.resolve({
              data: {},
              errors: {
                state: ['invalid']
              },
              message: 'Invalid state value provided',
              request_id: 'req-123',
              status: false,
              status_code: '400'
            })
        })
    });

    await expect(
      client.runNodeAction('298189', { type: 'power_on' })
    ).rejects.toMatchObject({
      code: 'API_REQUEST_FAILED',
      exitCode: EXIT_CODES.network,
      message: 'MyAccount API request failed: Invalid state value provided',
      json: {
        code: 'API_REQUEST_FAILED',
        exit_code: EXIT_CODES.network,
        http_status: 200,
        http_status_text: 'OK',
        message: 'MyAccount API request failed: Invalid state value provided',
        backend_payload: {
          data: {},
          errors: {
            state: ['invalid']
          },
          message: 'Invalid state value provided',
          request_id: 'req-123',
          status: false,
          status_code: '400'
        }
      }
    });
  });

  it('treats success-coded responses with errors=true as failures', async () => {
    const client = new MyAccountApiClient(credentials, {
      fetchFn: () =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () =>
            Promise.resolve({
              code: 200,
              data: {},
              errors: true,
              message: 'Image already exists'
            })
        })
    });

    await expect(
      client.runNodeAction('298189', {
        name: 'golden-image',
        type: 'save_images'
      })
    ).rejects.toMatchObject({
      code: 'API_REQUEST_FAILED',
      message: 'MyAccount API request failed: Image already exists',
      json: {
        code: 'API_REQUEST_FAILED',
        exit_code: EXIT_CODES.network,
        http_status: 200,
        http_status_text: 'OK',
        message: 'MyAccount API request failed: Image already exists',
        backend_payload: {
          code: 200,
          data: {},
          errors: true,
          message: 'Image already exists'
        }
      }
    });
  });

  it('raises a CLI error when the response is malformed', async () => {
    const client = new MyAccountApiClient(credentials, {
      fetchFn: () =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () =>
            Promise.resolve({
              message: 'missing fields'
            })
        })
    });

    await expect(client.validateCredentials()).rejects.toMatchObject({
      code: 'INVALID_API_RESPONSE',
      exitCode: EXIT_CODES.network,
      message: 'The MyAccount API returned an unexpected response shape.',
      json: {
        code: 'INVALID_API_RESPONSE',
        exit_code: EXIT_CODES.network,
        http_status: 200,
        http_status_text: 'OK',
        message: 'The MyAccount API returned an unexpected response shape.',
        backend_payload: {
          message: 'missing fields'
        }
      }
    });
  });

  it('surfaces malformed non-json bodies without swallowing the response preview', async () => {
    const client = new MyAccountApiClient(credentials, {
      fetchFn: () =>
        Promise.resolve({
          ok: false,
          status: 502,
          statusText: 'Bad Gateway',
          json: () => Promise.reject(new SyntaxError('Unexpected token <')),
          text: () => Promise.resolve('<html>gateway failed</html>')
        })
    });

    await expect(client.validateCredentials()).rejects.toMatchObject({
      code: 'INVALID_API_RESPONSE',
      exitCode: EXIT_CODES.network,
      message: 'The MyAccount API returned a non-JSON or malformed response.',
      json: {
        code: 'INVALID_API_RESPONSE',
        exit_code: EXIT_CODES.network,
        http_status: 502,
        http_status_text: 'Bad Gateway',
        message: 'The MyAccount API returned a non-JSON or malformed response.',
        raw_body_preview: '<html>gateway failed</html>'
      }
    });
  });

  it('wraps network failures in an actionable CLI error', async () => {
    const client = new MyAccountApiClient(credentials, {
      fetchFn: () => Promise.reject(new Error('dns failure'))
    });

    await expect(client.validateCredentials()).rejects.toThrow(
      /could not be completed/i
    );
  });
});
