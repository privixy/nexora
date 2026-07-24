import React from "react";
import { NavLink } from "react-router-dom";
import clsx from "clsx";

interface NavItemProps {
  to: string;
  icon: React.ElementType;
  label: string;
  isConnected?: boolean;
}

export const NavItem = ({ to, icon: Icon, label, isConnected }: NavItemProps) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      clsx(
        "relative group mb-2 flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-150",
        isActive
          ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25"
          : "text-muted hover:bg-surface-secondary/80 hover:text-primary",
      )
    }
  >
    {({ isActive }) => (
      <>
        {isActive && (
          <span className="absolute -left-2 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-blue-400" />
        )}
        <div className="relative">
          <Icon size={22} />
          {isConnected && (
            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-elevated" />
          )}
        </div>
        <span className="absolute left-14 top-1/2 -translate-y-1/2 rounded-xl border border-default bg-elevated px-2.5 py-1.5 text-xs text-primary opacity-0 shadow-xl transition-opacity whitespace-nowrap z-30 pointer-events-none group-hover:opacity-100">
          {label}
        </span>
      </>
    )}
  </NavLink>
);
