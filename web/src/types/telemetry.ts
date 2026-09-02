/** Delivery lifecycle. Ordered — a message only ever moves forward through
 *  this list, except `bounced`, which is terminal from any prior stage. */
export const DELIVERY_STAGES = [
  "queued", "sent", "delivered", "opened", "clicked",
] as const;

export type DeliveryStage = (typeof DELIVERY_STAGES)[number] | "bounced";

export interface TrackedMessage {
  id: string;
  messageId: string | null;
  recipient: string;
  subject: string;
  sentAt: string;
  stage: DeliveryStage;
  openCount: number;
  clickCount: number;
  firstOpenedAt: string | null;
  lastEventAt: string | null;
  bounceReason: string | null;
}

export type TelemetryEventType = "open" | "click" | "delivered" | "bounced";

export interface TelemetryEvent {
  id: number;
  trackedId: string;
  type: TelemetryEventType;
  occurredAt: string;
  ip: string | null;
  userAgent: string | null;
  /** Populated for click events only. */
  targetUrl: string | null;
}

export interface TelemetrySummary {
  totalSent: number;
  delivered: number;
  bounced: number;
  uniqueOpens: number;
  totalOpens: number;
  uniqueClicks: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
}
