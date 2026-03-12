import { CliError, EXIT_CODES } from '../core/errors.js';

import type {
  ApiClientCredentials,
  ApiClientOptions,
  ApiEnvelope,
  ApiRequestOptions,
  FetchLike
} from './types.js';

const DEFAULT_BASE_URL = 'https://api.e2enetworks.com/myaccount/api/v1';
const DEFAULT_TIMEOUT_MS = 10_000;

export interface MyAccountTransport {
  delete<TResponse extends ApiEnvelope<unknown>>(
    path: string,
    options?: Omit<ApiRequestOptions, 'method' | 'path'>
  ): Promise<TResponse>;
  get<TResponse extends ApiEnvelope<unknown>>(
    path: string,
    options?: Omit<ApiRequestOptions, 'method' | 'path'>
  ): Promise<TResponse>;
  post<TResponse extends ApiEnvelope<unknown>>(
    path: string,
    options?: Omit<ApiRequestOptions, 'method' | 'path'>
  ): Promise<TResponse>;
  request<TResponse extends ApiEnvelope<unknown>>(
    options: ApiRequestOptions
  ): Promise<TResponse>;
}

export class MyAccountApiTransport implements MyAccountTransport {
  private readonly baseUrl: string;
  private readonly credentials: ApiClientCredentials;
  private readonly fetchFn: FetchLike;
  private readonly timeoutMs: number;

  constructor(
    credentials: ApiClientCredentials,
    options: ApiClientOptions = {}
  ) {
    this.credentials = credentials;
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_BASE_URL);
    this.fetchFn = options.fetchFn ?? (fetch as FetchLike);
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async get<TResponse extends ApiEnvelope<unknown>>(
    path: string,
    options: Omit<ApiRequestOptions, 'method' | 'path'> = {}
  ): Promise<TResponse> {
    return this.request<TResponse>({
      ...options,
      method: 'GET',
      path
    });
  }

  async post<TResponse extends ApiEnvelope<unknown>>(
    path: string,
    options: Omit<ApiRequestOptions, 'method' | 'path'> = {}
  ): Promise<TResponse> {
    return this.request<TResponse>({
      ...options,
      method: 'POST',
      path
    });
  }

  async delete<TResponse extends ApiEnvelope<unknown>>(
    path: string,
    options: Omit<ApiRequestOptions, 'method' | 'path'> = {}
  ): Promise<TResponse> {
    return this.request<TResponse>({
      ...options,
      method: 'DELETE',
      path
    });
  }

  async request<TResponse extends ApiEnvelope<unknown>>(
    options: ApiRequestOptions
  ): Promise<TResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    try {
      const response = await this.fetchFn(this.buildUrl(options), {
        method: options.method ?? 'GET',
        headers: this.buildHeaders(options.body),
        ...(options.body === undefined
          ? {}
          : {
              body: JSON.stringify(options.body)
            }),
        signal: controller.signal
      });

      const payload = await response.json();
      if (!isApiEnvelope(payload)) {
        throw new CliError(
          'The MyAccount API returned an unexpected response shape.',
          {
            code: 'INVALID_API_RESPONSE',
            details: [`Path: ${options.path}`],
            exitCode: EXIT_CODES.network,
            suggestion:
              'Retry the command and inspect the API response if the issue persists.'
          }
        );
      }

      if (!response.ok || payload.code >= 400) {
        throw new CliError(`MyAccount API request failed: ${payload.message}`, {
          code: 'API_REQUEST_FAILED',
          details: [
            `HTTP status: ${response.status} ${response.statusText}`,
            `API code: ${payload.code}`,
            `Path: ${options.path}`,
            `Errors: ${JSON.stringify(payload.errors)}`
          ],
          exitCode:
            response.status === 401 || response.status === 403
              ? EXIT_CODES.auth
              : EXIT_CODES.network,
          suggestion:
            response.status === 401 || response.status === 403
              ? 'Verify the saved token and API key, then run the command again.'
              : 'Check the request inputs and try again.'
        });
      }

      return payload as TResponse;
    } catch (error: unknown) {
      if (error instanceof CliError) {
        throw error;
      }

      if (isAbortError(error)) {
        throw new CliError('The MyAccount API request timed out.', {
          code: 'API_TIMEOUT',
          details: [
            `Timed out after ${this.timeoutMs}ms`,
            `Base URL: ${this.baseUrl}`
          ],
          exitCode: EXIT_CODES.network,
          suggestion:
            'Retry the command. If the timeout persists, check network connectivity or raise the timeout in a future revision.'
        });
      }

      if (error instanceof Error) {
        throw new CliError(
          'The MyAccount API request could not be completed.',
          {
            code: 'API_NETWORK_ERROR',
            cause: error,
            details: [`Reason: ${error.message}`, `Base URL: ${this.baseUrl}`],
            exitCode: EXIT_CODES.network,
            suggestion:
              'Check network access and API availability, then retry the command.'
          }
        );
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildHeaders(body: unknown): Record<string, string> {
    return {
      Authorization: `Bearer ${this.credentials.auth_token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
    };
  }

  private buildUrl(options: ApiRequestOptions): string {
    const url = new URL(normalizePath(options.path), this.baseUrl);
    url.searchParams.set('apikey', this.credentials.api_key);

    if (options.includeProjectContext ?? true) {
      if (
        this.credentials.project_id === undefined ||
        this.credentials.location === undefined
      ) {
        throw new CliError(
          'MyAccount project context is required for this request.',
          {
            code: 'MISSING_REQUEST_CONTEXT',
            details: [`Path: ${options.path}`],
            exitCode: EXIT_CODES.config,
            suggestion:
              'Pass --project-id and --location, set E2E_PROJECT_ID and E2E_LOCATION, or save default project/location values on the selected profile.'
          }
        );
      }

      url.searchParams.set('project_id', this.credentials.project_id);
      url.searchParams.set('location', this.credentials.location);
    }

    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) {
        url.searchParams.set(key, value);
      }
    }

    return url.toString();
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

function normalizePath(path: string): string {
  return path.startsWith('/') ? path.slice(1) : path;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isApiEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  return (
    isRecord(value) &&
    typeof value.code === 'number' &&
    'data' in value &&
    isRecord(value.errors) &&
    typeof value.message === 'string'
  );
}
