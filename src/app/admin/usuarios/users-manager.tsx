"use client";

import { Copy, Plus } from "lucide-react";
import { useState } from "react";

import { Button, Dialog, Field, inputClass } from "@/components/ui";
import { ErrorText, useAction } from "@/components/use-action";
import type { AdminUser } from "@/server/admin/users";

import { createUserAction, resetPasswordAction, updateUserAction } from "../actions";
import { Card } from "../_components/shared";

type Role = AdminUser["role"];
const ROLE_LABEL: Record<Role, string> = { ADMIN: "Administrador", OPERATOR: "Operador" };

function RoleSelect({
  value,
  onChange,
  disabled,
}: {
  value: Role;
  onChange: (role: Role) => void;
  disabled?: boolean;
}) {
  return (
    <select
      className={inputClass}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as Role)}
    >
      <option value="OPERATOR">Operador (balcão)</option>
      <option value="ADMIN">Administrador (balcão + painel)</option>
    </select>
  );
}

/** Senha gerada: exibida uma única vez para o admin repassar à pessoa. */
function PasswordNotice({ email, password, onClose }: { email: string; password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        Senha de acesso de <span className="font-medium">{email}</span>. Anote ou copie agora: ela não será exibida
        novamente.
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 rounded-xl bg-zinc-100 px-3 py-2 font-mono text-lg dark:bg-zinc-800">{password}</code>
        <Button
          aria-label="Copiar senha"
          onClick={() => void navigator.clipboard.writeText(password).then(() => setCopied(true))}
        >
          <Copy size={18} /> {copied ? "Copiada" : "Copiar"}
        </Button>
      </div>
      <Button variant="primary" onClick={onClose}>
        Pronto
      </Button>
    </div>
  );
}

function CreateUserForm({ onCreated }: { onCreated: (email: string, password: string) => void }) {
  const { pending, error, run } = useAction();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("OPERATOR");

  return (
    <div className="flex flex-col gap-4">
      <Field label="Nome">
        <input className={inputClass} value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field label="E-mail">
        <input
          className={inputClass}
          type="email"
          autoComplete="off"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>
      <Field label="Perfil">
        <RoleSelect value={role} onChange={setRole} />
      </Field>
      <p className="text-xs opacity-60">Uma senha será gerada e exibida uma única vez.</p>
      <ErrorText error={error} />
      <Button
        variant="primary"
        disabled={pending || !name.trim() || !email.trim()}
        onClick={() =>
          run(
            () => createUserAction({ name, email, role }),
            ({ password }) => onCreated(email.trim().toLowerCase(), password),
          )
        }
      >
        {pending ? "Criando…" : "Criar usuário"}
      </Button>
    </div>
  );
}

function EditUserForm({
  user,
  isSelf,
  onDone,
  onPassword,
}: {
  user: AdminUser;
  isSelf: boolean;
  onDone: () => void;
  onPassword: (password: string) => void;
}) {
  const { pending, error, run } = useAction();
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState<Role>(user.role);
  const [active, setActive] = useState(user.active);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm opacity-70">{user.email}</p>
      <Field label="Nome">
        <input className={inputClass} value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field label="Perfil">
        <RoleSelect value={role} onChange={setRole} disabled={isSelf} />
      </Field>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-5 accent-amber-500"
          checked={active}
          disabled={isSelf}
          onChange={(event) => setActive(event.target.checked)}
        />
        Acesso ativo
      </label>
      {isSelf && <p className="text-xs opacity-60">Você não pode remover o seu próprio acesso de administrador.</p>}
      <ErrorText error={error} />
      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          disabled={pending}
          onClick={() => {
            if (!window.confirm(`Gerar uma nova senha para ${user.name}? A senha atual deixará de funcionar.`)) return;
            run(
              () => resetPasswordAction(user.id),
              ({ password }) => onPassword(password),
            );
          }}
        >
          Redefinir senha
        </Button>
        <Button
          variant="primary"
          disabled={pending || !name.trim()}
          onClick={() => run(() => updateUserAction({ id: user.id, name, role, active }), onDone)}
        >
          {pending ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </div>
  );
}

type DialogState =
  { kind: "create" } | { kind: "edit"; user: AdminUser } | { kind: "password"; email: string; password: string } | null;

export function UsersManager({
  users,
  viewerId,
  authAdminAvailable,
}: {
  users: AdminUser[];
  viewerId: string;
  authAdminAvailable: boolean;
}) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const close = () => setDialog(null);

  return (
    <Card>
      {!authAdminAvailable && (
        <p
          role="alert"
          className="rounded-xl bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-500/15 dark:text-amber-200"
        >
          Criar usuários e redefinir senhas exige a variável <code>SUPABASE_SECRET_KEY</code> no servidor. Editar nome,
          perfil e acesso funciona normalmente.
        </p>
      )}
      <div className="flex justify-end">
        <Button variant="primary" disabled={!authAdminAvailable} onClick={() => setDialog({ kind: "create" })}>
          <Plus size={18} /> Novo usuário
        </Button>
      </div>
      <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
        {users.map((user) => (
          <li key={user.id} className={`flex items-center gap-3 py-3 ${user.active ? "" : "opacity-50"}`}>
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {user.name}
                {user.id === viewerId && <span className="ml-2 text-xs opacity-60">(você)</span>}
              </p>
              <p className="truncate text-xs opacity-60">
                {user.email} · {ROLE_LABEL[user.role]}
                {!user.active && " · sem acesso"}
              </p>
            </div>
            <Button
              variant="ghost"
              className="!min-h-9 !px-3 text-sm"
              onClick={() => setDialog({ kind: "edit", user })}
            >
              Editar
            </Button>
          </li>
        ))}
      </ul>

      <Dialog
        open={dialog !== null}
        onClose={close}
        title={dialog?.kind === "create" ? "Novo usuário" : dialog?.kind === "edit" ? "Editar usuário" : "Senha gerada"}
      >
        {dialog?.kind === "create" && (
          <CreateUserForm onCreated={(email, password) => setDialog({ kind: "password", email, password })} />
        )}
        {dialog?.kind === "edit" && (
          <EditUserForm
            key={dialog.user.id}
            user={dialog.user}
            isSelf={dialog.user.id === viewerId}
            onDone={close}
            onPassword={(password) => setDialog({ kind: "password", email: dialog.user.email, password })}
          />
        )}
        {dialog?.kind === "password" && (
          <PasswordNotice email={dialog.email} password={dialog.password} onClose={close} />
        )}
      </Dialog>
    </Card>
  );
}
