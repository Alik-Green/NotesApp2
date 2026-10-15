import { create } from 'zustand';
import type { Notebook, Page, Tool } from './lib/types';
import { CommandStack, type Command, type Doc } from './lib/commands';

export interface ToolSettings { color: string; size: number }
interface State {
  view: 'library' | 'editor';
  notebooks: (Notebook & { pageIds: string[] })[];
  current: (Notebook & { pageIds: string[] }) | null;
  pages: Page[];
  stack: CommandStack;
  version: number;
  tool: Tool;
  prevTool: Tool;
  settings: Record<'pen' | 'highlighter' | 'eraser', ToolSettings>;
  zoom: number;
  palmRejection: boolean;
  barrelAction: 'eraser' | 'pan';
  dark: boolean;
  setTool: (t: Tool) => void;
  setSetting: (tool: 'pen' | 'highlighter' | 'eraser', patch: Partial<ToolSettings>) => void;
  setZoom: (z: number) => void;
  setPalm: (v: boolean) => void;
  openNotebook: (nb: Notebook & { pageIds: string[] }, pages: Page[], stack: CommandStack) => void;
  backToLibrary: (list: (Notebook & { pageIds: string[] })[]) => void;
  setNotebooks: (n: (Notebook & { pageIds: string[] })[]) => void;
  execute: (cmd: Command) => void;
  pushApplied: (cmd: Command) => void;
  undo: () => void;
  redo: () => void;
  bump: () => void;
}
const docOf = (s: State): Doc => ({ pages: s.pages });
export const useStore = create<State>((set, get) => ({
  view: 'library', notebooks: [], current: null, pages: [], stack: new CommandStack(200), version: 0,
  tool: 'pen', prevTool: 'pen',
  settings: { pen: { color: '#111827', size: 4 }, highlighter: { color: '#facc15', size: 22 }, eraser: { color: '#000000', size: 18 } },
  zoom: 1, palmRejection: true, barrelAction: 'eraser',
  dark: typeof window !== 'undefined' ? window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false : false,
  setTool: (t) => set({ tool: t }),
  setSetting: (tool, patch) => set((s) => ({ settings: { ...s.settings, [tool]: { ...s.settings[tool], ...patch } } })),
  setZoom: (z) => set({ zoom: Math.min(4, Math.max(0.25, z)) }),
  setPalm: (v) => set({ palmRejection: v }),
  openNotebook: (nb, pages, stack) => set({ view: 'editor', current: nb, pages, stack, version: 0 }),
  backToLibrary: (list) => set({ view: 'library', notebooks: list, current: null, pages: [] }),
  setNotebooks: (n) => set({ notebooks: n }),
  execute: (cmd) => { const s = get(); const doc = docOf(s); s.stack.execute(doc, cmd); set({ pages: [...doc.pages], version: s.version + 1 }); },
  pushApplied: (cmd) => { const s = get(); s.stack.pushApplied(cmd); set({ version: s.version + 1 }); },
  undo: () => { const s = get(); const doc = docOf(s); if (s.stack.undo(doc)) set({ pages: [...doc.pages], version: s.version + 1 }); },
  redo: () => { const s = get(); const doc = docOf(s); if (s.stack.redo(doc)) set({ pages: [...doc.pages], version: s.version + 1 }); },
  bump: () => set((s) => ({ version: s.version + 1 }))
}));
