import "server-only";
import { Types } from "mongoose";
import { Product } from "@/lib/db/models";

/** Put quantities back into a shop's stock (cancelled/rejected orders, failed reservations). */
export async function returnStock(
  shopId: Types.ObjectId | string,
  items: { productId: Types.ObjectId | string; quantity: number }[],
): Promise<void> {
  if (items.length === 0) return;
  await Product.bulkWrite(
    items.map((i) => ({
      updateOne: { filter: { _id: i.productId, shopId }, update: { $inc: { stock: i.quantity } } },
    })),
  );
}
