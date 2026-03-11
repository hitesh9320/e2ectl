export interface ApiEnvelope<TData> {
  code: number;
  data: TData;
  errors: Record<string, string | string[] | null>;
  message: string;
}
