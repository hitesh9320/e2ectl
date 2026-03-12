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
          metadata: {
            api: {
              code: 400,
              errors: {
                state: ['invalid']
              },
              message: 'Invalid state value provided'
            }
          },
          suggestion: 'Check the request inputs and try again.'
        }
      ),
      { json: true }
    );

    expect(JSON.parse(message)).toEqual({
      error: {
        code: 'API_REQUEST_FAILED',
        details: ['HTTP status: 400 Bad Request', 'API code: 400'],
        exit_code: EXIT_CODES.network,
        message: 'MyAccount API request failed: Invalid state value provided',
        metadata: {
          api: {
            code: 400,
            errors: {
              state: ['invalid']
            },
            message: 'Invalid state value provided'
          }
        },
        suggestion: 'Check the request inputs and try again.',
        type: 'cli'
      }
    });
  });
});
