import { apiHandler, json, parseBody, parseQuery } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { requireApiUser } from "@/lib/auth/session";
import { listCustomerOrders, placeOrder } from "@/lib/services/customer-orders";
import { customerOrderListSchema, orderCreateSchema } from "@/lib/validation/customer";

/** GET /api/customer/orders?status=&page=&limit= */
export const GET = apiHandler(async (req) => {
  const user = await requireApiUser(["customer"]);
  return json(await listCustomerOrders(user.id, parseQuery(req, customerOrderListSchema)));
});

/** POST /api/customer/orders — place an order (cash on delivery). */
export const POST = apiHandler(async (req) => {
  const user = await requireApiUser(["customer"]);
  await rateLimit(`order:${user.id}`, 20, 60 * 60 * 1000);
  return json(await placeOrder(user, await parseBody(req, orderCreateSchema)), 201);
});
