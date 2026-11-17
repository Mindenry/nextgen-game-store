export const PERMISSIONS = {
  dashboardView: "dashboard.view",
  analyticsView: "analytics.view",
  ordersView: "orders.view",
  ordersManage: "orders.manage",
  ordersRefund: "orders.refund",
  productsView: "products.view",
  productsManage: "products.manage",
  categoriesManage: "categories.manage",
  inventoryView: "inventory.view",
  inventoryManage: "inventory.manage",
  inventoryReveal: "inventory.reveal",
  topupView: "topup.view",
  topupManage: "topup.manage",
  topupProcess: "topup.process",
  paymentsView: "payments.view",
  paymentsVerify: "payments.verify",
  paymentsProviders: "payments.providers",
  walletAdjust: "wallet.adjust",
  customersView: "customers.view",
  customersManage: "customers.manage",
  couponsManage: "coupons.manage",
  promotionsManage: "promotions.manage",
  bannersManage: "banners.manage",
  reviewsManage: "reviews.manage",
  supportView: "support.view",
  supportReply: "support.reply",
  notificationsManage: "notifications.manage",
  staffManage: "staff.manage",
  rolesManage: "roles.manage",
  auditView: "audit.view",
  settingsManage: "settings.manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export type RoleId = "customer" | "support" | "finance" | "product_manager" | "admin" | "super_admin";

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  roleId: RoleId;
  roleName: string;
  status: "active" | "suspended" | "deleted";
  emailVerified: boolean;
  permissions: string[];
}

export class AuthorizationError extends Error {
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function isStaff(user: Pick<SessionUser, "roleId"> | null | undefined): boolean {
  return Boolean(user && user.roleId !== "customer");
}

export function can(user: Pick<SessionUser, "permissions"> | null | undefined, permission: Permission | string): boolean {
  return Boolean(user?.permissions.includes(permission));
}

export function requirePermission(
  user: Pick<SessionUser, "permissions"> | null | undefined,
  permission: Permission | string,
): void {
  if (!can(user, permission)) throw new AuthorizationError();
}

export const ROLE_LABELS: Record<RoleId, string> = {
  customer: "Customer",
  support: "Support",
  finance: "Finance",
  product_manager: "Product Manager",
  admin: "Admin",
  super_admin: "Super Admin",
};
