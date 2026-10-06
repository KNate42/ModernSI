// Ends every session of this account, on all devices.
// This work made by Anfinogentov Nikita
"use client";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import { useSubmit } from "../forms/useSubmit";

export function LogoutEverywhere() {
  const router = useRouter();
  const { pending, error, run } = useSubmit();

  function logoutAll() {
    run(async () => {
      await api("/api/auth/logout-all", { method: "POST" });
      router.push("/");
      router.refresh();
    });
  }

  return (
    <div className="stack">
      <button className="btn" type="button" onClick={logoutAll} disabled={pending}>Log out on all devices</button>
      {error && <p className="field-error" role="alert">{error.message}</p>}
    </div>
  );
}
