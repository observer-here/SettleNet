import type { ComponentType } from "react";
import { NavLink } from "react-router-dom";
import {
  IconBriefcase,
  IconClock,
  IconLayout,
  IconList,
  IconUsers,
} from "@/components/ui/Icons";

const items: {
  to: string;
  label: string;
  end?: boolean;
  Icon: ComponentType<{ size?: number; className?: string }>;
}[] = [
  { to: "/", label: "Home", end: true, Icon: IconLayout },
  { to: "/jobs", label: "Jobs", Icon: IconBriefcase },
  { to: "/agents", label: "Agents", Icon: IconUsers },
  { to: "/my-jobs", label: "My Jobs", Icon: IconList },
  { to: "/my-activity", label: "Activity", Icon: IconClock },
];

export function MobileNav() {
  return (
    <nav
      className="mobile-nav fixed inset-x-0 bottom-0 z-50 border-t border-[var(--color-line)] bg-[var(--color-panel)]/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "max(2px, env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="flex items-stretch gap-0.5 px-1 py-1">
        {items.map(({ to, label, end, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-0.5 py-1.5 text-[10px] font-semibold leading-none ${
                isActive
                  ? "bg-[rgba(34,197,94,0.12)] text-[var(--color-accent)]"
                  : "text-[var(--color-muted)]"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={18} className={isActive ? "text-[var(--color-accent)]" : "opacity-75"} />
                <span className="truncate">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
