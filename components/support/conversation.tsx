import { formatDateTime } from "@/lib/catalog";
import type { SupportMessageDTO } from "@/lib/services/support";
import { cn } from "@/lib/utils";

/** Chat-style message list. The viewer's own messages sit on the right. */
export function Conversation({ messages, viewer }: { messages: SupportMessageDTO[]; viewer: "user" | "admin" }) {
  return (
    <ol className="flex flex-col gap-3" aria-label="Messages">
      {messages.map((m, i) => {
        const mine = viewer === "admin" ? m.by === "admin" : m.by !== "admin";
        const team = m.by === "admin";
        return (
          <li key={i} className={cn("flex", mine ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "flex max-w-[85%] flex-col gap-1 rounded-2xl px-4 py-3 sm:max-w-[75%]",
                mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm border border-border bg-card",
              )}
            >
              <span className={cn("flex items-center gap-1.5 text-xs font-semibold", mine ? "opacity-90" : "text-muted-foreground")}>
                {team && <span aria-hidden>💧</span>}
                {m.authorName}
              </span>
              <p className="whitespace-pre-line break-words text-sm">{m.body}</p>
              <time dateTime={m.at} className={cn("text-[11px]", mine ? "opacity-75" : "text-muted-foreground")}>
                {formatDateTime(m.at)}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
