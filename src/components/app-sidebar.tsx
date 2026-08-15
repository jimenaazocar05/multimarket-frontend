import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ShoppingCart,
  ShoppingBasket,
  Package,
  Users,
  Truck,
  HandCoins,
  Receipt,
  ReceiptText,
  BarChart3,
  ListOrdered,
  Store,
  Wallet,
  UserCog,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";

const primary = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Punto de venta", url: "/pos", icon: ShoppingCart },
  { title: "Ventas", url: "/sales", icon: ListOrdered },
  { title: "Punto de compra", url: "/purchase-point", icon: Store },
  { title: "Compras", url: "/purchases", icon: ShoppingBasket },
  { title: "Punto de gastos", url: "/expense-point", icon: Wallet },
  { title: "Gastos", url: "/expenses", icon: ReceiptText },
];
const catalog = [
  { title: "Inventario", url: "/inventory", icon: Package },
  { title: "Clientes", url: "/customers", icon: Users },
  { title: "Proveedores", url: "/suppliers", icon: Truck },
];
const finance = [
  { title: "Cuentas por cobrar", url: "/receivables", icon: HandCoins },
  { title: "Cuentas por pagar", url: "/payables", icon: Receipt },
  { title: "Reportes", url: "/reports", icon: BarChart3 },
];
const admin = [
  { title: "Usuarios y roles", url: "/admin/users", icon: UserCog },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (u: string) => (u === "/" ? pathname === "/" : pathname.startsWith(u));
  const { user } = useAuth();

  const renderGroup = (label: string, items: typeof primary) => (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton asChild isActive={isActive(item.url)}>
                <Link to={item.url} className="flex items-center gap-2">
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <img
            src="/logo_multimarket.png"
            alt="Multimarket Logo"
            className="h-9 w-9 shrink-0 object-contain drop-shadow-sm"
          />
          <div className="flex flex-col leading-tight">
            <span className="text-base font-bold tracking-tight text-sidebar-foreground">MULTIMARKET</span>
            <span className="text-xs text-sidebar-foreground/70 font-medium">Sistema de ventas</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {renderGroup("Operación", primary)}
        {renderGroup("Catálogo", catalog)}
        {renderGroup("Finanzas", finance)}
        {user?.role === "admin" && renderGroup("Administración", admin)}
      </SidebarContent>
    </Sidebar>
  );
}
