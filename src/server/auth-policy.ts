export type Role = "ADMIN" | "OPERATOR";

/**
 * Permissões por ação (RF-15). O operador cuida do balcão; abrir/encerrar evento e
 * montar o cardápio (cadastros) são do administrador.
 */
const PERMISSIONS = {
  "order.create": ["ADMIN", "OPERATOR"],
  "order.status": ["ADMIN", "OPERATOR"],
  "order.cancel": ["ADMIN", "OPERATOR"],
  "order.reprint": ["ADMIN", "OPERATOR"],
  // Receber no balcão o que a pessoa já pegou ("A receber").
  "payment.receive": ["ADMIN", "OPERATOR"],
  "stock.restock": ["ADMIN", "OPERATOR"],
  "menu.soldOut": ["ADMIN", "OPERATOR"],
  "menu.edit": ["ADMIN"],
  "event.open": ["ADMIN"],
  "event.close": ["ADMIN"],
  // Painel administrativo (RF-16)
  "finance.view": ["ADMIN"],
  "finance.settle": ["ADMIN"],
  "catalog.manage": ["ADMIN"],
  "users.manage": ["ADMIN"],
  "settings.manage": ["ADMIN"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}
