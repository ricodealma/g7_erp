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
  "stock.restock": ["ADMIN", "OPERATOR"],
  "menu.soldOut": ["ADMIN", "OPERATOR"],
  "menu.edit": ["ADMIN"],
  "event.open": ["ADMIN"],
  "event.close": ["ADMIN"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}
