import { StarCustomerBadge } from "@/components/shops/star-badge";
import { getSessionUser } from "@/lib/auth/session";
import { isStarCustomerOf } from "@/lib/services/star-customers";

/** Tells a customer this shop tagged them as a regular. Reads the session: wrap in <Suspense>. */
export async function StarCustomerNote({ shopId }: { shopId: string }) {
  const user = await getSessionUser();
  if (user?.role !== "customer" || !(await isStarCustomerOf(user.id, shopId))) return null;
  return <StarCustomerBadge label="You're a star customer here" />;
}
