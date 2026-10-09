import "server-only";
import { redirect } from "next/navigation";
import { getMyShop, type MyShop } from "@/lib/services/my-shop";
import { requireRole, type SessionUser } from "./session";

/**
 * For shopkeeper pages that need a registered shop: enforces the role and
 * sends shopkeepers without a shop to the registration form.
 */
export async function requireShopkeeperShop(currentPath: string): Promise<{ user: SessionUser; shop: MyShop }> {
  const user = await requireRole(["shopkeeper"], currentPath);
  const shop = await getMyShop(user.id);
  if (!shop) redirect("/shop/profile");
  return { user, shop };
}
