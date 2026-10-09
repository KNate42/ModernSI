// One error type for every API call, built from the backend's {"error": {code, message, fields}} body.
// This work made by Anfinogentov Nikita

export type FieldError = { field: string; message: string };

export class ApiError extends Error {
  status: number;
  code: string;
  fields: FieldError[];

  constructor(status: number, code: string, message: string, fields: FieldError[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export async function toApiError(response: Response): Promise<ApiError> {
  const body = await response.json().catch(() => null);
  const error = body?.error;
  return new ApiError(
    response.status,
    error?.code ?? "http_error",
    error?.message ?? "Something went wrong. Please try again.",
    error?.fields ?? [],
  );
}
