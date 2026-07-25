import { createContext, useContext, type ReactNode } from "react";

type Ctx = { down: boolean; retry: () => void };

const ServiceCtx = createContext<Ctx>({ down: false, retry: () => {} });

export function ServiceProvider({
  down,
  retry,
  children,
}: Ctx & { children: ReactNode }) {
  return <ServiceCtx.Provider value={{ down, retry }}>{children}</ServiceCtx.Provider>;
}

export function useServiceDown() {
  return useContext(ServiceCtx).down;
}

export function ServiceGate({ children }: { children: ReactNode }) {
  const { down, retry } = useContext(ServiceCtx);
  if (!down) return children;
  return (
    <div className="grid min-h-[55vh] place-items-center px-4 py-16 text-center">
      <div className="max-w-sm">
        <p className="text-base font-semibold text-[var(--color-text)]">
          SettleNet services unreachable
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
          Currently SettleNet services are unable. Try again later.
        </p>
        <button
          type="button"
          onClick={retry}
          className="accent-btn mt-5 inline-flex rounded-lg px-4 py-2 text-sm"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
