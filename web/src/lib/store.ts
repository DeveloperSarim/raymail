import { create } from "zustand";

/** Which pane the small-screen layout shows. Desktop renders list + reader
 *  together and uses the drawer for folders. */
export type Pane = "threads" | "reader";

export type ComposerMode =
  | { kind: "new" }
  | { kind: "reply"; messageId: string; to: string; subject: string; replyAll: boolean }
  | { kind: "forward"; messageId: string; subject: string };

interface UiState {
  selectedMailboxId: string | null;
  selectedMessageId: string | null;
  mobilePane: Pane;
  drawerOpen: boolean;
  search: string;
  composer: ComposerMode | null;

  selectMailbox: (id: string) => void;
  selectMessage: (id: string | null) => void;
  setDrawer: (open: boolean) => void;
  setSearch: (q: string) => void;
  openComposer: (mode: ComposerMode) => void;
  closeComposer: () => void;
}

export const useUi = create<UiState>((set) => ({
  selectedMailboxId: null,
  selectedMessageId: null,
  mobilePane: "threads",
  drawerOpen: false,
  search: "",
  composer: null,

  selectMailbox: (id) =>
    set({ selectedMailboxId: id, selectedMessageId: null, mobilePane: "threads", drawerOpen: false }),
  selectMessage: (id) => set({ selectedMessageId: id, mobilePane: id ? "reader" : "threads" }),
  setDrawer: (drawerOpen) => set({ drawerOpen }),
  setSearch: (search) => set({ search }),
  openComposer: (composer) => set({ composer }),
  closeComposer: () => set({ composer: null }),
}));
