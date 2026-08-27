"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Boxes,
  Check,
  ChevronRight,
  CircleAlert,
  History,
  LayoutDashboard,
  Loader2,
  Menu,
  PackageCheck,
  PackageMinus,
  PackagePlus,
  Plus,
  RefreshCw,
  ScanBarcode,
  Search,
  Warehouse,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
type View = "dashboard" | "stock-in" | "stock-out" | "products" | "movements";
type StockStatus = "available" | "low" | "out";
type Product = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  unit: string;
  minimumStock: number;
  isActive: boolean;
  quantity?: number;
  stockStatus?: StockStatus;
  inventory?: { quantity: number } | null;
};
type Movement = {
  id: string;
  type: "IN" | "OUT" | "ADJUSTMENT";
  quantity: number;
  balanceAfter: number;
  reference?: string | null;
  createdAt: string;
  product: Pick<Product, "code" | "name" | "unit">;
};
type Overview = {
  summary: {
    products: number;
    units: number;
    lowStock: number;
    outOfStock: number;
  };
  items: Product[];
};
type ApiError = { message?: string | string[] };

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiError;
    const message = Array.isArray(body.message)
      ? body.message.join(". ")
      : body.message;
    throw new Error(message || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

const navItems = [
  { id: "dashboard" as const, label: "Overview", icon: LayoutDashboard },
  { id: "stock-in" as const, label: "Stock in", icon: PackagePlus },
  { id: "stock-out" as const, label: "Stock out", icon: PackageMinus },
  { id: "products" as const, label: "Products", icon: Boxes },
  { id: "movements" as const, label: "Movements", icon: History },
];

export default function Home() {
  const [view, setView] = useState<View>("dashboard");
  const [overview, setOverview] = useState<Overview>({
    summary: { products: 0, units: 0, lowStock: 0, outOfStock: 0 },
    items: [],
  });
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(false);
  const [notice, setNotice] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [stock, activity] = await Promise.all([
        api<Overview>("/inventory/overview"),
        api<Movement[]>("/inventory/movements?limit=20"),
      ]);
      setOverview(stock);
      setMovements(activity);
      setOnline(true);
    } catch {
      setOnline(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const navigate = (next: View) => {
    setView(next);
    setSidebarOpen(false);
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <span className="brand-mark">
            <Warehouse size={22} />
          </span>
          <span>
            <strong>Aisle</strong>Ops
          </span>
        </div>
        <button
          className="mobile-close"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        >
          <X />
        </button>
        <div className="workspace-label">Warehouse control</div>
        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={view === item.id ? "nav-item active" : "nav-item"}
                onClick={() => navigate(item.id)}
              >
                <Icon size={19} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          <div className="system-status">
            <span className={online ? "status-dot online" : "status-dot"} />
            <div>
              <strong>{online ? "System online" : "API offline"}</strong>
              <small>
                {online ? "All services connected" : "Start API and database"}
              </small>
            </div>
          </div>
          <div className="operator">
            <div className="avatar">OP</div>
            <div>
              <strong>Warehouse Operator</strong>
              <small>Internal workspace</small>
            </div>
          </div>
        </div>
      </aside>
      {sidebarOpen && (
        <button
          className="scrim"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <main className="main">
        <header className="topbar">
          <button
            className="menu-button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
          >
            <Menu />
          </button>
          <div className="topbar-copy">
            <span>Operations</span>
            <ChevronRight size={14} />
            <strong>{navItems.find((item) => item.id === view)?.label}</strong>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" aria-label="Notifications">
              <Bell size={19} />
              <i />
            </button>
            <div className="date-chip">
              {new Intl.DateTimeFormat("en", {
                weekday: "short",
                day: "2-digit",
                month: "short",
              }).format(new Date())}
            </div>
          </div>
        </header>
        <div className="page-wrap">
          {view === "dashboard" && (
            <Dashboard
              overview={overview}
              movements={movements}
              loading={loading}
              onNavigate={navigate}
              onRefresh={refresh}
            />
          )}
          {view === "products" && (
            <Products
              products={overview.items}
              onDone={async (text) => {
                setNotice({ kind: "success", text });
                await refresh();
              }}
            />
          )}
          {(view === "stock-in" || view === "stock-out") && (
            <StockAction
              mode={view === "stock-in" ? "in" : "out"}
              onDone={async (text) => {
                setNotice({ kind: "success", text });
                await refresh();
              }}
            />
          )}
          {view === "movements" && (
            <Movements
              movements={movements}
              loading={loading}
              onRefresh={refresh}
            />
          )}
        </div>
      </main>
      {notice && (
        <div className={`toast ${notice.kind}`}>
          <Check size={18} />
          {notice.text}
        </div>
      )}
    </div>
  );
}

function Dashboard({
  overview,
  movements,
  loading,
  onNavigate,
  onRefresh,
}: {
  overview: Overview;
  movements: Movement[];
  loading: boolean;
  onNavigate: (view: View) => void;
  onRefresh: () => Promise<void>;
}) {
  const cards = [
    {
      label: "Active products",
      value: overview.summary.products,
      detail: "Product catalogue",
      icon: Boxes,
      tone: "indigo",
    },
    {
      label: "Units on hand",
      value: overview.summary.units.toLocaleString(),
      detail: "Across all products",
      icon: PackageCheck,
      tone: "green",
    },
    {
      label: "Low stock",
      value: overview.summary.lowStock,
      detail: "Needs attention",
      icon: CircleAlert,
      tone: "amber",
    },
    {
      label: "Out of stock",
      value: overview.summary.outOfStock,
      detail: "Reorder required",
      icon: PackageMinus,
      tone: "rose",
    },
  ];
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Live inventory</p>
          <h1>Warehouse overview</h1>
          <p>Track stock levels and keep every movement accounted for.</p>
        </div>
        <div className="heading-actions">
          <button className="button secondary" onClick={() => void onRefresh()}>
            <RefreshCw size={17} />
            Refresh
          </button>
          <button
            className="button primary"
            onClick={() => onNavigate("stock-in")}
          >
            <ScanBarcode size={18} />
            Scan stock in
          </button>
        </div>
      </section>
      <section className="metric-grid">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article className="metric-card" key={card.label}>
              <div className={`metric-icon ${card.tone}`}>
                <Icon size={21} />
              </div>
              <span>{card.label}</span>
              <strong>{loading ? "—" : card.value}</strong>
              <small>{card.detail}</small>
            </article>
          );
        })}
      </section>
      <section className="dashboard-grid">
        <article className="panel inventory-panel">
          <div className="panel-head">
            <div>
              <h2>Inventory snapshot</h2>
              <p>Current availability by product</p>
            </div>
            <button
              className="text-button"
              onClick={() => onNavigate("products")}
            >
              View products <ChevronRight size={16} />
            </button>
          </div>
          <InventoryTable
            products={overview.items.slice(0, 7)}
            loading={loading}
          />
        </article>
        <article className="panel quick-panel">
          <div className="quick-visual">
            <span className="scan-corner tl" />
            <span className="scan-corner tr" />
            <span className="scan-corner bl" />
            <span className="scan-corner br" />
            <ScanBarcode size={42} />
            <div className="scan-line" />
          </div>
          <p className="eyebrow">Fast operation</p>
          <h2>Ready to scan?</h2>
          <p>
            Choose a stock movement. Your HID scanner works automatically—no
            setup required.
          </p>
          <button
            className="quick-action receive"
            onClick={() => onNavigate("stock-in")}
          >
            <span>
              <ArrowDownRight size={19} />
              Receive stock
            </span>
            <ChevronRight size={18} />
          </button>
          <button
            className="quick-action issue"
            onClick={() => onNavigate("stock-out")}
          >
            <span>
              <ArrowUpRight size={19} />
              Issue stock
            </span>
            <ChevronRight size={18} />
          </button>
        </article>
      </section>
      <section className="panel activity-panel">
        <div className="panel-head">
          <div>
            <h2>Recent movements</h2>
            <p>Latest warehouse activity</p>
          </div>
          <button
            className="text-button"
            onClick={() => onNavigate("movements")}
          >
            View history <ChevronRight size={16} />
          </button>
        </div>
        <MovementTable movements={movements.slice(0, 6)} loading={loading} />
      </section>
    </>
  );
}

