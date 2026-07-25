import { Outlet } from "react-router-dom";
import { ToastHost } from "@/components/ui/Toast";
import { useIndexedState, useResetIndexed } from "@/hooks/useIndexedState";
import { MobileNav } from "./MobileNav";
import { PullToRefresh } from "./PullToRefresh";
import { ServiceProvider } from "./ServiceUnreachable";
import { Sidebar } from "./Sidebar";

export function AppShell() {
  const { isError, isFetched, isFetching, data } = useIndexedState();
  const resetIndexed = useResetIndexed();
  const down = isFetched && isError && !data && !isFetching;

  return (
    <div className="flex min-h-screen">
      <div className="sticky top-0 hidden h-screen md:block">
        <Sidebar />
      </div>
      <main className="shell-main min-w-0 flex-1 overflow-x-clip px-2 py-2 pb-[56px] md:px-4 md:py-5 md:pb-5 lg:px-5 lg:pr-6">
        <ServiceProvider down={down} retry={() => void resetIndexed()}>
          <Outlet />
        </ServiceProvider>
      </main>
      <PullToRefresh />
      <MobileNav />
      <ToastHost />
    </div>
  );
}
