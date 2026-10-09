import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { isFavorite } from "@/lib/services/favorites";
import { FavoriteButton } from "./favorite-button";

/** Save/unsave for customers; a login link for visitors; nothing for other roles. Reads the session: wrap in <Suspense>. */
export async function ShopFavorite({ shopId, slug }: { shopId: string; slug: string }) {
  const user = await getSessionUser();
  if (!user) {
    return (
      <Link href={`/login?next=/shops/${slug}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
        ♡ Save shop
      </Link>
    );
  }
  if (user.role !== "customer") return null;
  return <FavoriteButton shopId={shopId} initial={await isFavorite(user.id, shopId)} />;
}
