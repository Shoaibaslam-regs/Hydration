import "server-only";
import { Types } from "mongoose";
import { ApiError } from "@/lib/api/errors";
import { connectDB } from "@/lib/db/connect";
import { Address } from "@/lib/db/models";
import { MAX_ADDRESSES_PER_USER } from "@/lib/db/models/address";
import type { AddressInput } from "@/lib/validation/customer";

export type SavedAddress = {
  id: string;
  label: string;
  line1: string;
  area: string;
  city: string;
  notes: string;
  location: { lat: number; lng: number };
  isDefault: boolean;
};

type AddressLean = {
  _id: Types.ObjectId;
  label: string;
  line1: string;
  area?: string | null;
  city: string;
  notes?: string | null;
  location: { coordinates: number[] };
  isDefault?: boolean | null;
};

function toSaved(a: AddressLean): SavedAddress {
  const [lng, lat] = a.location.coordinates;
  return {
    id: a._id.toString(),
    label: a.label,
    line1: a.line1,
    area: a.area ?? "",
    city: a.city,
    notes: a.notes ?? "",
    location: { lat, lng },
    isDefault: a.isDefault ?? false,
  };
}

function toFields(input: AddressInput) {
  return {
    label: input.label,
    line1: input.line1,
    area: input.area,
    city: input.city,
    notes: input.notes,
    location: { type: "Point" as const, coordinates: [input.location.lng, input.location.lat] },
  };
}

/** Make `addressId` the only default address for the user. */
async function makeDefault(userId: Types.ObjectId, addressId: Types.ObjectId) {
  await Address.updateMany({ userId, _id: { $ne: addressId }, isDefault: true }, { $set: { isDefault: false } });
  await Address.updateOne({ _id: addressId, userId }, { $set: { isDefault: true } });
}

export async function listAddresses(userId: string): Promise<SavedAddress[]> {
  await connectDB();
  const rows = await Address.find({ userId: new Types.ObjectId(userId) }).sort({ isDefault: -1, createdAt: 1 }).lean();
  return rows.map((a) => toSaved(a as unknown as AddressLean));
}

export async function getAddress(userId: string, addressId: string): Promise<SavedAddress | null> {
  if (!Types.ObjectId.isValid(addressId)) return null;
  await connectDB();
  const a = await Address.findOne({ _id: addressId, userId: new Types.ObjectId(userId) }).lean();
  return a ? toSaved(a as unknown as AddressLean) : null;
}

export async function createAddress(userId: string, input: AddressInput): Promise<SavedAddress> {
  await connectDB();
  const uid = new Types.ObjectId(userId);
  const count = await Address.countDocuments({ userId: uid });
  if (count >= MAX_ADDRESSES_PER_USER) {
    throw ApiError.conflict(`You can save up to ${MAX_ADDRESSES_PER_USER} addresses. Delete one first.`);
  }
  const doc = await Address.create({ ...toFields(input), userId: uid, isDefault: false });
  // The first address is always the default.
  if (input.isDefault || count === 0) await makeDefault(uid, doc._id);
  return (await getAddress(userId, doc._id.toString()))!;
}

export async function updateAddress(userId: string, addressId: string, input: AddressInput): Promise<SavedAddress> {
  await connectDB();
  const uid = new Types.ObjectId(userId);
  const res = await Address.updateOne({ _id: addressId, userId: uid }, { $set: toFields(input) }, { runValidators: true });
  if (res.matchedCount === 0) throw ApiError.notFound("Address not found");
  if (input.isDefault) await makeDefault(uid, new Types.ObjectId(addressId));
  return (await getAddress(userId, addressId))!;
}

export async function deleteAddress(userId: string, addressId: string): Promise<void> {
  await connectDB();
  const uid = new Types.ObjectId(userId);
  const removed = await Address.findOneAndDelete({ _id: addressId, userId: uid }).lean();
  if (!removed) throw ApiError.notFound("Address not found");
  if (removed.isDefault) {
    const next = await Address.findOne({ userId: uid }).sort({ createdAt: 1 }).lean();
    if (next) await makeDefault(uid, next._id);
  }
}
