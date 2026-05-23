import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  FileSpreadsheet,
  FileBarChart,
  CalendarRange,
  Building2,
  DatabaseBackup,
  Menu,
  Moon,
  Sun,
  Search,
  Bell,
} from "lucide-react";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import Iridescence from "@/components/Iridescence";
import { useAppStore } from "@/store";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/suppliers", label: "Supplier Masterlist", icon: Users },
  { to: "/itw-top10k", label: "ITW TOP 10K", icon: FileSpreadsheet },
  { to: "/itw-expanded", label: "ITW Expanded", icon: FileBarChart },
  { to: "/quarterly-reports", label: "Quarterly Reports", icon: CalendarRange },
  { to: "/settings", label: "Company Settings", icon: Building2 },
  { to: "/backup", label: "Backup & Restore", icon: DatabaseBackup },
] as const;

export function AppLayout() {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const settings = useAppStore((s) => s.settings);
  const logs = useAppStore((s) => s.logs);

  useEffect(() => {
    const saved = localStorage.getItem("jhaymarts:theme");
    const isDark = saved === "dark";
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("jhaymarts:theme", next ? "dark" : "light");
  }

  const active = (to: string, end?: boolean) =>
    end ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <div className="relative min-h-screen text-foreground">
      <div className="fixed inset-0 -z-10 opacity-40 dark:opacity-20 pointer-events-none">
        <Iridescence color={dark ? [0.2, 0.45, 0.4] : [0.55, 0.92, 0.82]} speed={0.4} amplitude={0.05} />
      </div>
      <div className="fixed inset-0 -z-10 bg-background/40" />

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:sticky lg:top-0 inset-y-0 left-0 z-40 w-72 transition-transform lg:translate-x-0 h-screen",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="glass-strong m-3 rounded-2xl h-[calc(100vh-1.5rem)] flex flex-col overflow-hidden">
          <div className="px-5 py-5 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl gradient-primary grid place-items-center text-primary-foreground font-bold shadow-elegant">
                JI
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{settings.companyName || "Jhaymarts"}</p>
                <p className="text-[11px] text-muted-foreground">Withholding Tax System</p>
              </div>
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {NAV.map((item) => {
              const Icon = item.icon;
              const isActive = active(item.to, (item as any).end);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                    isActive
                      ? "gradient-primary text-primary-foreground shadow-elegant"
                      : "text-foreground/80 hover:bg-accent/40 hover:text-foreground"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="p-4 border-t border-border/50 text-[11px] text-muted-foreground">
            <p className="font-medium text-foreground">Local Storage Active</p>
            <p className="mt-0.5">Ready for cloud sync</p>
          </div>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-30 bg-background/60 lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Main */}
      <div className="lg:pl-0 min-h-screen flex flex-col">
        <header className="sticky top-0 z-20 px-4 lg:px-6 pt-3">
          <div className="glass rounded-2xl flex items-center gap-3 px-4 py-3">
            <button
              className="lg:hidden p-2 rounded-lg hover:bg-accent/40"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden md:flex items-center gap-2 flex-1 max-w-md">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input
                placeholder="Search suppliers, records..."
                className="bg-transparent w-full outline-none text-sm placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex-1 md:hidden" />
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-accent/40"
              aria-label="Toggle theme"
            >
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <div className="relative">
              <Bell className="w-4 h-4" />
              {logs.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-[10px] text-primary-foreground grid place-items-center">
                  {Math.min(logs.length, 9)}
                </span>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <Toaster richColors position="top-right" />
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">
          <span className="text-gradient">{title}</span>
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function GlassCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("glass-strong rounded-2xl p-5", className)}>{children}</div>
  );
}