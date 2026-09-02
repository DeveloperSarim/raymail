"use client";

import { useEffect, useState } from "react";
import {
  useMailboxes, useMessages, useMessage, useSetKeyword, useMoveMessage, useMe,
} from "@/hooks/useMail";
import { useAiStatus } from "@/hooks/useAi";
import { useUi } from "@/lib/store";
import { TopBar } from "@/components/TopBar";
import { Sidebar } from "@/components/Sidebar";
import { ThreadList } from "@/components/ThreadList";
import { Reader } from "@/components/Reader";
import { Composer } from "@/components/Composer";
import { SignIn } from "@/components/SignIn";
import type { MessageSummary } from "@/types/mail";

export default function Workspace() {
  const { selectedMailboxId, selectedMessageId, selectMailbox, selectMessage, mobilePane } = useUi();
  const me = useMe();
  const mailboxes = useMailboxes();
  const messages = useMessages(selectedMailboxId);
  const message = useMessage(selectedMessageId);
  const setKeyword = useSetKeyword();
  const move = useMoveMessage();
  const ai = useAiStatus();

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [overviewOpen, setOverviewOpen] = useState(false);

  useEffect(() => {
    if (mailboxes.isSuccess) setAuthed(true);
    if (mailboxes.isError) setAuthed(false);
  }, [mailboxes.isSuccess, mailboxes.isError]);

  useEffect(() => {
    if (!selectedMailboxId && mailboxes.data?.length) {
      const inbox = mailboxes.data.find((m) => m.role === "inbox") ?? mailboxes.data[0];
      if (inbox) selectMailbox(inbox.id);
    }
  }, [mailboxes.data, selectedMailboxId, selectMailbox]);

  // Opening an unread message marks it seen, as every mail client does.
  useEffect(() => {
    if (message.data?.isUnread) {
      setKeyword.mutate({ id: message.data.id, keyword: "$seen", value: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.data?.id]);

  if (authed === false) return <SignIn onDone={() => location.reload()} />;
  if (authed === null) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[var(--color-page)]">
        <div className="shimmer h-2 w-40 rounded-full" />
      </div>
    );
  }

  const trash = mailboxes.data?.find((m) => m.role === "trash");
  const aiReady = ai.data?.configured ?? false;

  const remove = (m: MessageSummary | { id: string; mailboxIds: string[] }) => {
    if (!trash) return;
    move.mutate({ id: m.id, from: selectedMailboxId, moveTo: trash.id });
    if (m.id === selectedMessageId) selectMessage(null);
  };

  return (
    <div className="flex h-dvh flex-col bg-[var(--color-page)]">
      <TopBar
        username={me.data?.username ?? ""}
        onRefresh={() => void messages.refetch()}
        refreshing={messages.isFetching}
        aiReady={aiReady}
        overviewOpen={overviewOpen}
        onToggleOverview={() => setOverviewOpen((v) => !v)}
      />

      <div className="flex min-h-0 flex-1">
        <Sidebar mailboxes={mailboxes.data ?? []} loading={mailboxes.isLoading} />

        {/* Split reading pane on wide screens; on anything narrower the reader
            replaces the list, which is what Gmail does on a phone. */}
        <main className="flex min-w-0 flex-1 gap-px pb-2 pr-2">
          <div
            className={`min-w-0 flex-1 xl:max-w-[46%] ${
              mobilePane === "reader" ? "hidden xl:block" : "block"
            }`}
          >
            <ThreadList
              messages={messages.data ?? []}
              loading={messages.isFetching}
              error={messages.error ? (messages.error as Error).message : null}
              mailboxId={selectedMailboxId}
              aiReady={aiReady}
              overviewOpen={overviewOpen}
              onStar={(m) => setKeyword.mutate({ id: m.id, keyword: "$flagged", value: !m.isFlagged })}
              onToggleRead={(m) => setKeyword.mutate({ id: m.id, keyword: "$seen", value: m.isUnread })}
              onDelete={remove}
            />
          </div>

          <div
            className={`min-w-0 flex-1 overflow-hidden rounded-tr-2xl ${
              mobilePane === "reader" ? "block" : "hidden xl:block"
            }`}
          >
            <Reader
              message={message.data ?? null}
              loading={message.isLoading}
              aiReady={aiReady}
              onDelete={() => message.data && remove(message.data)}
            />
          </div>
        </main>
      </div>

      <Composer aiReady={aiReady} />
    </div>
  );
}
