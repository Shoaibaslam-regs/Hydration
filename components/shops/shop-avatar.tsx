import { cn } from "@/lib/utils";

/** Up to two initials from a shop name ("Blue Spring Water" → "BS"). */
export function shopInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2)).toUpperCase();
}

/** A round badge with the shop's initials; gold-ringed for sponsored shops. Decorative: the name is always shown next to it. */
export function ShopAvatar({ name, size = "md", premium = false, className }: { name: string; size?: "sm" | "md" | "lg"; premium?: boolean; className?: string }) {
  const sizes = { sm: "size-10 text-sm", md: "size-12 text-base", lg: "size-16 text-xl sm:size-20 sm:text-2xl" };
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-bold",
        premium ? "bg-premium text-premium-foreground ring-4 ring-premium/25" : "bg-primary text-primary-foreground ring-4 ring-primary/15",
        sizes[size],
        className,
      )}
    >
      {shopInitials(name)}
    </span>
  );
}
