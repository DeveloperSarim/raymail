/** Domain models for the mail workspace. These mirror the JMAP wire shapes we
 *  actually consume — deliberately narrower than the full RFC 8621 surface so
 *  the UI never depends on fields we don't read. */

export interface EmailAddress {
  name?: string;
  email: string;
}

export type MailboxRole =
  | "inbox" | "sent" | "drafts" | "trash" | "junk" | "archive" | null;

export interface Mailbox {
  id: string;
  name: string;
  role: MailboxRole;
  totalEmails: number;
  unreadEmails: number;
  sortOrder: number;
}

export interface Attachment {
  blobId: string;
  name: string;
  type: string;
  size: number;
  /** Inline parts are rendered by the body, not listed as downloads. */
  disposition: "attachment" | "inline";
  cid?: string;
}

/** Envelope-level view used by the thread list. Body is fetched separately. */
export interface MessageSummary {
  id: string;
  threadId: string;
  mailboxIds: string[];
  from: EmailAddress[];
  to: EmailAddress[];
  subject: string;
  preview: string;
  receivedAt: string;
  isUnread: boolean;
  isFlagged: boolean;
  hasAttachment: boolean;
  size: number;
}

export interface MessageBody extends MessageSummary {
  cc: EmailAddress[];
  bcc: EmailAddress[];
  replyTo: EmailAddress[];
  htmlBody: string | null;
  textBody: string | null;
  attachments: Attachment[];
}

export interface Thread {
  id: string;
  emailIds: string[];
  messages: MessageSummary[];
  subject: string;
  participants: EmailAddress[];
  lastReceivedAt: string;
  unreadCount: number;
  hasAttachment: boolean;
}

export interface ComposeDraft {
  to: EmailAddress[];
  cc: EmailAddress[];
  bcc: EmailAddress[];
  subject: string;
  html: string;
  inReplyTo?: string;
  attachments: { name: string; type: string; size: number; blobId: string }[];
  /** Per-message opt-out; telemetry is on by default but always overridable. */
  trackOpens: boolean;
  trackClicks: boolean;
}
