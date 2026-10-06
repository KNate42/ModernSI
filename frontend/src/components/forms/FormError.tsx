// The form-level error notice. Field errors are shown next to their fields as well.
// This work made by Anfinogentov Nikita
import type { ApiError } from "@/lib/errors";

export function FormError({ error }: { error: ApiError | null }) {
  if (!error) return null;
  return (
    <div className="notice notice-error" role="alert">
      {error.fields.length ? "Some fields need fixing — see the notes below them." : error.message}
    </div>
  );
}
