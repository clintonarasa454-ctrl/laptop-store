import { useState, useEffect } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { trpc } from "@/lib/trpc";
import { Package, ShoppingCart, Users, Layers, Loader2, Search as SearchIcon, Plus } from "lucide-react";
import { useLocation } from "wouter";

export function AdminSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [, navigate] = useLocation();

  const { data, isLoading, isFetching } = trpc.admin.globalSearch.useQuery(
    { query },
    { enabled: query.length > 0 }
  );

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    setQuery("");
    command();
  };

  const hasResults = data && (data.products.length > 0 || data.orders.length > 0 || data.customers.length > 0 || data.categories.length > 0);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-muted-foreground bg-background border border-input rounded-md px-3 h-9 flex items-center gap-2 hover:bg-muted transition-colors w-full sm:w-auto justify-between sm:justify-start"
      >
        <div className="flex items-center gap-2">
          <SearchIcon className="w-4 h-4" />
          <span className="hidden sm:inline">Search...</span>
        </div>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search for products, orders, customers..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {(isLoading || isFetching) && query.length > 0 && (
            <div className="p-4 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {query.length > 0 && !isFetching && !hasResults && (
            <CommandEmpty>No results found.</CommandEmpty>
          )}

          <CommandGroup heading="Quick Actions">
            <CommandItem onSelect={() => runCommand(() => navigate(`/admin/products?new=true`))}>
              <Plus className="mr-2 h-4 w-4" />
              <span>Create New Product</span>
            </CommandItem>
          </CommandGroup>
          
          {data?.products && data.products.length > 0 && (
            <CommandGroup heading="Products">
              {data.products.map((product) => (
                <CommandItem key={`product-${product.id}`} onSelect={() => runCommand(() => navigate(`/admin/products?edit=${product.id}`))}>
                  <Package className="mr-2 h-4 w-4" />
                  <span>{product.name}</span>
                  {product.brand && <span className="text-xs text-muted-foreground ml-auto">{product.brand}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {data?.orders && data.orders.length > 0 && (
            <CommandGroup heading="Orders">
              {data.orders.map((order) => (
                <CommandItem key={`order-${order.id}`} onSelect={() => runCommand(() => navigate(`/admin/orders/${order.id}`))}>
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  <span>{order.orderNumber}</span>
                  {order.customerName && <span className="text-xs text-muted-foreground ml-auto">{order.customerName}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {data?.customers && data.customers.length > 0 && (
            <CommandGroup heading="Customers">
              {data.customers.map((customer) => (
                <CommandItem key={`customer-${customer.id}`} onSelect={() => runCommand(() => navigate(`/admin/customers`))}>
                  <Users className="mr-2 h-4 w-4" />
                  <span>{customer.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{customer.email}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {data?.categories && data.categories.length > 0 && (
            <CommandGroup heading="Categories">
              {data.categories.map((category) => (
                <CommandItem key={`category-${category.id}`} onSelect={() => runCommand(() => navigate(`/admin/categories`))}>
                  <Layers className="mr-2 h-4 w-4" />
                  <span>{category.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}