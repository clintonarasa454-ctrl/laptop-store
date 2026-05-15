# Manager Role Analysis

## 1. DATABASE & TYPE DEFINITIONS

### Role Definition (Enum)
- **File**: [drizzle/schema.ts](drizzle/schema.ts#L20)
- **Line 20**: `export const userRoleEnum = pgEnum("user_role", ["user", "manager", "admin"]);`
- Defines the database enum with three roles: `user`, `manager`, `admin`

### User Table Role Field
- **File**: [drizzle/schema.ts](drizzle/schema.ts#L44-L54)
- **Lines 44-54**: User table includes role field that defaults to "user"
- Manager role is assigned manually via database or through user creation procedures

### Deletion Requests Table
- **File**: [drizzle/schema.ts](drizzle/schema.ts#L551-L562)
- **Lines 551-562**: Managers can request deletion, admins approve/reject
  - `managerId`: References the manager making the request
  - `status`: Can be "pending", "approved", or "rejected"
  - `adminId`: References the admin who approved/rejected

### Type Export
- **File**: [shared/types.ts](shared/types.ts#L1-L6)
- Exports all types from drizzle schema including User type with role field

### Schema Enum Definition
- **File**: [server/routers.ts](server/routers.ts#L3257)
- **Line 3257**: Role creation validation: `role: z.enum(["user", "manager", "admin"])`

---

## 2. TRPC PROCEDURE GUARDS

### Manager Procedure Definition
- **File**: [server/routers.ts](server/routers.ts#L164-L169)
- **Lines 164-169**: Defines `managerProcedure` middleware
  ```
  const managerProcedure = protectedProcedure.use(({ ctx, next }) => {
    if (ctx.user.role !== "admin" && ctx.user.role !== "manager") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Manager or Admin access required" });
    }
    return next({ ctx });
  });
  ```
- **Permission**: Both admin AND manager can access

### Admin Procedure (for comparison)
- **File**: [server/routers.ts](server/routers.ts#L155-L162)
- **Lines 155-162**: Admin-only procedures for deletion request reviews

---

## 3. MANAGER PROCEDURES (ACCESSED VIA managerProcedure)

### A. Dashboard & Analytics
1. **stats** - [Line 2852](server/routers.ts#L2852)
   - Query admin dashboard statistics
   - Returns baseStats with AI revenue overlay

2. **notifications** - [Line 2867](server/routers.ts#L2867)
   - Query system notifications (low stock, performance alerts, etc.)
   - Runs `notificationQuery` to collect various system alerts

3. **adminChat** - [Line 783](server/routers.ts#L783)
   - Mutation for AI-powered admin chat
   - Uses Groq API for natural language queries
   - Has access to sales stats, product info, customer data

### B. Marketing & Campaign Management
1. **broadcastTrendingProducts** - [Line 2951](server/routers.ts#L2951)
   - Mutation to broadcast trending products via email
   - Requires SMTP configuration
   - Uses AI to identify trending products

2. **triggerAIMarketing** - [Line 3016](server/routers.ts#L3016)
   - Mutation to trigger AI marketing campaigns
   - Generates personalized marketing content
   - Sends targeted emails to customers

3. **triggerAutoRestock** - [Line 3068](server/routers.ts#L3068)
   - Mutation to process automatic restock orders
   - No context parameter used

### C. Search & Catalog
1. **globalSearch** - [Line 3073](server/routers.ts#L3073)
   - Query for global search across products, orders, customers, categories
   - Supports pagination with cursor

2. **orders** - [Line 3093](server/routers.ts#L3093)
   - Query all orders with filtering by search/status
   - Input: limit, offset, search string, status

3. **orderDetail** - [Line 3105](server/routers.ts#L3105)
   - Query details for a single order
   - Returns order, items, history, payment, and customer info
   - Input: orderId

### D. Order Management
1. **updateOrderStatus** - [Line 3122](server/routers.ts#L3122)
   - Mutation to update order status
   - Can set tracking number and estimated delivery
   - Sends shipping notifications when status = "shipped"
   - Restrictions: Only admins/managers can cancel orders within 24 hours

2. **verifyPayment** - [Line 3334](server/routers.ts#L3334)
   - Mutation for manual payment verification
   - Creates MANUAL transaction record
   - Updates order status to "payment_confirmed"
   - Updates product stock

### E. Customer Management
1. **customers** - [Line 3207](server/routers.ts#L3207)
   - Query all customers/users with search filtering
   - Input: search string

2. **users** - [Line 3218](server/routers.ts#L3218)
   - Query staff/admin users with search and role filtering
   - Returns: id, name, email, phone, role, createdAt, lastSignedIn
   - Input: search string, role filter

3. **payments** - [Line 3205](server/routers.ts#L3205)
   - Query all payments

### F. Product Management
1. **createProduct** - [Line 3352](server/routers.ts#L3352)
   - Mutation to create new product
   - Input: categoryId, name, slug, description, price, etc.

2. **updateProduct** - [Line 3377](server/routers.ts#L3377)
   - Mutation to update existing product
   - Full product data update

3. **products** - [Line 3410](server/routers.ts#L3410)
   - Query products with search and pagination
   - Input: limit, offset, search

4. **upsertProduct** - [Line 3421](server/routers.ts#L3421)
   - Mutation for insert or update product
   - Comprehensive product details including specifications, tags, featured status

5. **createProductUnits** - [Line 3448](server/routers.ts#L3448)
   - Mutation to create serial-numbered product units
   - Input: productId, array of units with serialNumber, barcode, notes
   - Validates no duplicate serial numbers
   - Max 100 units per request

6. **scanProductUnit** - [Line 3468](server/routers.ts#L3468)
   - Query to scan and retrieve product unit by code
   - Searches by serial number or barcode
   - Returns availability status

### G. Catalog Management
1. **upsertCategory** - [Line 3476](server/routers.ts#L3476)
   - Mutation to insert or update product categories
   - Can manage category hierarchy via parentId
   - Handles image URLs and icons

---

## 4. CLIENT-SIDE ROLE CHECKS

### AdminLayout Component
- **File**: [client/src/components/AdminLayout.tsx](client/src/components/AdminLayout.tsx)
- **Line 100**: Notifications query enabled for admin/manager
  ```
  enabled: !!user && (user.role === "admin" || user.role === "manager")
  ```
- **Line 311**: Photo upload requirement (after forced password change)
  ```
  if (user && user.role === 'manager' && !user.photoId && !user.requiresPasswordChange)
  ```
- **Line 468**: Portal naming varies by role
  ```
  {location.pathname.includes('/manager') ? 'Manager Portal' : 'Staff Portal'}
  ```
- **Line 517-518**: Access guard for admin panel
  ```
  if (user && user.role !== "admin" && user.role !== "manager") { return }
  ```
- **Line 607**: Dynamic title display
  ```
  {user?.role === 'manager' ? 'Manager Portal' : 'Admin Panel'}
  ```

### AdminBrands Component
- **File**: [client/src/pages/AdminBrands.tsx](client/src/pages/AdminBrands.tsx#L57-L60)
- **Lines 57-60**: Managers must request deletion instead of direct deletion
  ```
  if (user?.role === "manager") {
    return setDeletionRequest({ isOpen: true, itemId: brandToRemove, itemName: brandToRemove });
  }
  ```

### AdminCategories Component
- **File**: [client/src/pages/AdminCategories.tsx](client/src/pages/AdminCategories.tsx#L222-L264)
- **Lines 222-264**: Managers must request deletion for categories
  - Both parent and child categories require deletion requests from managers
  - Direct deletion only available to admins

### DeletionRequestModal Component
- **File**: [client/src/components/DeletionRequestModal.tsx](client/src/components/DeletionRequestModal.tsx)
- Managers provide reason for deletion
- Admin reviews and approves/rejects

### EmailTemplateEditor Component
- **File**: [client/src/components/EmailTemplateEditor.tsx](client/src/components/EmailTemplateEditor.tsx#L309-L437)
- **Lines 309-437**: Manager welcome email template
  - Subject: "Welcome to the Manager Portal - {{storeName}}"
  - Sent when new managers are added to system
  - Includes login link to manager portal

### App Router
- **File**: [client/src/App.tsx](client/src/App.tsx#L220)
- **Line 220**: Route for manager portal
  ```
  <Route key="manager-portal" path="/manager" component={AdminDashboard} />
  ```

---

## 5. SPECIAL MANAGER PERMISSIONS & RESTRICTIONS

### What Managers CAN Do:
✅ Access admin dashboard (/admin, /manager routes)
✅ View and update order statuses
✅ Manually verify payments
✅ View all customers and orders
✅ Create, update, delete products
✅ Manage categories and brands
✅ Create product units with serial numbers
✅ Scan product units
✅ Send marketing campaigns (AI marketing, trending products)
✅ Trigger auto-restock
✅ Access admin AI chat
✅ View system notifications
✅ View admin stats and analytics

### What Managers CANNOT Do (Admin-Only):
❌ Permanently delete items (must request deletion)
❌ Review/approve deletion requests
❌ System configuration tasks (likely)

### Deletion Request Workflow:
1. Manager clicks delete on brand/category
2. DeletionRequestModal appears
3. Manager provides reason
4. Request saved to database with managerId + status=pending
5. Admin reviews in admin panel
6. Admin can approve (item deleted) or reject

### Forced Features:
- **Photo Upload**: Managers must upload photo after password change
- **Password Change**: System-generated temporary passwords on creation

---

## 6. EMAIL TEMPLATE IMPORTS
- **File**: [server/routers.ts](server/routers.ts#L90)
- **Line 90**: Imports `getManagerWelcomeEmailHtml`
- Manager-specific email template exists for onboarding

---

## 7. ROUTER CONTEXT & ROLE CHECKS

### Auto-Select Account (Multiple Accounts)
- **File**: [server/routers.ts](server/routers.ts#L1207)
- **Line 1207**: When user has multiple accounts, prefer admin/manager
  ```
  user = accounts.find(a => a.role === "admin" || a.role === "manager") || accounts[0];
  ```

### Order Cancellation Restriction
- **File**: [server/routers.ts](server/routers.ts#L2737)
- **Line 2737**: Only admin/manager can cancel orders outside 24-hour window
  ```
  if (ctx.user?.role !== "admin" && ctx.user?.role !== "manager" && 
      new Date(order.createdAt) < twentyFourHoursAgo)
  ```

---

## 8. USER CREATION WITH MANAGER ROLE
- **File**: [server/routers.ts](server/routers.ts#L3255-L3270)
- **Lines 3255-3270**: `createUser` procedure can set role to manager
  - Can set photoId and warehouseId
  - Email-role combination must be unique
  - Password is optional (auto-generated if not provided)

---

## 9. DELETION REQUEST PROCEDURES

### Request Deletion
- **File**: [server/routers.ts](server/routers.ts#L3787)
- **Line 3787**: Manager submits deletion request via `requestDeletion` mutation

### Get Deletion Requests
- **File**: [server/routers.ts](server/routers.ts#L3798-L3815)
- **Lines 3798-3815**: `getDeletionRequests` (manager procedure)
  - Returns pending/approved/rejected requests
  - Includes manager name and creation date
  - Ordered by most recent first

### Review Deletion Request
- **File**: [server/routers.ts](server/routers.ts#L3818)
- **Line 3818**: `reviewDeletionRequest` (admin-only procedure)
  - Admin can approve or reject
  - Updates status and adminId
  - Performs actual deletion if approved

---

## 10. INCOMPLETE/POTENTIAL IMPROVEMENTS

### No TODOs Found
- No TODO/FIXME comments in manager-related code
- Implementation appears complete

### Potential Enhancement Areas:
1. **Warehouse Assignment**: Users can have warehouseId, but no manager warehouse-scoping visible
   - Managers could potentially be restricted to their warehouse
2. **Role-Based UI**: Some features check role but don't have obvious UI restrictions
3. **Audit Trail**: No explicit audit logging of manager actions

---

## 11. SUMMARY TABLE

| Feature | Access | File | Line |
|---------|--------|------|------|
| Database Enum | Defined | schema.ts | 20 |
| Manager Guard | Protected | routers.ts | 165 |
| Order Management | Yes | routers.ts | 3093-3205 |
| Product Management | Yes | routers.ts | 3352-3468 |
| Analytics/Stats | Yes | routers.ts | 2852 |
| Marketing Campaigns | Yes | routers.ts | 2951-3068 |
| Deletion Requests | Limited (must request) | routers.ts | 3787-3855 |
| Admin Portal Access | Yes | AdminLayout.tsx | 100-518 |
| Manager Portal Route | Yes | App.tsx | 220 |
| Email Welcome | Yes | EmailTemplateEditor.tsx | 309-437 |
| Photo Requirement | Yes | AdminLayout.tsx | 311 |
| Deletion Restrictions | Brands/Categories | AdminBrands.tsx, AdminCategories.tsx | 57-264 |

