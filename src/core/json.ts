export type JsonPrimitive = boolean | null | number | string;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

function isJsonPrimitive(value: unknown): value is JsonPrimitive {
  return (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'string'
  );
}

function isJsonObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeJson(entry));
  }

  if (isJsonObject(value)) {
    const normalizedEntries = Object.keys(value)
      .sort()
      .map((key) => [key, normalizeJson(value[key]!)] as const);

    return Object.fromEntries(normalizedEntries);
  }

  return value;
}

export function toJsonValue(value: unknown): JsonValue {
  if (isJsonPrimitive(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => toJsonValue(entry));
  }

  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, toJsonValue(entry)])
    );
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'function') {
    return '[function]';
  }

  if (typeof value === 'symbol') {
    return value.description ?? 'Symbol';
  }

  return Object.prototype.toString.call(value);
}

export function stableStringify(value: JsonValue, space = 2): string {
  return JSON.stringify(normalizeJson(value), null, space);
}
