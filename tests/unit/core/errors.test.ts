import { CliError, EXIT_CODES, formatError } from '../../../src/core/errors.js';

describe('formatError', () => {
  it('renders actionable CLI errors', () => {
    const message = formatError(
      new CliError('Unable to resolve credentials.', {
        code: 'AUTH',
        details: ['Missing api_key', 'Missing auth_token'],
        exitCode: EXIT_CODES.auth,
        suggestion: 'Set E2E_API_KEY and E2E_AUTH_TOKEN.'
      })
    );

    expect(message).toContain('Error: Unable to resolve credentials.');
    expect(message).toContain('Details:');
    expect(message).toContain('Next step: Set E2E_API_KEY and E2E_AUTH_TOKEN.');
  });

  it('renders deterministic JSON errors when requested', () => {
    const message = formatError(
      new CliError(
        'MyAccount API request failed: Invalid state value provided',
        {
          code: 'API_REQUEST_FAILED',
          details: ['HTTP status: 400 Bad Request', 'API code: 400'],
          exitCode: EXIT_CODES.network,
          json: {
            backend_payload: {
              code: 400,
              errors: {
                state: ['invalid']
              },
              message: 'Invalid state value provided'
            },
            code: 'API_REQUEST_FAILED',
            exit_code: EXIT_CODES.network,
            http_status: 400,
            http_status_text: 'Bad Request',
            message:
              'MyAccount API request failed: Invalid state value provided'
          },
          suggestion: 'Check the request inputs and try again.'
        }
      ),
      { json: true }
    );

    expect(JSON.parse(message)).toEqual({
      error: {
        backend_payload: {
          code: 400,
          errors: {
            state: ['invalid']
          },
          message: 'Invalid state value provided'
        },
        code: 'API_REQUEST_FAILED',
        exit_code: EXIT_CODES.network,
        http_status: 400,
        http_status_text: 'Bad Request',
        message: 'MyAccount API request failed: Invalid state value provided'
      }
    });
  });

  it('keeps generic CLI JSON errors unchanged when no wrapper is provided', () => {
    const message = formatError(
      new CliError('Unable to resolve credentials.', {
        code: 'AUTH',
        details: ['Missing api_key'],
        exitCode: EXIT_CODES.auth,
        suggestion: 'Set E2E_API_KEY.'
      }),
      { json: true }
    );

    expect(JSON.parse(message)).toEqual({
      error: {
        code: 'AUTH',
        details: ['Missing api_key'],
        exit_code: EXIT_CODES.auth,
        message: 'Unable to resolve credentials.',
        metadata: null,
        suggestion: 'Set E2E_API_KEY.',
        type: 'cli'
      }
    });
  });
});
