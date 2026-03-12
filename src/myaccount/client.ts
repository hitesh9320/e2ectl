import type {
  NodeActionRequest,
  NodeActionResult,
  NodeCatalogOsData,
  NodeCatalogPlan,
  NodeCatalogQuery,
  NodeCreateRequest,
  NodeCreateResult,
  NodeDeleteResult,
  NodeDetails,
  NodeListResponse
} from '../node/index.js';
import type { ResolvedCredentials } from '../config/index.js';
import { stableStringify, toJsonValue, type JsonValue } from '../core/json.js';
import { CliError, EXIT_CODES } from '../core/errors.js';

const DEFAULT_BASE_URL = 'https://api.e2enetworks.com/myaccount/api/v1';
const DEFAULT_TIMEOUT_MS = 10_000;

export type FetchLike = (
  input: string,
  init?: RequestInit
) => Promise<{
  json(): Promise<unknown>;
  ok: boolean;
  status: number;
  statusText: string;
  text?(): Promise<string>;
}>;

export interface ApiClientOptions {
  baseUrl?: string;
  fetchFn?: FetchLike;
  timeoutMs?: number;
}

export interface ApiEnvelope<TData> {
  code: number;
  data: TData;
  errors: ApiErrorValue;
  message: string;
}

export type ApiErrorValue = JsonValue;

interface ApiResponseMetadata {
  httpStatus: number;
  httpStatusText: string;
  path: string;
}

interface ParsedApiPayload<TData> {
  apiCode: number | undefined;
  data: TData;
  detail: string | undefined;
  errors: ApiErrorValue;
  explicitFailure: boolean;
  extraFields: { [key: string]: JsonValue };
  message: string;
}

type FetchResponse = Awaited<ReturnType<FetchLike>>;

const API_RESPONSE_RESERVED_FIELDS = new Set([
  'code',
  'data',
  'detail',
  'error',
  'error_message',
  'errors',
  'message'
]);

export interface ApiRequestOptions {
  body?: unknown;
  includeProjectContext?: boolean;
  method?: 'DELETE' | 'GET' | 'POST' | 'PUT';
  path: string;
  query?: Record<string, string | undefined>;
}

export interface ApiClientCredentials {
  alias?: string;
  api_key: string;
  auth_token: string;
  location?: string;
  project_id?: string;
  source: ResolvedCredentials['source'];
}

export interface MyAccountClient {
  createNode(body: NodeCreateRequest): Promise<ApiEnvelope<NodeCreateResult>>;
  delete<TData>(
    path: string,
    options?: Omit<ApiRequestOptions, 'method' | 'path'>
  ): Promise<ApiEnvelope<TData>>;
  deleteNode(nodeId: string): Promise<ApiEnvelope<NodeDeleteResult>>;
  get<TData>(
    path: string,
    options?: Omit<ApiRequestOptions, 'method' | 'path'>
  ): Promise<ApiEnvelope<TData>>;
  listNodeCatalogOs(): Promise<ApiEnvelope<NodeCatalogOsData>>;
  listNodeCatalogPlans(
    query: NodeCatalogQuery
  ): Promise<ApiEnvelope<NodeCatalogPlan[]>>;
  getNode(nodeId: string): Promise<ApiEnvelope<NodeDetails>>;
  listNodes(): Promise<NodeListResponse>;
  post<TData>(
    path: string,
    options?: Omit<ApiRequestOptions, 'method' | 'path'>
  ): Promise<ApiEnvelope<TData>>;
  put<TData>(
    path: string,
    options?: Omit<ApiRequestOptions, 'method' | 'path'>
  ): Promise<ApiEnvelope<TData>>;
  runNodeAction(
    nodeId: string,
    body: NodeActionRequest
  ): Promise<ApiEnvelope<NodeActionResult>>;
  request<TData>(options: ApiRequestOptions): Promise<ApiEnvelope<TData>>;
  validateCredentials(): Promise<ApiEnvelope<unknown>>;
}

