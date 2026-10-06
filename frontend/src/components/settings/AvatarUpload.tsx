// Profile photo upload. Size is checked here first so a big file does not travel for nothing.
// This work made by Anfinogentov Nikita
"use client";
import { useId, useState } from "react";
import { api } from "@/lib/client-api";
import { ApiError } from "@/lib/errors";
import { useSubmit } from "../forms/useSubmit";

const maxBytes = 2 * 1024 * 1024;

export function AvatarUpload({ userId, hasAvatar, name }: { userId: string; hasAvatar: boolean; name: string }) {
  const id = useId();
  const { pending, error, run, setError } = useSubmit();
  const [preview, setPreview] = useState<string | null>(hasAvatar ? `/api/profiles/${userId}/avatar` : null);

  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > maxBytes) {
      setError(new ApiError(413, "avatar_too_large", "The picture must be 2 MB or smaller."));
      return;
    }
    run(async () => {
      const form = new FormData();
      form.append("file", file);
      await api("/api/profiles/me/avatar", { method: "PUT", form });
      setPreview(URL.createObjectURL(file));
    });
  }

  return (
    <div className="stack">
      <div className="avatar-field">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="avatar avatar-lg" src={preview} alt="" />
        ) : (
          <span className="avatar avatar-lg" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
        )}
        <input id={id} className="sr-only file-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={onChange} disabled={pending} />
        <label className="btn btn-small" htmlFor={id}>{pending ? "Uploading…" : preview ? "Change photo" : "Upload a photo"}</label>
      </div>
      <p className="hint">PNG, JPEG or WebP, up to 2 MB.</p>
      {error && <p className="field-error" role="alert">{error.message}</p>}
    </div>
  );
}
