import type { Model } from "mongoose";
import { Address } from "./address";
import { AdStat, Banner, BannerImage, Deal, SponsoredCampaign } from "./ads";
import { AdminAction } from "./admin-action";
import { Order } from "./order";
import { PasswordReset } from "./password-reset";
import { PlatformSettings } from "./platform-settings";
import { RateLimit } from "./rate-limit";
import { Review } from "./review";
import { Shop } from "./shop";
import { StarCustomer } from "./star-customer";
import { SubscriptionPayment } from "./subscription-payment";
import { SupportThread } from "./support";
import { User } from "./user";

export { Address, AdStat, Banner, BannerImage, Deal, SponsoredCampaign, AdminAction, Order, PasswordReset, PlatformSettings, RateLimit, Review, Shop, StarCustomer, SubscriptionPayment, SupportThread, User };

/**
 * Every Mongoose model must be registered here so `npm run db:indexes`
 * can sync its indexes (including 2dsphere indexes for geo search).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const models: Model<any>[] = [User, Shop, Order, Address, Review, AdminAction, RateLimit, PasswordReset, SubscriptionPayment, PlatformSettings, SponsoredCampaign, Deal, Banner, BannerImage, AdStat, SupportThread, StarCustomer];