export class MyAccountApiClient implements MyAccountClient {
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

  async get<TData>(
    path: string,
    options: Omit<ApiRequestOptions, 'method' | 'path'> = {}
  ): Promise<ApiEnvelope<TData>> {
    return this.request<TData>({
      ...options,
      method: 'GET',
      path
    });
  }

  async post<TData>(
    path: string,
    options: Omit<ApiRequestOptions, 'method' | 'path'> = {}
  ): Promise<ApiEnvelope<TData>> {
    return this.request<TData>({
      ...options,
      method: 'POST',
      path
    });
  }

  async delete<TData>(
    path: string,
    options: Omit<ApiRequestOptions, 'method' | 'path'> = {}
  ): Promise<ApiEnvelope<TData>> {
    return this.request<TData>({
      ...options,
      method: 'DELETE',
      path
    });
  }

  async put<TData>(
    path: string,
    options: Omit<ApiRequestOptions, 'method' | 'path'> = {}
  ): Promise<ApiEnvelope<TData>> {
    return this.request<TData>({
      ...options,
      method: 'PUT',
      path
    });
  }

  async createNode(
    body: NodeCreateRequest
  ): Promise<ApiEnvelope<NodeCreateResult>> {
    return this.post<NodeCreateResult>('/nodes/', {
      body
    });
  }

  async deleteNode(nodeId: string): Promise<ApiEnvelope<NodeDeleteResult>> {
    return this.delete<NodeDeleteResult>(`/nodes/${nodeId}/`);
  }

  async validateCredentials(): Promise<ApiEnvelope<unknown>> {
    return this.get('/iam/multi-crn/', {
      includeProjectContext: false
    });
  }

  async listNodeCatalogOs(): Promise<ApiEnvelope<NodeCatalogOsData>> {
    return this.get<NodeCatalogOsData>('/images/os-category/');
  }

  async listNodeCatalogPlans(
    query: NodeCatalogQuery
  ): Promise<ApiEnvelope<NodeCatalogPlan[]>> {
    return this.get<NodeCatalogPlan[]>('/images/', {
      query
    });
  }

  async listNodes(): Promise<NodeListResponse> {
    return this.get<NodeListResponse['data']>(
      '/nodes/'
    ) as Promise<NodeListResponse>;
  }

  async getNode(nodeId: string): Promise<ApiEnvelope<NodeDetails>> {
    return this.get<NodeDetails>(`/nodes/${nodeId}/`);
  }

  async runNodeAction(
    nodeId: string,
    body: NodeActionRequest
  ): Promise<ApiEnvelope<NodeActionResult>> {
    return this.put<NodeActionResult>(`/nodes/${nodeId}/actions/`, {
      body
    });
  }

