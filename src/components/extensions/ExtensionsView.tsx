import * as React from "react";
import { cn } from "@/lib/utils";
import {
  IconSearch,
  IconExternalLink,
  IconLoader2,
  IconCheck,
  IconX,
  IconPuzzle,
  IconCopy,
  IconCommand,
  IconChevronDown,
  IconChevronUp,
  IconPackage,
  IconTerminal,
} from "@tabler/icons-react";
import { Input } from "@/components/ui/input";

interface NpmPackage {
  name: string;
  description: string;
  version: string;
  keywords?: string[];
}

interface InstalledExtension {
  name: string;
  version: string;
  description?: string;
  installedAt?: string;
}

export function ExtensionsView() {
  const [query, setQuery] = React.useState("");
  const [packages, setPackages] = React.useState<NpmPackage[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [installingId, setInstallingId] = React.useState<string | null>(null);
  const [installResult, setInstallResult] = React.useState<
    Record<string, "success" | "error">
  >({});
  const [installOutput, setInstallOutput] = React.useState<
    Record<string, { stdout: string; stderr: string }>
  >({});
  const [expandedOutput, setExpandedOutput] = React.useState<string | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [installed, setInstalled] = React.useState<InstalledExtension[]>([]);
  const [installedLoading, setInstalledLoading] = React.useState(true);

  // Load installed extensions on mount
  React.useEffect(() => {
    loadInstalled();
  }, []);

  const loadInstalled = async () => {
    setInstalledLoading(true);
    try {
      const list = await window.electron.getInstalledExtensions();
      setInstalled(list);
    } catch (err) {
      console.error("Failed to load installed extensions:", err);
    } finally {
      setInstalledLoading(false);
    }
  };

  const search = React.useCallback(async (q: string) => {
    setLoading(true);
    try {
      const data = await window.electron.searchExtensions(q);
      setPackages(data.packages ?? []);
    } catch (err) {
      console.error("Failed to search extensions:", err);
      setPackages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  React.useEffect(() => {
    search("pi-extension");
  }, [search]);

  // Debounced search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      search(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  const handleInstall = React.useCallback(async (pkgName: string) => {
    setInstallingId(pkgName);
    setExpandedOutput(pkgName);
    try {
      const result = await window.electron.installExtension(pkgName);
      setInstallResult((prev) => ({
        ...prev,
        [pkgName]: result.success ? "success" : "error",
      }));
      setInstallOutput((prev) => ({
        ...prev,
        [pkgName]: { stdout: result.stdout, stderr: result.stderr },
      }));
      if (result.success) {
        loadInstalled();
      }
    } catch (err) {
      console.error("Install error:", err);
      setInstallResult((prev) => ({ ...prev, [pkgName]: "error" }));
    } finally {
      setInstallingId(null);
    }
  }, []);

  const handleCopy = React.useCallback((pkgName: string) => {
    const command = `pi install npm:${pkgName}`;
    navigator.clipboard.writeText(command).catch(() => {});
    setCopiedId(pkgName);
    setTimeout(() => setCopiedId(null), 1500);
  }, []);

  return (
    <div className="h-full overflow-y-auto no-scrollbar">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Extensions</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Browse and install pi extensions from npm.
            </p>
          </div>
        </div>

        {/* Installed extensions */}
        {installed.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <IconPackage className="h-4 w-4 text-muted-foreground" />
              Installed ({installed.length})
            </h2>
            <div className="flex flex-wrap gap-2">
              {installed.map((ext) => (
                <div
                  key={ext.name}
                  className="inline-flex items-center gap-2 rounded-lg border border-border/40 bg-card/50 px-3 py-2"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{ext.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      v{ext.version}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {installedLoading && installed.length === 0 && (
          <div className="mb-8 flex items-center gap-2 text-sm text-muted-foreground">
            <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
            Scanning installed extensions...
          </div>
        )}

        {/* Search */}
        <div className="relative mb-6">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search extensions..."
            className="pl-9 bg-background/50"
          />
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
            <IconLoader2 className="h-4 w-4 animate-spin" />
            Searching npm registry...
          </div>
        ) : packages.length === 0 ? (
          <div className="rounded-lg border border-border/40 bg-card/50 p-8 text-center">
            <IconPuzzle className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {query ? `No results for "${query}"` : "No extensions found"}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Try searching for different keywords
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {packages.map((pkg) => {
              const isInstalling = installingId === pkg.name;
              const result = installResult[pkg.name];
              const output = installOutput[pkg.name];
              const isExpanded = expandedOutput === pkg.name;
              const isCopied = copiedId === pkg.name;

              return (
                <div
                  key={pkg.name}
                  className="group flex flex-col gap-2 rounded-lg border border-border/40 bg-card/50 p-4 hover:border-border/80 hover:bg-card transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-medium text-sm text-foreground block truncate">
                        {pkg.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground/70">
                        v{pkg.version}
                      </span>
                    </div>
                    {isInstalling ? (
                      <IconLoader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0 mt-0.5" />
                    ) : result === "success" ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 shrink-0">
                        <IconCheck className="h-3.5 w-3.5" />
                        Installed
                      </span>
                    ) : result === "error" ? (
                      <span className="inline-flex items-center gap-1 text-xs text-red-500 shrink-0">
                        <IconX className="h-3.5 w-3.5" />
                        Failed
                      </span>
                    ) : null}
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {pkg.description || "No description available"}
                  </p>

                  {pkg.keywords && pkg.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {pkg.keywords.slice(0, 4).map((kw) => (
                        <span
                          key={kw}
                          className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Install output (collapsible) */}
                  {output && (
                    <div className="mt-1">
                      <button
                        onClick={() => setExpandedOutput(isExpanded ? null : pkg.name)}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <IconTerminal className="h-3 w-3" />
                        Install output
                        {isExpanded ? (
                          <IconChevronUp className="h-3 w-3" />
                        ) : (
                          <IconChevronDown className="h-3 w-3" />
                        )}
                      </button>
                      {isExpanded && (
                        <div className="mt-1 rounded bg-muted/50 p-2 font-mono text-[10px] text-muted-foreground max-h-32 overflow-y-auto">
                          {output.stdout && (
                            <pre className="whitespace-pre-wrap break-all">{output.stdout}</pre>
                          )}
                          {output.stderr && (
                            <pre className="whitespace-pre-wrap break-all text-red-400 mt-1">{output.stderr}</pre>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-auto pt-2">
                    <button
                      onClick={() => handleInstall(pkg.name)}
                      disabled={isInstalling || result === "success"}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                        isInstalling || result === "success"
                          ? "bg-muted text-muted-foreground cursor-not-allowed"
                          : "bg-primary text-primary-foreground hover:bg-primary/90"
                      )}
                    >
                      <IconCommand className="h-3 w-3" />
                      {isInstalling ? "Installing..." : result === "success" ? "Installed" : "Install"}
                    </button>

                    <button
                      onClick={() => handleCopy(pkg.name)}
                      className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      title="Copy install command"
                    >
                      {isCopied ? (
                        <IconCheck className="h-3 w-3" />
                      ) : (
                        <IconCopy className="h-3 w-3" />
                      )}
                      {isCopied ? "Copied" : "Copy"}
                    </button>

                    <a
                      href={`https://www.npmjs.com/package/${pkg.name}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        e.preventDefault();
                        window.electron.openExternal(`https://www.npmjs.com/package/${pkg.name}`);
                      }}
                      className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      npm
                      <IconExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
