import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/lib/auth";
import { LoginPage } from "@/components/login-page";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Algo salió mal</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error.message || "Ocurrió un error inesperado."}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Reintentar
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Multimarket — Sistema de ventas" },
      {
        name: "description",
        content: "Gestión de ventas, inventario, cuentas por cobrar y pagar.",
      },
      { property: "og:title", content: "Multimarket — Sistema de ventas" },
      {
        property: "og:description",
        content: "Gestión de ventas, inventario, cuentas por cobrar y pagar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/logo_multimarket.png", type: "image/png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/** Contenido protegido: muestra el login si no hay sesión. */
function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100svh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--background)",
          color: "var(--muted-foreground)",
          fontSize: "0.875rem",
          gap: "0.5rem",
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{ animation: "spin 1s linear infinite" }}
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        Cargando…
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-3 border-b bg-card/60 backdrop-blur px-4 sticky top-0 z-10">
            <SidebarTrigger />
            <div className="text-sm text-muted-foreground">Multimarket 2026</div>
            <div className="ml-auto flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                Hola,{" "}
                <span className="font-semibold text-foreground">
                  {user.name.split(" ")[0]}
                </span>
              </span>
              <LogoutButton />
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-x-hidden">
            <Outlet />
          </main>
        </div>
      </div>
      <Toaster richColors position="top-right" />
    </SidebarProvider>
  );
}

function LogoutButton() {
  const { logout } = useAuth();
  return (
    <button
      id="logout-btn"
      onClick={() => logout()}
      style={{
        padding: "0.3rem 0.75rem",
        borderRadius: "0.4rem",
        border: "1px solid var(--border)",
        background: "transparent",
        color: "var(--muted-foreground)",
        fontSize: "0.75rem",
        fontWeight: 600,
        cursor: "pointer",
        transition: "background 0.15s, color 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--muted)";
        e.currentTarget.style.color = "var(--foreground)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = "var(--muted-foreground)";
      }}
    >
      Cerrar sesión
    </button>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </QueryClientProvider>
  );
}
