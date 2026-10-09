import type { Model } from "mongoose";
import { Address } from "./address";
import { AdminAction } from "./admin-action";
import { Order } from "./order";
import { PasswordReset } from "./password-reset";
import { Product } from "./product";
import { RateLimit } from "./rate-limit";
import { Review } from "./review";
import { Shop } from "./shop";
import { User } from "./user";

export { Address, AdminAction, Order, PasswordReset, Product, RateLimit, Review, Shop, User };

/**
 * Every Mongoose model must be registered here so `npm run db:indexes`
 * can sync its indexes (including 2dsphere indexes for geo search).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const models: Model<any>[] = [User, Shop, Product, Order, Address, Review, AdminAction, RateLimit, PasswordReset];
