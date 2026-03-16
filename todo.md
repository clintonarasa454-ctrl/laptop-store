# Online Computer & Laptop Store - TODO

## Phase 1: Database Schema & Global Setup
- [x] Design and apply full database schema (products, categories, cart, orders, payments, addresses)
- [x] Set up global theme (elegant light style, Space Grotesk + Inter, brand color)
- [x] Build top navigation with cart icon, auth state, and category links
- [x] Build footer component

## Phase 2: Product Catalog
- [x] Homepage with hero section, featured products, and category cards
- [x] Category listing page with filters (price, brand, specs)
- [x] Product detail page (images, specs, price, stock, ratings, add to cart)
- [x] Search functionality

## Phase 3: Shopping Cart
- [x] Cart page with item list, quantities, subtotal, total
- [x] Add/remove/update cart items
- [x] Cart persistence for authenticated users (DB-backed)
- [x] Guest cart (localStorage) merged on login

## Phase 4: Auth-Gated Checkout
- [x] Checkout auth gate page (redirect if not logged in)
- [x] Auth flow integration with checkout redirect

## Phase 5: Multi-Step Checkout
- [x] Shipping information step (name, phone, address, city, postal, country)
- [x] Save address for future use
- [x] Order review step (items, quantities, prices, shipping cost, total)
- [x] Payment method selection step (M-Pesa, PayPal, Stripe)

## Phase 6: Payment Integrations
- [x] M-Pesa STK Push integration (phone number input, push prompt, verification)
- [x] PayPal payment integration (redirect to PayPal checkout)
- [x] Stripe card payment integration (card number, expiry, CVV)
- [x] Payment confirmation and order creation

## Phase 7: Order Management & Customer Dashboard
- [x] Order confirmation page (order ID, status, delivery estimate, summary)
- [x] Customer dashboard (overview, orders, tracking, addresses, account)
- [x] Order tracking page (stages: placed, confirmed, processing, shipped, out for delivery, delivered)

## Phase 8: Admin Panel
- [x] Admin dashboard overview (stats, recent orders)
- [x] Order management (list, filter, update status)
- [x] Payment verification panel (manual verify button)
- [x] Shipping status updates
- [x] Customer management (list, view details)
- [x] Product management (add, edit, delete products)

## Phase 9: Polish & Finalization
- [x] Seed database with 14 sample products (laptops, desktops, accessories, monitors, components)
- [x] UI polish and responsive design
- [x] Vitest unit tests (14 tests passing)
- [x] Final checkpoint and delivery


## Bug Fixes
- [x] Fix duplicate route keys in App.tsx (/dashboard, /dashboard/orders)
- [x] Fix featured product query - handle boolean/integer mismatch in TiDB


## Admin Panel Rebuild (Comprehensive)
- [x] Admin layout with sidebar navigation (Dashboard, Products, Orders, Payments, Customers, Content, Settings, Back to Store)
- [x] Admin authentication guard and role-based access control
- [x] Dashboard overview with summary cards (Revenue, Orders, Customers, Products)
- [x] Analytics charts (monthly revenue, product performance)
- [x] Best-selling products list and recent orders table
- [x] Products management (add, edit, delete, image upload, pricing, inventory, categories, specs)
- [x] Orders management (view, filter, update status, shipping info, invoices, payment tracking)
- [x] Payments management (overview, transactions table, refunds, payment method toggles)
- [x] Payment method configuration (M-Pesa, PayPal, Stripe, Bank Transfer, Cash on Delivery)
- [x] Customers management (profiles, order history, edit info, suspend/activate, search)
- [x] Content management (banners, promotions, featured products, announcements)
- [x] Settings: General (name, description, contact, address, currency, timezone)
- [x] Settings: Appearance (logo, favicon, colors, banners)
- [x] Settings: Payment (gateway credentials)
- [x] Settings: Shipping (delivery fees, zones, estimates)
- [x] Settings: Email (SMTP, order confirmations, shipping notifications)
- [x] Settings: Security (2FA, login limits, CAPTCHA)
- [x] Settings: Social Media (Facebook, Instagram, Twitter, LinkedIn, YouTube, TikTok)
- [x] Settings: Backup (database backups, auto-backup options)
- [x] Responsive design for desktop and tablet
- [x] Polish UI with professional styling

## Additional Fixes
- [x] Fix remaining duplicate dashboard route keys by consolidating to single parameterized route
