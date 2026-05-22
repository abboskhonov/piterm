import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { IconX, IconSun, IconMoon, IconDeviceDesktop } from "@tabler/icons-react";
import { useTheme } from "@/components/theme-provider";

type SettingsTab = "appearance";

const tabs: { id: SettingsTab; label: string }[] = [
  { id: "appearance", label: "Appearance" },
];

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [activeTab, setActiveTab] = React.useState<SettingsTab>("appearance");
  const { theme, setTheme } = useTheme();

  const themes = [
    { value: "light", label: "Light", icon: IconSun },
    { value: "dark", label: "Dark", icon: IconMoon },
    { value: "system", label: "System", icon: IconDeviceDesktop },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-xl w-[90vw] p-0 gap-0 overflow-hidden rounded-xl"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <div className="flex max-h-[80vh]">
          {/* Left sidebar */}
          <div className="w-[200px] shrink-0 border-r border-border/40 bg-muted/30 flex flex-col">
            <div className="flex items-center justify-between px-3 py-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Settings
              </span>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "w-full text-left rounded-md px-2.5 py-[7px] text-sm transition-colors",
                    activeTab === tab.id
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Right content */}
          <div className="flex-1 flex flex-col min-w-0 bg-background">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/20">
              <div>
                <h2 className="text-base font-semibold">Appearance</h2>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                aria-label="Close settings"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Theme cards */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Theme</h3>
                <p className="text-xs text-muted-foreground">
                  Choose your preferred color theme.
                </p>

                <div className="flex gap-3">
                  {themes.map(({ value, label, icon: Icon }) => {
                    const isActive = theme === value;
                    return (
                      <button
                        key={value}
                        onClick={() => setTheme(value)}
                        className={cn(
                          "flex flex-col items-center gap-2 rounded-xl border px-8 py-6 text-sm transition-colors min-w-[140px]",
                          isActive
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : "border-border/40 bg-card/40 text-muted-foreground hover:text-foreground hover:bg-accent/50"
                        )}
                      >
                        <Icon className="h-6 w-6" />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Theme row */}
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border/40 bg-card/40 px-4 py-3">
                <div className="flex items-center gap-2">
                  {theme === "light" && <IconSun className="h-4 w-4 text-muted-foreground" />}
                  {theme === "dark" && <IconMoon className="h-4 w-4 text-muted-foreground" />}
                  {theme === "system" && <IconDeviceDesktop className="h-4 w-4 text-muted-foreground" />}
                  <span className="text-sm font-medium">Current Theme</span>
                </div>
                <Select value={theme} onValueChange={setTheme}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">
                      <span className="flex items-center gap-2">
                        <IconSun className="h-4 w-4" />
                        Light
                      </span>
                    </SelectItem>
                    <SelectItem value="dark">
                      <span className="flex items-center gap-2">
                        <IconMoon className="h-4 w-4" />
                        Dark
                      </span>
                    </SelectItem>
                    <SelectItem value="system">
                      <span className="flex items-center gap-2">
                        <IconDeviceDesktop className="h-4 w-4" />
                        System
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
