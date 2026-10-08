import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownUp,
  ArrowRight,
  BadgeCheck,
  Bell,
  Check,
  ChevronDown,
  CircleHelp,
  Leaf,
  LogOut,
  MapPin,
  Menu,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBasket,
  Sprout,
  Smartphone,
  Tractor,
  Wheat,
  X,
} from "lucide-react";
import QRCode from "qrcode";
import { clearToken, getToken, request, setToken } from "./api.js";

const categories = ["All produce", "Vegetables", "Fruits", "Grains", "Dairy", "Herbs", "Other"];
const categoryIcons = {
  Vegetables: "🥬",
  Fruits: "🍓",
  Grains: "🌾",
  Dairy: "🥛",
  Herbs: "🌿",
  Other: "🧺",
};
const emptyForm = {
  name: "",
  category: "Vegetables",
  description: "",
  quantity: "",
  unit: "kg",
  price: "",
  location: "",
};
const pagePaths = {
  home: "/",
  customer: "/customer",
  farmer: "/farmer",
};

function pageFromPath(pathname) {
  if (pathname === pagePaths.customer) return "customer";
  if (pathname === pagePaths.farmer) return "farmer";
  return "home";
}

function navigateToPage(page, setPage) {
  const path = pagePaths[page];
  if (window.location.pathname !== path) {
    window.history.pushState({}, "", path);
  }
  setPage(page);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function App() {
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [category, setCategory] = useState("All produce");
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [page, setPage] = useState(() => pageFromPath(window.location.pathname));
  const [sessionReady, setSessionReady] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [registrationRole, setRegistrationRole] = useState("customer");
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [purchaseProduct, setPurchaseProduct] = useState(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState("1");
  const [purchaseOrder, setPurchaseOrder] = useState(null);
  const [paymentQr, setPaymentQr] = useState("");
  const [transactionReference, setTransactionReference] = useState("");
  const [purchaseError, setPurchaseError] = useState("");
  const [farmerOrders, setFarmerOrders] = useState([]);
  const [farmerUpiId, setFarmerUpiId] = useState("");
  const [upiSaving, setUpiSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role === "farmer") setFarmerUpiId(user.upiId || "");
  }, [user]);

  const loadFarmerOrders = useCallback(async () => {
    try {
      const result = await request("/api/orders/farmer");
      setFarmerOrders(result.orders);
    } catch (error) {
      setNotice(error.message);
    }
  }, []);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (page === "farmer" && user?.role === "farmer") {
        const result = await request("/api/products/mine");
        setProducts(result.products);
        return;
      }
      if (page === "farmer") {
        setProducts([]);
        return;
      }
      if (search.trim()) params.set("search", search.trim());
      if (location.trim()) params.set("location", location.trim());
      if (category !== "All produce") params.set("category", category);
      const result = await request(`/api/products?${params.toString()}`);
      setProducts(result.products);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }, [category, location, page, search, user]);

  useEffect(() => {
    let active = true;
    async function restoreSession() {
      if (getToken()) {
        try {
          const result = await request("/api/auth/me");
          if (active) setUser(result.user);
        } catch {
          clearToken();
        }
      }
      if (active) {
        setSessionReady(true);
        setLoading(false);
      }
    }
    restoreSession();
    const onExpired = () => {
      setUser(null);
      navigateToPage("home", setPage);
      setNotice("Your session expired. Please sign in again.");
    };
    window.addEventListener("auth-expired", onExpired);
    const onPopState = () => setPage(pageFromPath(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => {
      active = false;
      window.removeEventListener("auth-expired", onExpired);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  useEffect(() => {
    if (!sessionReady) return undefined;
    if (user && page === "home") {
      navigateToPage(user.role, setPage);
    } else if (user?.role === "customer" && page === "farmer") {
      navigateToPage("customer", setPage);
    }
    return undefined;
  }, [page, sessionReady, user]);

  useEffect(() => {
    if (!sessionReady) return undefined;
    const timer = window.setTimeout(loadProducts, 250);
    return () => window.clearTimeout(timer);
  }, [loadProducts, sessionReady]);

  useEffect(() => {
    if (!sessionReady || page !== "farmer" || user?.role !== "farmer") return undefined;
    loadFarmerOrders();
    const timer = window.setInterval(loadFarmerOrders, 15000);
    return () => window.clearInterval(timer);
  }, [loadFarmerOrders, page, sessionReady, user]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const subtitle = category !== "All produce"
    ? `The freshest ${category.toLowerCase()}, grown nearby.`
    : "Good food, grown close to home.";

  function openAuth(mode = "login", role = "customer") {
    setAuthMode(mode);
    setRegistrationRole(role);
    setAuthOpen(true);
  }

  async function handleAuth(event) {
    event.preventDefault();
    setBusy(true);
    setFormError("");
    const data = new FormData(event.currentTarget);
    const payload = Object.fromEntries(data.entries());
    try {
      const result = await request(`/api/auth/${authMode}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setToken(result.token);
      setUser(result.user);
      setAuthOpen(false);
      setNotice(`Welcome ${authMode === "register" ? "to Harvest Hub" : "back"}, ${result.user.name.split(" ")[0]}!`);
      navigateToPage(result.user.role, setPage);
      if (result.user.role === "customer" && purchaseProduct) setPurchaseOpen(true);
    } catch (error) {
      setFormError(error.message);
    } finally {
      setBusy(false);
    }
  }

  function signOut() {
    clearToken();
    setUser(null);
    navigateToPage("home", setPage);
    setNotice("You have been signed out.");
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(product) {
    setEditing(product);
    setForm({
      name: product.name,
      category: product.category,
      description: product.description || "",
      quantity: String(product.quantity),
      unit: product.unit,
      price: String(product.price),
      location: product.location,
    });
    setFormError("");
    setFormOpen(true);
  }

  async function saveProduct(event) {
    event.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      const result = await request(
        editing ? `/api/products/${editing._id}` : "/api/products",
        {
          method: editing ? "PATCH" : "POST",
          body: JSON.stringify({ ...form, quantity: Number(form.quantity), price: Number(form.price) }),
        },
      );
      setProducts((current) =>
        editing
          ? current.map((item) => (item._id === result.product._id ? result.product : item))
          : [result.product, ...current],
      );
      setFormOpen(false);
      setNotice(editing ? "Listing updated successfully." : "Your listing is live!");
    } catch (error) {
      setFormError(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteProduct(product) {
    if (!window.confirm(`Remove "${product.name}" from the marketplace?`)) return;
    try {
      await request(`/api/products/${product._id}`, { method: "DELETE" });
      setProducts((current) => current.filter((item) => item._id !== product._id));
      setNotice("Listing removed.");
    } catch (error) {
      setNotice(error.message);
    }
  }

  function openPurchase(product) {
    if (user?.role === "farmer") {
      setNotice("Farmer accounts cannot purchase their own marketplace listings.");
      return;
    }
    setPurchaseProduct(product);
    setPurchaseQuantity("1");
    setPurchaseError("");
    if (user?.role === "customer") {
      setPurchaseOpen(true);
    } else {
      openAuth("login");
    }
  }

  function closePurchase() {
    if (purchaseOrder?.paymentStatus === "awaiting_payment") {
      request(`/api/orders/${purchaseOrder.orderId}/cancel`, { method: "POST" })
        .catch((error) => setNotice(error.message));
    }
    setPurchaseOpen(false);
    setPurchaseOrder(null);
    setPaymentQr("");
    setTransactionReference("");
  }

  async function completePurchase(event) {
    event.preventDefault();
    if (!purchaseProduct || !user) return;
    setBusy(true);
    setPurchaseError("");
    try {
      const order = await request("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          productId: purchaseProduct._id,
          quantity: Number(purchaseQuantity),
        }),
      });
      const amount = (order.amountPaise / 100).toFixed(2);
      const upiParams = new URLSearchParams({
        pa: order.farmerUpiId,
        pn: order.farmerName,
        am: amount,
        cu: "INR",
        tn: `Harvest Hub ${order.orderId}`,
      });
      const qr = await QRCode.toDataURL(`upi://pay?${upiParams.toString()}`, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 240,
      });
      setPurchaseOrder(order);
      setPaymentQr(qr);
    } catch (error) {
      setPurchaseError(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function reportPayment() {
    if (!purchaseOrder) return;
    setBusy(true);
    setPurchaseError("");
    try {
      await request(`/api/orders/${purchaseOrder.orderId}/payment-submitted`, {
        method: "POST",
        body: JSON.stringify({ transactionReference: transactionReference.trim() || undefined }),
      });
      setPurchaseOrder((current) => ({ ...current, paymentStatus: "awaiting_confirmation" }));
      setNotice("Payment reported. The farmer will confirm it after checking their UPI app.");
    } catch (error) {
      setPurchaseError(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveFarmerUpi(event) {
    event.preventDefault();
    setUpiSaving(true);
    try {
      const result = await request("/api/auth/farmer-payment", {
        method: "PUT",
        body: JSON.stringify({ upiId: farmerUpiId }),
      });
      setUser((current) => ({ ...current, upiId: result.user.upiId }));
      setFarmerUpiId(result.user.upiId || "");
      setNotice("Your UPI payment details have been saved.");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setUpiSaving(false);
    }
  }

  async function updateOrderStatus(orderId, status) {
    setBusy(true);
    try {
      await request(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await loadFarmerOrders();
      if (status === "paid") await loadProducts();
    } catch (error) {
      setNotice(error.message);
      await loadFarmerOrders();
    } finally {
      setBusy(false);
    }
  }

  async function markOrderRead(orderId) {
    try {
      const result = await request(`/api/orders/${orderId}/read`, { method: "PATCH" });
      setFarmerOrders((current) =>
        current.map((order) =>
          order.id === orderId ? { ...order, notificationReadAt: result.notificationReadAt } : order,
        ),
      );
    } catch (error) {
      setNotice(error.message);
    }
  }

  const isFarmer = user?.role === "farmer";
  const isFarmerPage = page === "farmer";
  const isCustomerPage = page === "customer";
  const isMine = isFarmerPage && isFarmer;
  const unreadOrderCount = farmerOrders.filter((order) => !order.notificationReadAt).length;

  return (
    <div className="app-shell">
      <div className="announcement">
        <Sprout size={14} strokeWidth={2.2} />
        <span>Good food starts close to home.</span>
        <span className="announcement-dot">·</span>
        <button onClick={() => document.getElementById("marketplace")?.scrollIntoView({ behavior: "smooth" })}>
          Meet your local growers <ArrowRight size={13} />
        </button>
      </div>

      <header className="site-header">
        <a className="brand" href="/" onClick={(event) => { event.preventDefault(); navigateToPage("home", setPage); }}>
          <span className="brand-mark"><Leaf size={21} strokeWidth={2.2} /></span>
          <span>harvest<span className="brand-light">hub</span><small>GROWN TOGETHER</small></span>
        </a>
        <nav className="desktop-nav" aria-label="Main navigation">
          <button className={isCustomerPage ? "nav-link active" : "nav-link"} onClick={() => navigateToPage("customer", setPage)}>Shop produce</button>
          {isFarmer && <button className={isFarmerPage ? "nav-link active" : "nav-link"} onClick={() => navigateToPage("farmer", setPage)}>My farm{unreadOrderCount > 0 && <span className="nav-notification-count">{unreadOrderCount}</span>}</button>}
          {!user && <button className={isFarmerPage ? "nav-link active" : "nav-link"} onClick={() => navigateToPage("farmer", setPage)}>For farmers</button>}
          {page === "home" && <a className="nav-link" href="#how-it-works">How it works</a>}
        </nav>
        <div className="header-actions">
          {user ? (
            <>
              <button className="header-manage" onClick={() => navigateToPage(isFarmer ? "farmer" : "customer", setPage)}>
                {isFarmer ? <Tractor size={16} /> : <ShoppingBasket size={16} />}
                {isFarmer ? "My farm" : "My marketplace"}
              </button>
              <span className="user-greeting">Hi, {user.name.split(" ")[0]}</span>
              <button className="icon-button" aria-label="Sign out" title="Sign out" onClick={signOut}><LogOut size={17} /></button>
            </>
          ) : (
            <>
              <button className="login-link" onClick={() => openAuth("login")}>Log in</button>
              <button className="button button-dark button-small" onClick={() => openAuth("register")}>Join Harvest Hub <ArrowRight size={15} /></button>
            </>
          )}
        </div>
        <button className="mobile-menu icon-button" aria-label="Open sign in" onClick={() => user ? signOut() : openAuth("login")}>
          {user ? <LogOut size={18} /> : <Menu size={19} />}
        </button>
      </header>

      <main>
        {page === "home" && <section className="hero">
          <div className="hero-content">
            <div className="eyebrow"><span className="eyebrow-line" /> FROM OUR FIELDS TO YOUR TABLE</div>
            <h1>Fresh feels<br />better <span>when it&apos;s local.</span></h1>
            <p className="hero-copy">Meet the farmers behind your food. Find freshly picked produce, grown with care and ready for your table.</p>
            <div className="hero-actions">
              <button className="button button-dark" onClick={() => document.getElementById("marketplace")?.scrollIntoView({ behavior: "smooth" })}>
                Explore the harvest <ArrowRight size={16} />
              </button>
              {!isFarmer && <button className="text-link" onClick={() => user ? setNotice("You're all set to discover your local harvest.") : openAuth("register")}>I&apos;m a farmer <ArrowRight size={14} /></button>}
            </div>
            <div className="hero-trust">
              <div className="avatar-stack"><span>🌾</span><span>👩🏽‍🌾</span><span>🥕</span><span>👨🏻‍🌾</span></div>
              <span><strong>Grown by real people.</strong><br />Loved by local communities.</span>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-image" role="img" aria-label="Fresh farm vegetables and produce">
              <div className="photo-stamp"><span>GOODNESS,</span><strong>GROWN<br />CLOSE BY.</strong><Leaf size={24} /></div>
            </div>
            <div className="hero-note"><span className="note-icon"><Sprout size={18} /></span><span><strong>Picked with care</strong><small>Never far from your door</small></span><ArrowRight size={16} /></div>
            <span className="hero-scribble">Straight from the source <ArrowDownUp size={15} /></span>
          </div>
          <div className="hero-sunburst" aria-hidden="true">✳</div>
        </section>}

        {isCustomerPage && (
          <section className="role-hero customer-hero">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> YOUR NEIGHBORHOOD MARKET</div>
              <h1>Good food,<br /><span>closer to home.</span></h1>
              <p className="hero-copy">Discover what’s fresh nearby, meet the farmers who grow it, and bring a little more local to your table.</p>
              <button className="button button-dark" onClick={() => document.getElementById("marketplace")?.scrollIntoView({ behavior: "smooth" })}>
                Browse today&apos;s harvest <ArrowRight size={16} />
              </button>
            </div>
            <div className="role-hero-art customer-art" aria-hidden="true"><span>🥕</span><span>🍅</span><span>🥬</span><span>🥖</span><Sprout size={25} /></div>
          </section>
        )}

        {isFarmerPage && (
          <section className="role-hero farmer-hero">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> THE FARMER&apos;S CORNER</div>
              <h1>{isFarmer ? <>Welcome to<br /><span>your farm stand.</span></> : <>Good things grow<br /><span>better together.</span></>}</h1>
              <p className="hero-copy">{isFarmer
                ? "Your farm, your listings, your community. Keep your harvest up to date and help your neighbors find the good things you grow."
                : "Share your harvest with your community. Join Harvest Hub as a farmer to publish and manage your own produce listings."}</p>
              {isFarmer
                ? <button className="button button-dark" onClick={openCreate}><Plus size={17} /> Add a listing</button>
                : <div className="hero-actions"><button className="button button-dark" onClick={() => openAuth("register", "farmer")}>Join as a farmer <ArrowRight size={16} /></button><button className="text-link" onClick={() => openAuth("login")}>Already a member? Log in</button></div>}
            </div>
            <div className="role-hero-art farmer-art" aria-hidden="true"><Tractor size={70} strokeWidth={1.1} /><span>GROWN<br />WITH CARE</span><Wheat size={33} strokeWidth={1.2} /></div>
          </section>
        )}

        {(page === "home" || isCustomerPage) && <section className="values-strip" id="our-promise">
          <div><span className="value-icon"><Sprout size={17} /></span><span><strong>Grown with care</strong><small>By the people who know the land</small></span></div>
          <span className="value-divider" />
          <div><span className="value-icon"><MapPin size={17} /></span><span><strong>Right around the corner</strong><small>Local farms, closer tables</small></span></div>
          <span className="value-divider" />
          <div><span className="value-icon"><BadgeCheck size={17} /></span><span><strong>Fair for everyone</strong><small>Better for growers and eaters</small></span></div>
          <span className="strip-note">A little more local. A lot more lovely.</span>
        </section>}

        {(page === "home" || isCustomerPage || isFarmer) && <section className={`market-section ${isFarmerPage ? "farmer-market" : ""}`} id="marketplace">
          <div className="market-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> {isMine ? "YOUR FARM INVENTORY" : "THE LOCAL MARKETPLACE"}</div>
              <h2>{isMine ? "Your listings." : isCustomerPage ? "Fresh finds near you." : "A good day to eat local."}</h2>
              <p>{isMine ? "Add, update, or remove the produce you’re offering to your community." : subtitle}</p>
            </div>
            {isMine && (
              <button className="button button-green" onClick={openCreate}><Plus size={17} /> Add a listing</button>
            )}
          </div>

          {!isMine && (
            <>
              <div className="market-toolbar">
                <div className="category-tabs" role="group" aria-label="Filter by category">
                  {categories.map((item) => (
                    <button key={item} className={category === item ? "category-tab selected" : "category-tab"} onClick={() => setCategory(item)}>
                      {item === "All produce" && <ShoppingBasket size={15} />}
                      {item}
                    </button>
                  ))}
                </div>
                <div className="filters">
                  <label className="search-box"><Search size={17} /><input aria-label="Search produce" placeholder="Find something fresh..." value={search} onChange={(event) => setSearch(event.target.value)} /><kbd>⌘ K</kbd></label>
                  <label className="location-box"><MapPin size={16} /><input aria-label="Filter by location" placeholder="Your area" value={location} onChange={(event) => setLocation(event.target.value)} /><ChevronDown size={14} /></label>
                </div>
              </div>
              <div className="results-row"><span><strong>{loading ? "…" : products.length}</strong> fresh finds for you</span><span className="sorted-label"><ArrowDownUp size={13} /> Newest first</span></div>
            </>
          )}

          {isFarmerPage && isFarmer && (
            <div className="farmer-stats">
              <article><span>ACTIVE LISTINGS</span><strong>{loading ? "—" : products.length}</strong><small>Fresh finds on your stand</small></article>
              <article><span>AVAILABLE PRODUCE</span><strong>{loading ? "—" : products.reduce((total, item) => total + item.quantity, 0)}</strong><small>Total quantity across listings</small></article>
              <article><span>LOCAL IMPACT</span><strong><Sprout size={22} /></strong><small>Helping your community eat local</small></article>
            </div>
          )}
          {isFarmerPage && isFarmer && (
            <section className="farmer-payment-settings" aria-labelledby="farmer-payment-title">
              <div>
                <h3 id="farmer-payment-title"><Smartphone size={17} /> UPI payments</h3>
                <p>Customers pay directly to this UPI ID and send you a payment confirmation request.</p>
              </div>
              <form onSubmit={saveFarmerUpi}>
                <label htmlFor="farmer-upi-id">Your UPI ID</label>
                <div className="farmer-upi-form">
                  <input id="farmer-upi-id" value={farmerUpiId} onChange={(event) => setFarmerUpiId(event.target.value)} placeholder="name@bank" required maxLength={100} />
                  <button className="button button-green" disabled={upiSaving}>{upiSaving ? "Saving..." : "Save UPI ID"}</button>
                </div>
              </form>
            </section>
          )}
          {isFarmerPage && isFarmer && (
            <section className="orders-panel" aria-labelledby="orders-title">
              <div className="orders-heading">
                <div><Bell size={18} /><div><h3 id="orders-title">Customer orders</h3><p>Review payment reports in your UPI app before confirming.</p></div></div>
                <span className={unreadOrderCount ? "notification-count has-unread" : "notification-count"}>
                  {unreadOrderCount ? `${unreadOrderCount} new` : `${farmerOrders.length} total`}
                </span>
              </div>
              {farmerOrders.length ? (
                <div className="orders-list">
                  {farmerOrders.map((order) => (
                    <article className={!order.notificationReadAt ? "farmer-order unread" : "farmer-order"} key={order.id}>
                      <span className="order-buyer-avatar">{(order.customer?.name || "C").charAt(0).toUpperCase()}</span>
                      <div className="order-details">
                        <div className="order-title-row"><h4>{order.customer?.name || "Customer"} bought {order.productName}</h4><strong>{money(order.amountPaise / 100)}</strong></div>
                        <p>{order.quantity} {order.unit} · {order.customer?.email || "Customer contact unavailable"} · {new Date(order.createdAt).toLocaleString()}</p>
                        <span className={`order-status order-status-${order.paymentStatus}`}>{order.paymentStatus.replaceAll("_", " ")}</span>
                        {order.transactionReference && <p>UPI reference: <strong>{order.transactionReference}</strong></p>}
                        {order.paymentStatus === "awaiting_payment" && <span className="stock-attention">Order created. Waiting for the customer to report payment.</span>}
                        {order.paymentStatus === "awaiting_confirmation" && (
                          <div className="order-actions">
                            <button className="button button-green" disabled={busy} onClick={() => updateOrderStatus(order.id, "paid")}>Confirm payment</button>
                            <button className="button button-reject" disabled={busy} onClick={() => updateOrderStatus(order.id, "rejected")}>Reject payment</button>
                          </div>
                        )}
                        {order.paymentStatus === "paid" && !order.stockFulfilled && <span className="stock-attention">Payment confirmed, but stock was unavailable. Contact the customer.</span>}
                      </div>
                      {!order.notificationReadAt && <button className="mark-read-button" onClick={() => markOrderRead(order.id)}>Mark read</button>}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="orders-empty"><Bell size={18} /><span>No customer orders yet. New orders will appear here.</span></div>
              )}
            </section>
          )}
          <div className="product-grid">
            {loading ? (
              <div className="empty-state"><span className="loader" /><p>Gathering the freshest finds...</p></div>
            ) : products.length ? products.map((product, index) => (
              <article className={`product-card product-card-${index % 4}`} key={product._id}>
                <div className="product-image">
                  <span className="produce-emoji" aria-hidden="true">{categoryIcons[product.category] || "🧺"}</span>
                  <span className="fresh-label"><span /> Fresh pick</span>
                  {isMine && <div className="card-actions"><button aria-label={`Edit ${product.name}`} onClick={() => openEdit(product)}><span>Edit</span></button><button aria-label={`Delete ${product.name}`} onClick={() => deleteProduct(product)}><X size={15} /></button></div>}
                  <span className="image-category">{product.category}</span>
                </div>
                <div className="product-info">
                  <div className="product-title-row"><h3>{product.name}</h3><span className="product-price">{money(product.price)}<small> / {product.unit}</small></span></div>
                  <p className="product-description">{product.description || "Fresh from the farm, grown with care."}</p>
                  <div className="product-meta"><span><MapPin size={13} /> {product.location}</span><span><span className="quantity-dot" /> {product.quantity} {product.unit} available</span></div>
                  <div className="farmer-row"><span className="farmer-avatar">{(product.farmer?.name || "F").charAt(0).toUpperCase()}</span><span>Grown by <strong>{product.farmer?.name || "Local farmer"}</strong></span><ShieldCheck size={15} className="verified-icon" /></div>
                  {!isMine && page !== "farmer" && (
                    <button
                      className="button button-buy"
                      disabled={product.quantity <= 0 || !product.farmer?.upiId}
                      onClick={() => openPurchase(product)}
                    >
                      <ShoppingBasket size={14} /> {product.quantity <= 0 ? "Sold out" : product.farmer?.upiId ? "Buy now" : "UPI not set up"}
                    </button>
                  )}
                </div>
              </article>
            )) : (
              <div className="empty-state">
                <span className="empty-icon">{isMine ? <Wheat size={26} /> : <ShoppingBasket size={26} />}</span>
                <h3>{isMine ? "Your farm stand is waiting." : "Nothing on the shelf just yet."}</h3>
                <p>{isMine ? "Add your first listing and let your neighbors know what's fresh." : "Try a different search or check back soon for the next harvest."}</p>
                {isMine && <button className="button button-green" onClick={openCreate}><Plus size={16} /> Add your first listing</button>}
              </div>
            )}
          </div>
        </section>}

        {page === "home" && <section className="how-section" id="how-it-works">
          <div className="how-heading"><div className="eyebrow"><span className="eyebrow-line" /> SIMPLE AS IT SHOULD BE</div><h2>Good things grow<br /><span>when we grow together.</span></h2></div>
          <div className="steps">
            <div className="step"><span className="step-number">01</span><span className="step-icon"><Search size={19} /></span><h3>Find your fresh</h3><p>Explore what's growing around you. Every listing comes from a local farmer.</p></div>
            <div className="step-connector" />
            <div className="step"><span className="step-number">02</span><span className="step-icon"><CircleHelp size={19} /></span><h3>Get to know your grower</h3><p>Know where your food comes from and the hands that nurtured it.</p></div>
            <div className="step-connector" />
            <div className="step"><span className="step-number">03</span><span className="step-icon"><ShoppingBasket size={19} /></span><h3>Bring good home</h3><p>Choose just-picked produce at a fair price. Good for you, good for your farmer.</p></div>
          </div>
          <div className="how-footer"><span><Leaf size={16} /> A shorter journey from soil to supper. That&apos;s a win all around.</span><button onClick={() => document.getElementById("marketplace")?.scrollIntoView({ behavior: "smooth" })}>Take a look around <ArrowRight size={14} /></button></div>
        </section>}
      </main>

      <footer className="site-footer">
        <a className="brand footer-brand" href="#"><span className="brand-mark"><Leaf size={19} /></span><span>harvest<span className="brand-light">hub</span><small>GROWN TOGETHER</small></span></a>
        <p>Rooted in community. Made for everyone who loves good food.</p>
        <span>© 2026 Harvest Hub <span className="footer-heart">♥</span></span>
      </footer>

      {notice && <div className="toast" role="status"><Check size={16} />{notice}<button aria-label="Dismiss" onClick={() => setNotice("")}><X size={15} /></button></div>}

      {authOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAuthOpen(false); }}>
          <section className="modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
            <button className="modal-close" aria-label="Close" onClick={() => setAuthOpen(false)}><X size={19} /></button>
            <span className="modal-icon"><Sprout size={22} /></span>
            <div className="eyebrow"><span className="eyebrow-line" /> GROWN TOGETHER</div>
            <h2 id="auth-title">{authMode === "login" ? "Welcome back." : "Come on in."}</h2>
            <p>{authMode === "login" ? "Good food and good people are right this way." : "Join your local community of growers and good-food lovers."}</p>
            <form onSubmit={handleAuth}>
              {authMode === "register" && <label>Your name<input name="name" required minLength="2" maxLength="80" placeholder="e.g. Asha Patel" autoComplete="name" /></label>}
              <label>Email address<input name="email" type="email" required maxLength="254" placeholder="you@example.com" autoComplete="email" /></label>
              <label>Password<input name="password" type="password" required minLength="8" placeholder="At least 8 characters" autoComplete={authMode === "login" ? "current-password" : "new-password"} /></label>
              {authMode === "register" && <label>I&apos;m joining as<select name="role" value={registrationRole} onChange={(event) => setRegistrationRole(event.target.value)}><option value="customer">A customer — I love local food</option><option value="farmer">A farmer — I grow good things</option></select></label>}
              {formError && <p className="form-error" role="alert">{formError}</p>}
              <button className="button button-dark modal-submit" disabled={busy}>{busy ? "One moment..." : authMode === "login" ? "Log in" : "Create my account"} <ArrowRight size={15} /></button>
            </form>
            <div className="auth-switch">{authMode === "login" ? "New around here?" : "Already part of the neighborhood?"}<button onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setFormError(""); }}>{authMode === "login" ? "Create an account" : "Log in"}</button></div>
          </section>
        </div>
      )}

      {formOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormOpen(false); }}>
          <section className="modal listing-modal" role="dialog" aria-modal="true" aria-labelledby="listing-title">
            <button className="modal-close" aria-label="Close" onClick={() => setFormOpen(false)}><X size={19} /></button>
            <span className="modal-icon"><Tractor size={21} /></span>
            <div className="eyebrow"><span className="eyebrow-line" /> YOUR FARM STAND</div>
            <h2 id="listing-title">{editing ? "A little update." : "Share your harvest."}</h2>
            <p>Let your neighbors know what's fresh from your farm.</p>
            <form onSubmit={saveProduct}>
              <label>Produce name<input required maxLength="100" placeholder="e.g. Heirloom tomatoes" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
              <div className="form-row">
                <label>Category<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{categories.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label>
                <label>Location<input required maxLength="120" placeholder="Town or neighborhood" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label>
              </div>
              <div className="form-row">
                <label>Quantity<input type="number" required min="0.01" step="0.01" placeholder="10" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label>
                <label>Unit<select value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })}>{["kg", "g", "lb", "bunch", "piece", "dozen", "litre"].map((unit) => <option key={unit}>{unit}</option>)}</select></label>
                <label>Price (₹)<input type="number" required min="0.01" step="0.01" placeholder="120" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></label>
              </div>
              <label>A little about it <span className="optional-label">OPTIONAL</span><textarea rows="3" maxLength="500" placeholder="How is it grown? What makes this harvest special?" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
              {formError && <p className="form-error" role="alert">{formError}</p>}
              <button className="button button-dark modal-submit" disabled={busy}>{busy ? "Saving..." : editing ? "Save changes" : "Publish listing"} <ArrowRight size={15} /></button>
            </form>
          </section>
        </div>
      )}

      {purchaseOpen && purchaseProduct && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) closePurchase(); }}>
          <section className="modal purchase-modal" role="dialog" aria-modal="true" aria-labelledby="purchase-title">
            <button className="modal-close" aria-label="Close" disabled={busy} onClick={closePurchase}><X size={19} /></button>
            <span className="modal-icon"><ShoppingBasket size={21} /></span>
            <div className="eyebrow"><span className="eyebrow-line" /> STRAIGHT FROM THE FARM</div>
            <h2 id="purchase-title">{purchaseOrder ? "Pay your farmer." : "Good choice."}</h2>
            <p>{purchaseProduct.name} from {purchaseProduct.farmer?.name || "your local farmer"}, grown in {purchaseProduct.location}.</p>
            {!purchaseOrder ? (
              <form onSubmit={completePurchase}>
                <label>How much would you like?
                  <div className="purchase-quantity">
                    <input
                      aria-label="Purchase quantity"
                      type="number"
                      required
                      min="0.01"
                      max={purchaseProduct.quantity}
                      step="0.01"
                      value={purchaseQuantity}
                      onChange={(event) => setPurchaseQuantity(event.target.value)}
                    />
                    <span>{purchaseProduct.unit} available: {purchaseProduct.quantity}</span>
                  </div>
                </label>
                <div className="purchase-total"><span>Total</span><strong>{money(purchaseProduct.price * (Number(purchaseQuantity) || 0))}</strong></div>
                <p className="checkout-note"><ShieldCheck size={15} /> Pay directly to the farmer using UPI.</p>
                {purchaseError && <p className="form-error" role="alert">{purchaseError}</p>}
                <button className="button button-dark modal-submit" disabled={busy || Number(purchaseQuantity) <= 0 || Number(purchaseQuantity) > purchaseProduct.quantity}>
                  {busy ? "Preparing payment..." : <>Continue to UPI payment <ArrowRight size={15} /></>}
                </button>
              </form>
            ) : purchaseOrder.paymentStatus === "awaiting_payment" ? (
              <div className="upi-checkout">
                <div className="purchase-total"><span>Pay exactly</span><strong>{money(purchaseOrder.amountPaise / 100)}</strong></div>
                <img src={paymentQr} alt="UPI payment QR code" />
                <p>Scan with any UPI app and pay <strong>{purchaseOrder.farmerUpiId}</strong>.</p>
                <a className="button button-green upi-open-link" href={`upi://pay?${new URLSearchParams({
                  pa: purchaseOrder.farmerUpiId,
                  pn: purchaseOrder.farmerName,
                  am: (purchaseOrder.amountPaise / 100).toFixed(2),
                  cu: "INR",
                  tn: `Harvest Hub ${purchaseOrder.orderId}`,
                }).toString()}`}>Open in UPI app <ArrowRight size={15} /></a>
                <label>Transaction reference <span className="optional-label">OPTIONAL</span>
                  <input value={transactionReference} onChange={(event) => setTransactionReference(event.target.value)} minLength={4} maxLength={64} pattern="[a-zA-Z0-9-]+" placeholder="UPI transaction ID" />
                </label>
                <p className="checkout-note">Only report payment after completing it. The farmer will verify it manually.</p>
                {purchaseError && <p className="form-error" role="alert">{purchaseError}</p>}
                <button className="button button-dark modal-submit" disabled={busy} onClick={reportPayment}>{busy ? "Sending..." : "I have paid"}</button>
              </div>
            ) : (
              <div className="upi-checkout">
                <span className="payment-confirmation-icon"><Check size={24} /></span>
                <p>Your payment report was sent to the farmer. Your order is waiting for manual confirmation.</p>
                <button className="button button-dark modal-submit" onClick={closePurchase}>Done</button>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