  async request<TData>(
    options: ApiRequestOptions
  ): Promise<ApiEnvelope<TData>> {
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
      const metadata: ApiResponseMetadata = {
        httpStatus: response.status,
        httpStatusText: response.statusText,
        path: options.path
      };
      const rawPayload = await readResponseBody(response);
      const payload = normalizeApiPayload<TData>(rawPayload, metadata);

      if (isApiFailure(payload, response.ok, metadata)) {
        throw buildApiRequestFailedError(payload, metadata);
      }

      if (isUnexpectedApiSuccessPayload(rawPayload, response.ok, metadata)) {
        throw buildUnexpectedApiResponseError(metadata, rawPayload);
      }

      return {
        code: payload.apiCode ?? metadata.httpStatus,
        data: payload.data,
        errors: payload.errors,
        message: payload.message
      };
    } catch (error: unknown) {
      if (error instanceof CliError) {
        throw error;
      }

      if (error instanceof InvalidApiResponseBodyError) {
        throw buildInvalidApiResponseError(
          {
            httpStatus: error.httpStatus,
            httpStatusText: error.httpStatusText,
            path: options.path
          },
          error.rawText
        );
      }

      if (isAbortError(error)) {
        throw new CliError('The MyAccount API request timed out.', {
          code: 'API_TIMEOUT',
          details: [
            `Timed out after ${this.timeoutMs}ms`,
            `Base URL: ${this.baseUrl}`,
            `Path: ${options.path}`
          ],
          exitCode: EXIT_CODES.network,
          metadata: {
            api: {
              base_url: this.baseUrl,
              path: options.path,
              timeout_ms: this.timeoutMs
            }
          },
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
            details: [
              `Reason: ${error.message}`,
              `Base URL: ${this.baseUrl}`,
              `Path: ${options.path}`
            ],
            exitCode: EXIT_CODES.network,
            metadata: {
              api: {
                base_url: this.baseUrl,
                path: options.path,
                reason: error.message
              }
            },
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

async function readResponseBody(response: FetchResponse): Promise<unknown> {
  if (typeof response.text === 'function') {
    const rawText = await response.text();
    if (rawText.trim().length === 0) {
      return null;
    }

    try {
      return JSON.parse(rawText) as unknown;
    } catch (error: unknown) {
      throw new InvalidApiResponseBodyError(
        response.status,
        response.statusText,
        rawText,
        error
      );
    }
  }

  try {
    return await response.json();
  } catch (error: unknown) {
    throw new InvalidApiResponseBodyError(
      response.status,
      response.statusText,
      undefined,
      error
    );
  }
}

function normalizeApiPayload<TData>(
  payload: unknown,
  metadata: ApiResponseMetadata
): ParsedApiPayload<TData> {
  if (!isRecord(payload)) {
    return {
      apiCode: undefined,
      data: buildFallbackData<TData>(payload),
      detail: undefined,
      errors: null,
      explicitFailure: false,
      extraFields: {},
      message: defaultApiMessage(metadata)
    };
  }

  const apiCode =
    parseApiCode(payload.code) ?? parseApiCode(payload.status_code);
  const detail = readString(payload.detail);
  const errors = extractApiErrors(payload, detail);

  return {
    apiCode,
    data: extractApiData<TData>(payload, metadata, apiCode),
    detail,
    errors,
    explicitFailure: hasExplicitFailureFlag(payload),
    extraFields: extractApiExtraFields(payload),
    message:
      firstDefinedString(
        readString(payload.message),
        detail,
        readString(payload.error_message),
        readString(payload.error)
      ) ?? defaultApiMessage(metadata)
  };
}

function extractApiData<TData>(
  payload: Record<string, unknown>,
  metadata: ApiResponseMetadata,
  apiCode: number | undefined
): TData {
  if ('data' in payload) {
    return payload.data as TData;
  }

  if (
    metadata.httpStatus >= 200 &&
    metadata.httpStatus < 300 &&
    apiCode === undefined &&
    !looksLikeDirectErrorPayload(payload)
  ) {
    return payload as TData;
  }

  return {} as TData;
}

function buildFallbackData<TData>(payload: unknown): TData {
  if (payload === null) {
    return {} as TData;
  }

  return payload as TData;
}

function isApiFailure<TData>(
  payload: ParsedApiPayload<TData>,
  responseOk: boolean,
  metadata: ApiResponseMetadata
): boolean {
  const effectiveCode = payload.apiCode ?? metadata.httpStatus;
  return (
    !responseOk ||
    effectiveCode >= 400 ||
    payload.explicitFailure ||
    hasMeaningfulApiValue(payload.errors)
  );
}

function buildApiRequestFailedError<TData>(
  payload: ParsedApiPayload<TData>,
  metadata: ApiResponseMetadata
): CliError {
  const effectiveCode = payload.apiCode ?? metadata.httpStatus;
  const summary =
    firstDefinedString(payload.detail, payload.message) ??
    `${metadata.httpStatus} ${metadata.httpStatusText}`.trim();
  const details = [
    `HTTP status: ${metadata.httpStatus} ${metadata.httpStatusText}`.trim(),
    ...(payload.apiCode === undefined ? [] : [`API code: ${payload.apiCode}`]),
    ...(payload.message === summary ? [] : [`API message: ${payload.message}`]),
    ...(payload.detail === undefined ? [] : [`API detail: ${payload.detail}`]),
    ...formatOptionalApiValue('API errors', payload.errors),
    ...formatOptionalApiValue('API data', payload.data),
    ...formatOptionalApiValue('API fields', payload.extraFields),
    `Path: ${metadata.path}`
  ];

  return new CliError(`MyAccount API request failed: ${summary}`, {
    code: 'API_REQUEST_FAILED',
    details,
    exitCode: resolveApiExitCode(metadata.httpStatus, effectiveCode),
    metadata: {
      api: {
        code: payload.apiCode ?? null,
        data: toJsonValue(payload.data),
        detail: payload.detail ?? null,
        errors: payload.errors,
        fields: payload.extraFields,
        http_status: metadata.httpStatus,
        http_status_text: metadata.httpStatusText,
        message: payload.message,
        path: metadata.path
      }
    },
    suggestion: buildApiSuggestion(metadata.httpStatus, effectiveCode)
  });
}

function buildInvalidApiResponseError(
  metadata: ApiResponseMetadata,
  rawText: string | undefined
): CliError {
  return new CliError(
    'The MyAccount API returned a non-JSON or malformed response.',
    {
      code: 'INVALID_API_RESPONSE',
      details: [
        `HTTP status: ${metadata.httpStatus} ${metadata.httpStatusText}`.trim(),
        `Path: ${metadata.path}`,
        ...(rawText === undefined
          ? []
          : [`Response body: ${previewResponseBody(rawText)}`])
      ],
      exitCode: resolveApiExitCode(metadata.httpStatus),
      metadata: {
        api: {
          code: null,
          data: null,
          detail: null,
          errors: null,
          fields: {},
          http_status: metadata.httpStatus,
          http_status_text: metadata.httpStatusText,
          message: null,
          path: metadata.path,
          response_body_preview:
            rawText === undefined ? null : previewResponseBody(rawText)
        }
      },
      suggestion: buildApiSuggestion(metadata.httpStatus)
    }
  );
}

function buildUnexpectedApiResponseError(
  metadata: ApiResponseMetadata,
  payload: unknown
): CliError {
  return new CliError(
    'The MyAccount API returned an unexpected response shape.',
    {
      code: 'INVALID_API_RESPONSE',
      details: [
        `HTTP status: ${metadata.httpStatus} ${metadata.httpStatusText}`.trim(),
        `Path: ${metadata.path}`,
        ...formatOptionalApiValue('Response fields', payload)
      ],
      exitCode: resolveApiExitCode(metadata.httpStatus),
      metadata: {
        api: {
          code: null,
          data: toJsonValue(payload),
          detail: null,
          errors: null,
          fields: {},
          http_status: metadata.httpStatus,
          http_status_text: metadata.httpStatusText,
          message: null,
          path: metadata.path
        }
      },
      suggestion:
        'Retry the command. If the API keeps returning this shape, capture the response details and update the client parser.'
    }
  );
}

function resolveApiExitCode(
  httpStatus: number,
  apiCode?: number
): (typeof EXIT_CODES)[keyof typeof EXIT_CODES] {
  return httpStatus === 401 ||
    httpStatus === 403 ||
    apiCode === 401 ||
    apiCode === 403
    ? EXIT_CODES.auth
    : EXIT_CODES.network;
}

function buildApiSuggestion(httpStatus: number, apiCode?: number): string {
  if (
    httpStatus === 401 ||
    httpStatus === 403 ||
    apiCode === 401 ||
    apiCode === 403
  ) {
    return 'Verify the saved token and API key, then run the command again.';
  }

  if ((apiCode ?? httpStatus) >= 500) {
    return 'Retry the command. If the API keeps failing, capture the response details and escalate it.';
  }

  return 'Check the request inputs and try again.';
}

function defaultApiMessage(metadata: ApiResponseMetadata): string {
  return metadata.httpStatusText.trim().length > 0
    ? metadata.httpStatusText
    : 'Success';
}

function looksLikeDirectErrorPayload(
  payload: Record<string, unknown>
): boolean {
  return (
    'message' in payload ||
    'detail' in payload ||
    'errors' in payload ||
    'error' in payload ||
    'error_message' in payload ||
    hasExplicitFailureFlag(payload)
  );
}

function isUnexpectedApiSuccessPayload(
  payload: unknown,
  responseOk: boolean,
  metadata: ApiResponseMetadata
): boolean {
  return (
    responseOk &&
    metadata.httpStatus >= 200 &&
    metadata.httpStatus < 300 &&
    isRecord(payload) &&
    hasReservedApiField(payload) &&
    !('code' in payload) &&
    !('status_code' in payload) &&
    !('data' in payload) &&
    !hasExplicitFailureFlag(payload)
  );
}

function hasReservedApiField(payload: Record<string, unknown>): boolean {
  return Object.keys(payload).some((key) =>
    API_RESPONSE_RESERVED_FIELDS.has(key)
  );
}

function hasExplicitFailureFlag(payload: Record<string, unknown>): boolean {
  return (
    payload.status === false ||
    payload.success === false ||
    payload.ok === false ||
    payload.errors === true
  );
}

function extractApiErrors(
  payload: Record<string, unknown>,
  detail: string | undefined
): ApiErrorValue {
  if ('errors' in payload) {
    return toJsonValue(payload.errors);
  }

  if (detail !== undefined) {
    return detail;
  }

  if ('error' in payload && payload.error !== undefined) {
    return toJsonValue(payload.error);
  }

  if ('error_message' in payload && payload.error_message !== undefined) {
    return toJsonValue(payload.error_message);
  }

  return null;
}

function extractApiExtraFields(payload: Record<string, unknown>): {
  [key: string]: JsonValue;
} {
  const entries: Array<[string, JsonValue]> = Object.entries(payload)
    .filter(([key]) => !API_RESPONSE_RESERVED_FIELDS.has(key))
    .map(([key, value]): [string, JsonValue] => [key, toJsonValue(value)])
    .filter(([, value]) => value === false || hasMeaningfulApiValue(value));

  return Object.fromEntries(entries);
}

function parseApiCode(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    return Number(value.trim());
  }

  return undefined;
}

function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function firstDefinedString(
  ...values: Array<string | undefined>
): string | undefined {
  return values.find((value) => value !== undefined);
}

function formatOptionalApiValue(label: string, value: unknown): string[] {
  return hasMeaningfulApiValue(value)
    ? [`${label}: ${stableStringify(toJsonValue(value), 0)}`]
    : [];
}

function hasMeaningfulApiValue(value: unknown): boolean {
  if (value === null || value === false || value === undefined) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (isRecord(value)) {
    return Object.keys(value).length > 0;
  }

  return true;
}

function previewResponseBody(body: string): string {
  const normalized = body.replace(/\s+/g, ' ').trim();
  return normalized.length <= 240
    ? normalized
    : `${normalized.slice(0, 237)}...`;
}

class InvalidApiResponseBodyError extends Error {
  override readonly cause: unknown;
  readonly httpStatus: number;
  readonly httpStatusText: string;
  readonly rawText: string | undefined;

  constructor(
    httpStatus: number,
    httpStatusText: string,
    rawText: string | undefined,
    cause: unknown
  ) {
    super('Invalid API response body');
    this.cause = cause;
    this.httpStatus = httpStatus;
    this.httpStatusText = httpStatusText;
    this.rawText = rawText;
  }
}
