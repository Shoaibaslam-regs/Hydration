import "server-only";
import { Types } from "mongoose";
import { TIME_ZONE, type ProductType } from "@/lib/catalog";
import { connectDB } from "@/lib/db/connect";
import { Order, Shop, User } from "@/lib/db/models";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/orders/status";

export type DailyPoint = { date: string; deliveredValue: number; orders: number; delivered: number };

type Totals = {
  orders: number;
  delivered: number;
  failed: number;
  /** Minor units. Sum of delivered order totals (gross order value). */
  deliveredValue: number;
  deliveryFees: number;
  itemsSold: number;
};

export type SalesAnalytics = {
  days: number;
  from: string;
  to: string;
  totals: Totals & { avgOrderValue: number };
  previous: { orders: number; deliveredValue: number };
  daily: DailyPoint[];
  byStatus: Record<OrderStatus, number>;
  topProducts: { name: string; type: ProductType; units: number; value: number }[];
};

export type RevenueAnalytics = SalesAnalytics & {
  totals: SalesAnalytics["totals"] & { newCustomers: number; newShops: number };
  topShops: { id: string; name: string; deliveredValue: number; delivered: number }[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

/** The reporting window: the last `days` × 24h up to now, and the same-length window before it. */
export function reportWindow(days: number, now = new Date()) {
  const from = new Date(now.getTime() - days * DAY_MS);
  return { from, to: now, prevFrom: new Date(from.getTime() - days * DAY_MS) };
}

async function orderTotals(scope: Record<string, unknown>, from: Date, to: Date): Promise<Totals> {
  const [t] = await Order.aggregate<Totals>([
    { $match: { ...scope, createdAt: { $gte: from, $lt: to } } },
    {
      $group: {
        _id: null,
        orders: { $sum: 1 },
        delivered: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $in: ["$status", ["rejected", "cancelled"]] }, 1, 0] } },
        deliveredValue: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, "$total", 0] } },
        deliveryFees: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, "$deliveryFee", 0] } },
        itemsSold: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, { $sum: "$items.quantity" }, 0] } },
      },
    },
  ]);
  return t ?? { orders: 0, delivered: 0, failed: 0, deliveredValue: 0, deliveryFees: 0, itemsSold: 0 };
}

/**
 * Order analytics for the last `days` days (by order date, in the app time
 * zone), compared with the preceding period. Pass `shopId` to scope to one
 * shop; omit it for the whole platform. Callers must enforce authorization.
 */
export async function getSalesAnalytics(days: number, shopId?: string): Promise<SalesAnalytics> {
  await connectDB();
  const scope: Record<string, unknown> = shopId ? { shopId: new Types.ObjectId(shopId) } : {};
  const now = new Date();
  const { from, to, prevFrom } = reportWindow(days, now);
  const inRange = { ...scope, createdAt: { $gte: from, $lt: to } };

  const [totals, previous, dailyRows, statusRows, productRows] = await Promise.all([
    orderTotals(scope, from, to),
    orderTotals(scope, prevFrom, from),
    Order.aggregate<{ _id: string; orders: number; delivered: number; deliveredValue: number }>([
      { $match: inRange },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: TIME_ZONE } },
          orders: { $sum: 1 },
          delivered: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] } },
          deliveredValue: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, "$total", 0] } },
        },
      },
    ]),
    Order.aggregate<{ _id: OrderStatus; n: number }>([{ $match: inRange }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    Order.aggregate<{ _id: { name: string; type: ProductType }; units: number; value: number }>([
      { $match: { ...inRange, status: "delivered" } },
      { $unwind: "$items" },
      // Group by snapshot name+type so renamed/deleted products still report.
      { $group: { _id: { name: "$items.name", type: "$items.type" }, units: { $sum: "$items.quantity" }, value: { $sum: "$items.lineTotal" } } },
      { $sort: { value: -1, units: -1 } },
      { $limit: 5 },
    ]),
  ]);

  // One point per calendar day, including days with no orders.
  const byDay = new Map(dailyRows.map((r) => [r._id, r]));
  const daily: DailyPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = dayKey.format(new Date(now.getTime() - i * DAY_MS));
    if (daily.at(-1)?.date === key) continue;
    const r = byDay.get(key);
    daily.push({ date: key, orders: r?.orders ?? 0, delivered: r?.delivered ?? 0, deliveredValue: r?.deliveredValue ?? 0 });
  }

  const byStatus = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<OrderStatus, number>;
  for (const r of statusRows) if (r._id in byStatus) byStatus[r._id] = r.n;

  return {
    days,
    from: from.toISOString(),
    to: to.toISOString(),
    totals: { ...totals, avgOrderValue: totals.delivered ? Math.round(totals.deliveredValue / totals.delivered) : 0 },
    previous: { orders: previous.orders, deliveredValue: previous.deliveredValue },
    daily,
    byStatus,
    topProducts: productRows.map((r) => ({ name: r._id.name, type: r._id.type, units: r.units, value: r.value })),
  };
}

/** Platform-wide analytics for admins: sales plus growth and top shops. */
export async function getRevenueAnalytics(days: number): Promise<RevenueAnalytics> {
  const sales = await getSalesAnalytics(days);
  const { from, to } = reportWindow(days, new Date(sales.to));
  const [topRows, newCustomers, newShops] = await Promise.all([
    Order.aggregate<{ _id: Types.ObjectId; deliveredValue: number; delivered: number }>([
      { $match: { createdAt: { $gte: from, $lt: to }, status: "delivered" } },
      { $group: { _id: "$shopId", deliveredValue: { $sum: "$total" }, delivered: { $sum: 1 } } },
      { $sort: { deliveredValue: -1 } },
      { $limit: 5 },
    ]),
    User.countDocuments({ role: "customer", createdAt: { $gte: from, $lt: to } }),
    Shop.countDocuments({ createdAt: { $gte: from, $lt: to } }),
  ]);
  const shops = await Shop.find({ _id: { $in: topRows.map((r) => r._id) } }, { name: 1 }).lean();
  const names = new Map(shops.map((s) => [s._id.toString(), s.name]));
  return {
    ...sales,
    totals: { ...sales.totals, newCustomers, newShops },
    topShops: topRows.map((r) => ({
      id: r._id.toString(),
      name: names.get(r._id.toString()) ?? "Deleted shop",
      deliveredValue: r.deliveredValue,
      delivered: r.delivered,
    })),
  };
}
