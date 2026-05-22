import * as React from "react";
import { cn } from "@/lib/utils";
import {
  IconSearch,
  IconLoader2,
  IconCheck,
  IconX,
  IconPuzzle,
  IconCopy,
  IconCommand,
  IconChevronDown,
  IconChevronUp,
  IconTerminal,
  IconBrandNpm,
  IconGitBranch,
  IconFlag,
  IconBox,
} from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

interface NpmPackage {
  name: string;
  description: string;
  version: string;
  keywords?: string[];
  author?: string;
  date?: string;
  links?: { npm?: string; repository?: string; homepage?: string; bugs?: string };
}

interface InstalledExtension {
  name: string;
  version: string;
  description?: string;
  installedAt?: string;
}

function formatDateAgo(dateStr?: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

function isExtension(pkg: NpmPackage): boolean {
  return (
    pkg.keywords?.some((k) => k.toLowerCase().includes("extension")) ??
    pkg.name.toLowerCase().includes("pi-")
  );
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
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [sortBy, setSortBy] = React.useState("downloads");
  const [typeFilterOpen, setTypeFilterOpen] = React.useState(false);
  const [sortByOpen, setSortByOpen] = React.useState(false);

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

  const loadInstalled = React.useCallback(async () => {
    try {
      const list = await window.electron.getInstalledExtensions();
      setInstalled(list);
    } catch (err) {
      console.error("Failed to load installed extensions:", err);
    }
  }, []);

  React.useEffect(() => {
    loadInstalled();
    search("pi-extension");
  }, [loadInstalled, search]);

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
  }, [loadInstalled]);

  const handleCopy = React.useCallback((pkgName: string) => {
    const command = `pi install npm:${pkgName}`;
    navigator.clipboard.writeText(command).catch(() => {});
    setCopiedId(pkgName);
    setTimeout(() => setCopiedId(null), 1500);
  }, []);

  const filteredPackages = React.useMemo(() => {
    let list = [...packages];
    if (typeFilter === "extension") {
      list = list.filter((p) => isExtension(p));
    } else if (typeFilter === "package") {
      list = list.filter((p) => !isExtension(p));
    }
    // Apply sorting
    if (sortBy === "downloads") {
      list.sort((a, b) => ((b as unknown as { downloads?: number }).downloads ?? 0) - ((a as unknown as { downloads?: number }).downloads ?? 0));
    } else if (sortBy === "recent") {
      list.sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime());
    } else if (sortBy === "name") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [packages, typeFilter, sortBy]);

  const handleReset = () => {
    setQuery("");
    setTypeFilter("all");
    setSortBy("downloads");
    search("pi-extension");
  };

  return (
    <div className="h-full overflow-y-auto no-scrollbar">
      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xs font-mono tracking-[0.2em] text-muted-foreground uppercase">
            ALL PACKAGES
          </h1>
          <span className="text-xs font-mono text-muted-foreground">
            1-{Math.min(filteredPackages.length, 50)} / {filteredPackages.length}
          </span>
        </div>

        {/* Installed extensions — compact bar */}
        {installed.length > 0 && (
          <div className="mb-6 flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono tracking-wider text-muted-foreground uppercase">
              INSTALLED
            </span>
            {installed.map((ext) => (
              <span
                key={ext.name}
                className="inline-flex items-center gap-1 rounded border border-border/60 bg-card/50 px-2 py-1 text-[11px] text-muted-foreground"
              >
                <IconCheck className="h-3 w-3 text-green-500" />
                {ext.name}
              </span>
            ))}
          </div>
        )}

        {/* Filter bar */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter packages..."
              className="pl-9 bg-background/50 font-mono text-sm"
            />
          </div>
          {/* Type filter dropdown */}
          <DropdownMenu onOpenChange={setTypeFilterOpen}>
            <DropdownMenuTrigger
              className={cn(
                "h-9 rounded-md border border-border/60 bg-background/50 px-3 text-xs font-mono text-muted-foreground outline-none transition-colors flex items-center gap-2 shrink-0",
                typeFilterOpen && "border-ring text-foreground bg-accent/20"
              )}
            >
              {typeFilter === "all" ? "All types" : typeFilter === "extension" ? "Extension" : "Package"}
              <IconChevronDown className={cn("h-3 w-3 shrink-0 transition-transform", typeFilterOpen && "rotate-180")} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem className="text-xs font-mono" onClick={() => setTypeFilter("all")}>
                <span className={cn(typeFilter === "all" && "text-foreground font-medium")}>All types</span>
                {typeFilter === "all" && <IconCheck className="ml-auto h-3.5 w-3.5" />}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs font-mono" onClick={() => setTypeFilter("extension")}>
                <span className={cn(typeFilter === "extension" && "text-foreground font-medium")}>Extension</span>
                {typeFilter === "extension" && <IconCheck className="ml-auto h-3.5 w-3.5" />}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs font-mono" onClick={() => setTypeFilter("package")}>
                <span className={cn(typeFilter === "package" && "text-foreground font-medium")}>Package</span>
                {typeFilter === "package" && <IconCheck className="ml-auto h-3.5 w-3.5" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort dropdown */}
          <DropdownMenu onOpenChange={setSortByOpen}>
            <DropdownMenuTrigger
              className={cn(
                "h-9 rounded-md border border-border/60 bg-background/50 px-3 text-xs font-mono text-muted-foreground outline-none transition-colors flex items-center gap-2 shrink-0",
                sortByOpen && "border-ring text-foreground bg-accent/20"
              )}
            >
              {sortBy === "downloads" ? "Most downloads" : sortBy === "recent" ? "Most recent" : "Name"}
              <IconChevronDown className={cn("h-3 w-3 shrink-0 transition-transform", sortByOpen && "rotate-180")} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem className="text-xs font-mono" onClick={() => setSortBy("downloads")}>
                <span className={cn(sortBy === "downloads" && "text-foreground font-medium")}>Most downloads</span>
                {sortBy === "downloads" && <IconCheck className="ml-auto h-3.5 w-3.5" />}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs font-mono" onClick={() => setSortBy("recent")}>
                <span className={cn(sortBy === "recent" && "text-foreground font-medium")}>Most recent</span>
                {sortBy === "recent" && <IconCheck className="ml-auto h-3.5 w-3.5" />}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs font-mono" onClick={() => setSortBy("name")}>
                <span className={cn(sortBy === "name" && "text-foreground font-medium")}>Name</span>
                {sortBy === "name" && <IconCheck className="ml-auto h-3.5 w-3.5" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            onClick={() => search(query)}
            className="h-9 rounded-md border border-border/60 bg-background/50 px-3 text-xs font-mono text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            [ SEARCH ]
          </button>
          <button
            onClick={handleReset}
            className="h-9 rounded-md border border-border/60 bg-background/50 px-3 text-xs font-mono text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            [ RESET ]
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
            <IconLoader2 className="h-4 w-4 animate-spin" />
            Searching npm registry...
          </div>
        )}

        {/* Empty */}
        {!loading && filteredPackages.length === 0 && (
          <div className="rounded-lg border border-border/40 bg-card/50 p-8 text-center">
            <IconPuzzle className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {query ? `No results for "${query}"` : "No extensions found"}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Try searching for different keywords
            </p>
          </div>
        )}

        {/* Results grid */}
        {!loading && filteredPackages.length > 0 && (
          <div className="flex flex-col gap-4">
            {filteredPackages.map((pkg) => {
              const isInstalling = installingId === pkg.name;
              const result = installResult[pkg.name];
              const output = installOutput[pkg.name];
              const isExpanded = expandedOutput === pkg.name;
              const isCopied = copiedId === pkg.name;
              const extBadge = isExtension(pkg) ? "EXTENSION" : "PACKAGE";
              const dateAgo = formatDateAgo(pkg.date);

              return (
                <div
                  key={pkg.name}
                  className="group grid grid-cols-[180px_1fr] rounded-lg border border-border/40 bg-card/50 overflow-hidden hover:border-border/80 hover:bg-card transition-colors"
                >
                  {/* Left: placeholder image */}
                  <div className="relative border-r border-border/40 bg-[#1a1d24] flex items-center justify-center overflow-hidden">
                    {/* Grid pattern */}
                    <div
                      className="absolute inset-0 opacity-20"
                      style={{
                        backgroundImage:
                          "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
                        backgroundSize: "20px 20px",
                      }}
                    />
                    {/* Decorative lines */}
                    <div className="absolute bottom-8 left-6 right-6 flex flex-col gap-1.5">
                      <div className="h-px bg-gradient-to-r from-transparent via-sky-500/40 to-transparent" />
                      <div className="h-px bg-gradient-to-r from-transparent via-sky-500/20 to-transparent w-2/3" />
                    </div>
                    {/* Package icon watermark */}
                    <IconBox className="h-10 w-10 text-muted-foreground/10" />
                  </div>

                  {/* Right: content */}
                  <div className="flex flex-col gap-2 p-4">
                    {/* Name + version */}
                    <div className="flex items-baseline gap-3">
                      <button
                        onClick={() =>
                          window.electron.openExternal(
                            `https://www.npmjs.com/package/${pkg.name}`
                          )
                        }
                        className="text-sm font-semibold text-foreground underline decoration-muted-foreground/30 underline-offset-2 hover:decoration-foreground/50 transition-colors truncate"
                      >
                        {pkg.name}
                      </button>
                      <span className="text-[10px] text-muted-foreground/50 shrink-0">
                        v{pkg.version}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {pkg.description || "No description available"}
                    </p>

                    {/* Metadata row */}
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground/70">
                      {pkg.author && <span>{pkg.author}</span>}
                      {pkg.author && dateAgo && <span className="text-muted-foreground/30">·</span>}
                      {dateAgo && <span>{dateAgo}</span>}
                      {result === "success" && (
                        <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 ml-auto">
                          <IconCheck className="h-3 w-3" />
                          Installed
                        </span>
                      )}
                      {result === "error" && (
                        <span className="inline-flex items-center gap-1 text-red-500 ml-auto">
                          <IconX className="h-3 w-3" />
                          Failed
                        </span>
                      )}
                      {isInstalling && (
                        <span className="inline-flex items-center gap-1 text-muted-foreground ml-auto">
                          <IconLoader2 className="h-3 w-3 animate-spin" />
                          Installing...
                        </span>
                      )}
                    </div>

                    {/* Badge + Links row */}
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-mono tracking-wide",
                          extBadge === "EXTENSION"
                            ? "border-green-500/30 text-green-600 dark:text-green-400"
                            : "border-border/60 text-muted-foreground"
                        )}
                      >
                        {extBadge}
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() =>
                            window.electron.openExternal(
                              `https://www.npmjs.com/package/${pkg.name}`
                            )
                          }
                          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <IconBrandNpm className="h-3 w-3" />
                          npm
                        </button>
                        {pkg.links?.repository && (
                          <button
                            onClick={() =>
                              window.electron.openExternal(pkg.links!.repository!)
                            }
                            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <IconGitBranch className="h-3 w-3" />
                            repo
                          </button>
                        )}
                        <button
                          onClick={() =>
                            window.electron.openExternal(
                              `https://www.npmjs.com/package/${pkg.name}/issues`
                            )
                          }
                          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <IconFlag className="h-3 w-3" />
                          report
                        </button>
                      </div>
                    </div>

                    {/* Install output (collapsible) */}
                    {output && (
                      <div>
                        <button
                          onClick={() =>
                            setExpandedOutput(isExpanded ? null : pkg.name)
                          }
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
                              <pre className="whitespace-pre-wrap break-all">
                                {output.stdout}
                              </pre>
                            )}
                            {output.stderr && (
                              <pre className="whitespace-pre-wrap break-all text-red-400 mt-1">
                                {output.stderr}
                              </pre>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Command bar */}
                    <div className="mt-auto pt-2">
                      <div className="flex items-center gap-2 rounded border border-border/60 bg-[#1e2128] px-3 py-2">
                        <span className="text-xs font-mono text-muted-foreground shrink-0">$</span>
                        <span className="text-xs font-mono text-muted-foreground truncate">
                          pi install npm:{pkg.name}
                        </span>
                        <div className="ml-auto flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleInstall(pkg.name)}
                            disabled={isInstalling || result === "success"}
                            className={cn(
                              "flex items-center gap-1 rounded px-2 py-1 text-[10px] font-mono transition-colors",
                              isInstalling || result === "success"
                                ? "text-muted-foreground cursor-not-allowed"
                                : "text-foreground hover:bg-accent"
                            )}
                          >
                            {isInstalling ? (
                              <IconLoader2 className="h-3 w-3 animate-spin" />
                            ) : result === "success" ? (
                              <IconCheck className="h-3 w-3" />
                            ) : (
                              <IconBox className="h-3 w-3" />
                            )}
                            {isInstalling
                              ? "..."
                              : result === "success"
                              ? "OK"
                              : "INSTALL"}
                          </button>
                          <button
                            onClick={() => handleCopy(pkg.name)}
                            className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-mono text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                          >
                            {isCopied ? (
                              <IconCheck className="h-3 w-3" />
                            ) : (
                              <IconCopy className="h-3 w-3" />
                            )}
                            {isCopied ? "[ COPIED ]" : "[ COPY ]"}
                          </button>
                        </div>
                      </div>
                    </div>
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
