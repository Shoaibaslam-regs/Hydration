import "server-only";
import { redirect } from "next/navigation";
import { isShopLocked } from "@/lib/billing/lock";
import { getMyShop, type MyShop } from "@/lib/services/my-shop";
import { requireRole, type SessionUser } from "./session";

/**
 * For shopkeeper pages that need a registered shop: enforces the role, sends
 * shopkeepers without a shop to the registration form, and sends locked shops
 * (plan ended, see isShopLocked) to Billing unless the page allows it.
 */
export async function requireShopkeeperShop(
  currentPath: string,
  { allowLocked = false }: { allowLocked?: boolean } = {},
): Promise<{ user: SessionUser; shop: MyShop }> {
  const user = await requireRole(["shopkeeper"], currentPath);
  const shop = await getMyShop(user.id);
  if (!shop) redirect("/shop/profile");
  if (!allowLocked && isShopLocked(shop)) redirect("/shop/billing?locked=1");
  return { user, shop };
}
