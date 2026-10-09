// A labelled input or textarea with an optional hint and the API's error for this field.
// This work made by Anfinogentov Nikita
"use client";
import { useId } from "react";

type Common = { label: string; error?: string; hint?: string };
type InputProps = Common & { multiline?: false } & React.InputHTMLAttributes<HTMLInputElement>;
type AreaProps = Common & { multiline: true } & React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Field(props: InputProps | AreaProps) {
  const id = useId();
  const { label, error, hint, multiline, ...rest } = props;
  const describedBy = [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  const shared = { id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy };
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea className="textarea" {...shared} {...(rest as React.TextareaHTMLAttributes<HTMLTextAreaElement>)} />
      ) : (
        <input className="input" {...shared} {...(rest as React.InputHTMLAttributes<HTMLInputElement>)} />
      )}
      {hint && <p id={`${id}-hint`} className="hint">{hint}</p>}
      {error && <p id={`${id}-error`} className="field-error">{error}</p>}
    </div>
  );
}
