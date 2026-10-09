import "server-only";
import { Types } from "mongoose";
import { fromMinorUnits, TIME_ZONE } from "@/lib/catalog";
import { connectDB } from "@/lib/db/connect";
import { Order, Shop } from "@/lib/db/models";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/orders/status";
import { toCsv } from "@/lib/reports/csv";
import { reportWindow } from "./analytics";

/** Exports are capped so one request can't pull an unbounded result set. */
export const EXPORT_ROW_LIMIT = 10_000;

const timestamp = new Intl.DateTimeFormat("sv-SE", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

type ExportRow = {
  orderNumber: string;
  createdAt: Date;
  status: string;
  shopName: string;
  contactName: string;
  contactPhone: string;
  area: string;
  city: string;
  items: string;
  itemCount: number;
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentStatus: string;
};

/**
 * Orders placed in the last `days` days as CSV, newest first. Scope to one shop
 * with `shopId`; callers must enforce authorization. Amounts are in major units.
 */
export async function exportOrdersCsv(days: number, shopId?: string): Promise<{ csv: string; rows: number; truncated: boolean }> {
  await connectDB();
  const { from, to } = reportWindow(days);
  const filter: Record<string, unknown> = { createdAt: { $gte: from, $lt: to } };
  if (shopId) filter.shopId = new Types.ObjectId(shopId);

  const orders = await Order.find(filter, { statusHistory: 0 })
    .sort({ createdAt: -1 })
    .limit(EXPORT_ROW_LIMIT + 1)
    .lean();
  const truncated = orders.length > EXPORT_ROW_LIMIT;
  const rows = orders.slice(0, EXPORT_ROW_LIMIT);

  const shops = await Shop.find({ _id: { $in: [...new Set(rows.map((o) => o.shopId.toString()))] } }, { name: 1 }).lean();
  const shopNames = new Map(shops.map((s) => [s._id.toString(), s.name]));

  const data: ExportRow[] = rows.map((o) => ({
    orderNumber: o.orderNumber,
    createdAt: o.createdAt,
    status: ORDER_STATUS_LABELS[o.status as OrderStatus] ?? o.status,
    shopName: shopNames.get(o.shopId.toString()) ?? "Deleted shop",
    contactName: o.contactName,
    contactPhone: o.contactPhone,
    area: o.deliveryAddress.area ?? "",
    city: o.deliveryAddress.city,
    items: o.items.map((i) => `${i.quantity} x ${i.name}`).join("; "),
    itemCount: o.items.reduce((n, i) => n + i.quantity, 0),
    subtotal: o.subtotal,
    deliveryFee: o.deliveryFee,
    total: o.total,
    paymentStatus: o.payment?.status ?? "",
  }));

  const csv = toCsv(data, [
    { header: "Order number", value: (r) => r.orderNumber },
    { header: `Placed (${TIME_ZONE})`, value: (r) => timestamp.format(r.createdAt) },
    { header: "Status", value: (r) => r.status },
    ...(shopId ? [] : [{ header: "Shop", value: (r: ExportRow) => r.shopName }]),
    { header: "Customer", value: (r) => r.contactName },
    { header: "Phone", value: (r) => r.contactPhone },
    { header: "Area", value: (r) => r.area },
    { header: "City", value: (r) => r.city },
    { header: "Items", value: (r) => r.items },
    { header: "Units", value: (r) => r.itemCount },
    { header: "Subtotal", value: (r) => fromMinorUnits(r.subtotal) },
    { header: "Delivery fee", value: (r) => fromMinorUnits(r.deliveryFee) },
    { header: "Total", value: (r) => fromMinorUnits(r.total) },
    { header: "Payment", value: (r) => r.paymentStatus },
  ]);
  return { csv, rows: rows.length, truncated };
}

export function csvResponse(csv: string, filename: string, truncated: boolean): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      ...(truncated ? { "X-Export-Truncated": `true; limit=${EXPORT_ROW_LIMIT}` } : {}),
    },
  });
}
