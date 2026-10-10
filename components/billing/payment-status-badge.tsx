import { Badge } from "@/components/ui/badge";
import type { SubscriptionPaymentStatus } from "@/lib/billing/constants";

const LABELS: Record<SubscriptionPaymentStatus, [string, "warning" | "success" | "danger"]> = {
  pending: ["Waiting for review", "warning"],
  approved: ["Approved", "success"],
  rejected: ["Rejected", "danger"],
};

export function PaymentStatusBadge({ status }: { status: SubscriptionPaymentStatus }) {
  const [label, tone] = LABELS[status];
  return <Badge tone={tone}>{label}</Badge>;
}
