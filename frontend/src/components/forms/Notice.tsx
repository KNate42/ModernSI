// A message box: an error is a butter sticker, a success is a teal tint, plain information is paper. Each has its own small icon.
// This work made by Anfinogentov Nikita
import { Icon, type IconName } from "../Icon";

type Kind = "info" | "ok" | "error";

const icons: Record<Kind, IconName> = { info: "about", ok: "check", error: "alert" };

type Props = { kind?: Kind; role?: "alert" | "status"; ref?: React.Ref<HTMLDivElement>; children: React.ReactNode };

export function Notice({ kind = "info", role, ref, children }: Props) {
  return (
    <div ref={ref} className={`notice notice-${kind}`} role={role}>
      <Icon name={icons[kind]} />
      <div className="notice-body">{children}</div>
    </div>
  );
}