function InventoryTable({
  products,
  loading,
}: {
  products: Product[];
  loading: boolean;
}) {
  if (loading) return <LoadingRows />;
  if (!products.length)
    return (
      <EmptyState
        icon={Boxes}
        title="No products yet"
        text="Create your first product, then scan it into stock."
      />
    );
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Code</th>
            <th>On hand</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const quantity =
              product.quantity ?? product.inventory?.quantity ?? 0;
            const status =
              product.stockStatus ??
              (quantity === 0
                ? "out"
                : quantity <= product.minimumStock
                  ? "low"
                  : "available");
            return (
              <tr key={product.id}>
                <td>
                  <div className="product-cell">
                    <span className="product-icon">
                      <Boxes size={17} />
                    </span>
                    <div>
                      <strong>{product.name}</strong>
                      <small>{product.unit}</small>
                    </div>
                  </div>
                </td>
                <td>
                  <code>{product.code}</code>
                </td>
                <td>
                  <strong className="quantity">
                    {quantity.toLocaleString()}
                  </strong>{" "}
                  <small>{product.unit}</small>
                </td>
                <td>
                  <StockBadge status={status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StockBadge({ status }: { status: StockStatus }) {
  const labels = {
    available: "Available",
    low: "Low stock",
    out: "Out of stock",
  };
  return (
    <span className={`stock-badge ${status}`}>
      <i />
      {labels[status]}
    </span>
  );
}

function StockAction({
  mode,
  onDone,
}: {
  mode: "in" | "out";
  onDone: (text: string) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isIn = mode === "in";
  useEffect(() => {
    inputRef.current?.focus();
  }, [mode]);
  const lookup = async (event: FormEvent) => {
    event.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setError("");
    setProduct(null);
    try {
      setProduct(
        await api<Product>(
          `/inventory/products/${encodeURIComponent(code.trim())}`,
        ),
      );
      setQuantity(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Product lookup failed");
    } finally {
      setBusy(false);
    }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!product) return;
    setBusy(true);
    setError("");
    try {
      const movement = await api<Movement>(
        isIn ? "/inventory/receipts" : "/inventory/issues",
        {
          method: "POST",
          body: JSON.stringify({
            productCode: product.code,
            quantity,
            reference,
            note,
            idempotencyKey: crypto.randomUUID(),
          }),
        },
      );
      await onDone(
        `${product.name}: ${isIn ? "+" : "−"}${quantity} ${product.unit}. New balance ${movement.balanceAfter}.`,
      );
      setCode("");
      setProduct(null);
      setQuantity(1);
      setReference("");
      setNote("");
      window.setTimeout(() => inputRef.current?.focus(), 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Stock movement failed");
    } finally {
      setBusy(false);
    }
  };
  const current = product
    ? (product.quantity ?? product.inventory?.quantity ?? 0)
    : 0;
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Scan workflow</p>
          <h1>{isIn ? "Receive stock" : "Issue stock"}</h1>
          <p>
            {isIn
              ? "Add delivered products to available inventory."
              : "Record products leaving the warehouse."}
          </p>
        </div>
        <div className={`mode-chip ${isIn ? "receive" : "issue"}`}>
          {isIn ? <ArrowDownRight /> : <ArrowUpRight />}
          {isIn ? "Inbound" : "Outbound"}
        </div>
      </section>
      <div className="stock-layout">
        <section className="panel scan-panel">
          <div className="step-label">
            <span>1</span> Scan product
          </div>
          <form onSubmit={lookup} className="scan-form">
            <label htmlFor="barcode">Product code or barcode</label>
            <div className="scan-input-wrap">
              <ScanBarcode size={24} />
              <input
                ref={inputRef}
                id="barcode"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Scan barcode or type product code"
                autoComplete="off"
              />
              <span>ENTER</span>
            </div>
            <p className="field-help">
              <i className="status-dot online" />
              Scanner ready. HID scanners type the code and press Enter.
            </p>
            <button
              className="button primary full"
              disabled={busy || !code.trim()}
            >
              {busy ? (
                <Loader2 className="spin" size={18} />
              ) : (
                <Search size={18} />
              )}
              Find product
            </button>
          </form>
          {error && (
            <div className="error-box">
              <CircleAlert size={19} />
              <div>
                <strong>Could not continue</strong>
                <p>{error}</p>
              </div>
            </div>
          )}
        </section>
        <section
          className={`panel movement-panel ${!product ? "disabled-panel" : ""}`}
        >
          <div className="step-label">
            <span>2</span> Confirm movement
          </div>
          {!product ? (
            <div className="awaiting">
              <div className="awaiting-icon">
                <ScanBarcode size={32} />
              </div>
              <h3>Waiting for a product</h3>
              <p>
                Scan a barcode to review the product and current availability.
              </p>
            </div>
          ) : (
            <form onSubmit={submit}>
              <div className="selected-product">
                <div className="selected-icon">
                  <Boxes />
                </div>
                <div>
                  <span>{product.code}</span>
                  <h2>{product.name}</h2>
                  <p>
                    {current} {product.unit} currently available
                  </p>
                </div>
                <Check size={20} />
              </div>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="quantity">Quantity</label>
                  <div className="quantity-input">
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    >
                      −
                    </button>
                    <input
                      id="quantity"
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(event) =>
                        setQuantity(Math.max(1, Number(event.target.value)))
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setQuantity(quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="reference">
                    Reference <small>optional</small>
                  </label>
                  <input
                    id="reference"
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                    placeholder={isIn ? "PO-000123" : "SO-000123"}
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="note">
                  Note <small>optional</small>
                </label>
                <textarea
                  id="note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Add a movement note"
                  rows={3}
                />
              </div>
              <div className="balance-preview">
                <span>Balance after movement</span>
                <strong>
                  {Math.max(0, current + (isIn ? quantity : -quantity))}{" "}
                  <small>{product.unit}</small>
                </strong>
              </div>
              <button
                className={`button full ${isIn ? "success-button" : "danger-button"}`}
                disabled={busy}
              >
                {busy ? (
                  <Loader2 className="spin" />
                ) : isIn ? (
                  <PackagePlus />
                ) : (
                  <PackageMinus />
                )}
                {busy
                  ? "Saving…"
                  : isIn
                    ? "Confirm stock in"
                    : "Confirm stock out"}
              </button>
            </form>
          )}
        </section>
      </div>
    </>
  );
}

function Products({
  products,
  onDone,
}: {
  products: Product[];
  onDone: (text: string) => Promise<void>;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    code: "",
    name: "",
    unit: "pcs",
    minimumStock: 0,
    description: "",
  });
  const visible = products.filter((product) =>
    `${product.code} ${product.name}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api<Product>("/products", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm({
        code: "",
        name: "",
        unit: "pcs",
        minimumStock: 0,
        description: "",
      });
      setFormOpen(false);
      await onDone("Product created and ready to scan.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create product");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Product master</p>
          <h1>Products</h1>
          <p>Manage the product catalogue and reorder thresholds.</p>
        </div>
        <button
          className="button primary"
          onClick={() => setFormOpen(!formOpen)}
        >
          {formOpen ? <X size={18} /> : <Plus size={18} />}
          {formOpen ? "Close form" : "New product"}
        </button>
      </section>
      {formOpen && (
        <section className="panel product-form-panel">
          <div className="panel-head">
            <div>
              <h2>Create product</h2>
              <p>The product code is used for barcode lookup.</p>
            </div>
          </div>
          <form onSubmit={submit}>
            <div className="form-grid three">
              <div className="field">
                <label htmlFor="product-code">Product code</label>
                <input
                  id="product-code"
                  required
                  value={form.code}
                  onChange={(e) =>
                    setForm({ ...form, code: e.target.value.toUpperCase() })
                  }
                  placeholder="WH-1004"
                />
              </div>
              <div className="field">
                <label htmlFor="product-name">Product name</label>
                <input
                  id="product-name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Product name"
                />
              </div>
              <div className="field">
                <label htmlFor="unit">Unit</label>
                <input
                  id="unit"
                  required
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  placeholder="pcs"
                />
              </div>
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="min-stock">Minimum stock</label>
                <input
                  id="min-stock"
                  type="number"
                  min="0"
                  value={form.minimumStock}
                  onChange={(e) =>
                    setForm({ ...form, minimumStock: Number(e.target.value) })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="description">
                  Description <small>optional</small>
                </label>
                <input
                  id="description"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Internal product details"
                />
              </div>
            </div>
            {error && (
              <div className="error-box compact">
                <CircleAlert size={18} />
                {error}
              </div>
            )}
            <div className="form-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </button>
              <button className="button primary" disabled={busy}>
                {busy ? <Loader2 className="spin" /> : <Plus />}Create product
              </button>
            </div>
          </form>
        </section>
      )}
      <section className="panel">
        <div className="panel-head product-toolbar">
          <div>
            <h2>Product catalogue</h2>
            <p>{products.length} active products</p>
          </div>
          <div className="search-box">
            <Search size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code or name"
            />
          </div>
        </div>
        <InventoryTable products={visible} loading={false} />
      </section>
    </>
  );
}

function Movements({
  movements,
  loading,
  onRefresh,
}: {
  movements: Movement[];
  loading: boolean;
  onRefresh: () => Promise<void>;
}) {
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Audit ledger</p>
          <h1>Stock movements</h1>
          <p>An immutable history of inventory coming in and going out.</p>
        </div>
        <button className="button secondary" onClick={() => void onRefresh()}>
          <RefreshCw size={17} />
          Refresh
        </button>
      </section>
      <section className="panel">
        <MovementTable movements={movements} loading={loading} />
      </section>
    </>
  );
}
function MovementTable({
  movements,
  loading,
}: {
  movements: Movement[];
  loading: boolean;
}) {
  if (loading) return <LoadingRows />;
  if (!movements.length)
    return (
      <EmptyState
        icon={History}
        title="No movements yet"
        text="Stock receipts and issues will appear here."
      />
    );
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Movement</th>
            <th>Product</th>
            <th>Reference</th>
            <th>Balance</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((movement) => (
            <tr key={movement.id}>
              <td>
                <span
                  className={`movement-type ${movement.type.toLowerCase()}`}
                >
                  {movement.type === "IN" ? (
                    <ArrowDownRight size={16} />
                  ) : (
                    <ArrowUpRight size={16} />
                  )}
                  {movement.type === "IN"
                    ? "Stock in"
                    : movement.type === "OUT"
                      ? "Stock out"
                      : "Adjustment"}
                </span>
              </td>
              <td>
                <div className="movement-product">
                  <strong>{movement.product.name}</strong>
                  <code>{movement.product.code}</code>
                </div>
              </td>
              <td>{movement.reference || <span className="muted">—</span>}</td>
              <td>
                <strong
                  className={movement.type === "IN" ? "positive" : "negative"}
                >
                  {movement.type === "IN" ? "+" : "−"}
                  {movement.quantity}
                </strong>
                <small>
                  {" "}
                  → {movement.balanceAfter} {movement.product.unit}
                </small>
              </td>
              <td>
                <span className="date-time">
                  {new Intl.DateTimeFormat("en", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(movement.createdAt))}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function EmptyState({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Boxes;
  title: string;
  text: string;
}) {
  return (
    <div className="empty-state">
      <span>
        <Icon size={26} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function LoadingRows() {
  return (
    <div className="loading-state">
      <Loader2 className="spin" />
      <span>Loading warehouse data…</span>
    </div>
  );
}
