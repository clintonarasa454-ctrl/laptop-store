# Role-Based Access Control (RBAC) Implementation

## Overview
This document outlines the comprehensive RBAC system implemented in the laptop-store application. The system enforces strict role-based permissions at both the backend (API) and frontend (UI) layers.

## Role Definitions

### Admin Role
- Full system access
- Can manage users (create, update, suspend, delete)
- Can manage all products, categories, banners, promotions
- Can manage settings and configurations
- Can view all reports and analytics

### Manager Role
- Can view users (read-only, cannot modify)
- Can manage products (create, update, but NOT delete)
- Can manage categories (create, update, but NOT delete)
- Can manage banners and promotions (create, update, but NOT delete)
- Can access analytics and reports
- Cannot perform destructive operations

### User Role
- Customer account
- Can manage own profile
- Can view products
- Can make purchases
- Limited dashboard access

## Backend RBAC Implementation

### TRPC Procedure Definitions
Located in `server/_core/trpc.ts`:

```typescript
// Admin-only operations
export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({ ctx });
  }),
);

// Manager + Admin operations
const managerProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "manager") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Manager or Admin access required" });
  }
  return next({ ctx });
});
```

### Protected Operations

#### User Management (adminProcedure)
- **upsertUser**: Create or update users
  - File: `server/routers.ts` line 3272
  - Restriction: Admins only
  - Managers cannot create/edit users

- **toggleUserSuspension**: Suspend/unsuspend user accounts
  - File: `server/routers.ts` line 3363
  - Restriction: Admins only
  - Managers cannot suspend users

- **deleteUser**: Permanently delete user accounts
  - File: `server/routers.ts` line 3372
  - Restriction: Admins only
  - Returns 403 Forbidden if manager tries to access

#### Product Management
- **upsertProduct**: Create/update products (managerProcedure)
  - File: `server/routers.ts` line 3468
  - Allowed: Admins and Managers

- **deleteProduct**: Delete products (adminProcedure)
  - File: `server/routers.ts` line 3450
  - Restriction: Admins only

#### Category Management
- **upsertCategory**: Create/update categories (managerProcedure)
  - File: `server/routers.ts` line 3525
  - Allowed: Admins and Managers

- **deleteCategory**: Delete categories (adminProcedure)
  - File: `server/routers.ts` line 3551
  - Restriction: Admins only

#### Banner Management
- **upsertBanner**: Create/update banners (managerProcedure)
  - File: `server/routers.ts` line 3762
  - Allowed: Admins and Managers

- **deleteBanner**: Delete banners (adminProcedure)
  - File: `server/routers.ts` line 3769
  - Restriction: Admins only

#### Promotion Management
- **upsertPromotion**: Create/update promotions (managerProcedure)
  - Allowed: Admins and Managers

- **deletePromotion**: Delete promotions (adminProcedure)
  - File: `server/routers.ts` line 3798
  - Restriction: Admins only

## Frontend RBAC Implementation

### AdminUsers.tsx (User Management Page)
Located: `client/src/pages/AdminUsers.tsx`

#### Updated Restrictions (May 8, 2026):
```tsx
{/* Only admins can suspend/unsuspend users */}
{user?.role === "admin" && (
  <Button onClick={() => toggleSuspension.mutate(...)}>
    {selectedUser.suspended ? "Restore Access" : "Suspend Access"}
  </Button>
)}

{/* Only admins can delete users - managers have read-only access */}
{user?.role === "admin" && (
  <Button variant="destructive" onClick={() => deleteUser.mutate(...)}>
    Delete User
  </Button>
)}
```

### Key Features:
- Managers can view all users (name, email, role, status, dates)
- Managers can reset passwords
- Managers can send emails to users
- Managers CANNOT:
  - Delete users
  - Suspend/unsuspend users
  - Create new users
  - Edit user roles or information

### Other Admin Pages
The following pages already implement proper RBAC:
- **AdminProducts.tsx**: Delete button restricted to admins
- **AdminCategories.tsx**: Delete button restricted to admins
- **AdminBanners.tsx**: Delete button restricted to admins
- **AdminPromotions.tsx**: Delete button restricted to admins

## Security Best Practices Applied

### 1. Defense in Depth
- Backend checks are MANDATORY (cannot be bypassed)
- Frontend checks provide UX guidance and prevent accidental clicks
- Both layers work together for complete security

### 2. Fail-Safe Defaults
- If a manager tries to access a forbidden operation directly (e.g., via API call):
  - Backend immediately returns 403 Forbidden
  - Frontend doesn't show the option, preventing the attempt

### 3. Explicit Permission Model
- Each operation explicitly checks if the user's role is allowed
- No implicit permissions or inheritance that could be overlooked
- Clear error messages for unauthorized attempts

### 4. Least Privilege
- Managers get only the access they need
- Cannot accidentally delete critical data
- Read-only operations are freely available

## Testing RBAC Implementation

### Test Case 1: Manager Cannot Delete Users
1. Log in as a manager
2. Go to Users Management (`/manager/users`)
3. Click on any user
4. Verify: Delete button is NOT visible
5. If attempted via API, backend returns 403

### Test Case 2: Admin Can Delete Users
1. Log in as an admin
2. Go to Users Management (`/admin/users`)
3. Click on any user
4. Verify: Delete button IS visible
5. Can click and delete successfully

### Test Case 3: Manager Can View Users
1. Log in as a manager
2. Go to Users Management (`/manager/users`)
3. Verify: Can see all user list, search, filter
4. Verify: Can reset passwords, send emails
5. Verify: Cannot modify or delete users

### Test Case 4: Manager Can Manage Products
1. Log in as a manager
2. Go to Products Management (`/manager/products`)
3. Verify: Can create new products
4. Verify: Can update existing products
5. Verify: Can view products
6. Verify: Delete button is NOT visible (admin only)

## Audit Trail
- All user modifications are logged
- API calls include authentication context
- Failed authorization attempts are tracked

## Future Enhancements
1. Add granular permissions (e.g., "can_edit_products" flag)
2. Implement role-based API rate limiting
3. Add audit logging for all admin actions
4. Implement temporary elevated permissions with approval workflow
5. Add permission inheritance for custom roles

## References
- Backend RBAC: `server/_core/trpc.ts`
- Router Configuration: `server/routers.ts`
- Frontend Routes: `client/src/App.tsx`
- User Management UI: `client/src/pages/AdminUsers.tsx`
- Auth Context: `client/src/pages/useAuth.tsx`
