import { useId, useState } from "react";
import { Ban, KeyRound, RotateCcw, Trash2, UserPlus, Users } from "lucide-react";
import { getApiErrorMessage } from "@/shared/api/http";
import { toast } from "@/shared/lib/toast";
import { useAppSelector } from "@/app/hooks";
import { Badge } from "@/shared/components/Badge";
import { Button } from "@/shared/components/Button";
import { ConfirmDialog, Dialog } from "@/shared/components/Dialog";
import { DataTable, DensityToggle, type Column } from "@/shared/components/DataTable";
import { EmptyState } from "@/shared/components/EmptyState";
import { Fab } from "@/shared/components/Fab";
import { FilterBar, FilterSelect } from "@/shared/components/FilterBar";
import { RowMenu, type MenuEntry } from "@/shared/components/Menu";
import { PageHeader } from "@/shared/components/PageHeader";
import { Pagination } from "@/shared/components/Pagination";
import { RecordCard } from "@/shared/components/RecordCard";
import { useDensity } from "@/shared/hooks/useDensity";
import { formatAge, formatDate } from "@/shared/lib/format";
import type { AccountRole, AdminUser } from "../api/adminApi";
import {
  useAdminUsers,
  useCreateStaffUser,
  useEraseUser,
  useSendPasswordLink,
  useSetUserActive,
} from "../hooks/useAdmin";
import { InviteLinkDialog } from "../components/InviteLinkDialog";

const ROLES = [
  { value: "", label: "All roles" },
  { value: "driver", label: "Drivers" },
  { value: "business_owner", label: "Business owners" },
  { value: "admin", label: "Administrators" },
];
const STATES = [
  { value: "", label: "Any state" },
  { value: "true", label: "Active" },
  { value: "false", label: "Switched off" },
];
const ROLE_LABEL: Record<AccountRole, string> = {
  driver: "Driver",
  business_owner: "Business owner",
  admin: "Administrator",
};

/**
 * Accounts — FR-ADM-06.
 *
 * Two different things can be done to an account, and the screen keeps them
 * apart because confusing them is expensive:
 *
 *  - **Switch off.** For a fake or abusive account. Reversible, keeps every
 *    record, and takes effect on that person's very next request.
 *  - **Erase.** For somebody who has asked to be forgotten. Permanent. Their
 *    name comes off everything and their listings go back to the directory.
 *
 * Neither is offered on your own row. Locking yourself out is a support ticket,
 * and if the last administrator does it there is nobody left to undo it.
 */
export function AdminUsersPage() {
  const me = useAppSelector((s) => s.auth.user);
  const [density, setDensity] = useDensity();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<AccountRole | "">("");
  const [state, setState] = useState<"" | "true" | "false">("");
  const [page, setPage] = useState(1);
  const [deactivating, setDeactivating] = useState<AdminUser | null>(null);
  const [erasing, setErasing] = useState<AdminUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [unsent, setUnsent] = useState<{ link: string; recipient: string } | null>(null);

  const { data, isLoading, isFetching } = useAdminUsers({
    search,
    role: role || undefined,
    isActive: state === "" ? undefined : state === "true",
    page,
  });
  const setActive = useSetUserActive();
  const erase = useEraseUser();
  const passwordLink = useSendPasswordLink();
  const items = data?.items ?? [];

  async function sendPasswordLink(user: AdminUser) {
    try {
      const { notification, message } = await passwordLink.mutateAsync(user.id);
      // Emailed: say so. Not emailed: hand the link over, or nobody has it.
      if (notification.inviteUrl)
        setUnsent({ link: notification.inviteUrl, recipient: user.email });
      else toast.success(message);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  const resetPage = () => setPage(1);

  async function deactivate(user: AdminUser, reason: string) {
    try {
      await setActive.mutateAsync({ id: user.id, isActive: false, reason });
      toast.success(`${user.name} can no longer sign in`);
      setDeactivating(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  async function reactivate(user: AdminUser) {
    try {
      await setActive.mutateAsync({ id: user.id, isActive: true });
      toast.success(`${user.name} can sign in again`);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  async function eraseUser(user: AdminUser, reason: string) {
    try {
      const result = await erase.mutateAsync({ id: user.id, reason });
      const released = result.listingsReleased.length;
      toast.success(
        released
          ? `Account erased. ${released} listing${released === 1 ? " is" : "s are"} unclaimed again.`
          : "Account erased",
      );
      setErasing(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  const rowActions = (u: AdminUser): MenuEntry[] => {
    // Your own row offers nothing. See the note on the page.
    if (u.id === me?.id) return [];
    return [
      // Only where there is a password to set: a driver signs in with a code,
      // and a switched-off account has to be switched on first.
      ...(u.role !== "driver" && u.isActive
        ? [
            {
              label: "Send password link",
              icon: KeyRound,
              onSelect: () => void sendPasswordLink(u),
            },
          ]
        : []),
      u.isActive
        ? {
            label: "Switch off account",
            icon: Ban,
            destructive: true,
            onSelect: () => setDeactivating(u),
          }
        : { label: "Switch back on", icon: RotateCcw, onSelect: () => void reactivate(u) },
      { type: "separator" },
      {
        label: "Erase on request",
        icon: Trash2,
        destructive: true,
        onSelect: () => setErasing(u),
      },
    ];
  };

  const columns: Column<AdminUser>[] = [
    {
      key: "name",
      header: "Account",
      wrap: true,
      cell: (u) => (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="truncate font-medium text-foreground">{u.name}</span>
          {u.id === me?.id && <Badge tone="primary">You</Badge>}
          {!u.isActive && <Badge tone="destructive">Switched off</Badge>}
        </div>
      ),
    },
    {
      key: "email",
      header: "Email",
      cell: (u) => <span className="text-muted-foreground">{u.email}</span>,
    },
    { key: "role", header: "Role", cell: (u) => <RoleBadge role={u.role} /> },
    {
      key: "phone",
      header: "Phone",
      hideBelow: "lg",
      cell: (u) => (
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {u.phoneFormatted ?? "—"}
        </span>
      ),
    },
    {
      key: "seen",
      header: "Last sign-in",
      align: "end",
      hideBelow: "xl",
      cell: (u) => (
        <span className="text-xs text-muted-foreground" title={formatDate(u.lastLoginAt)}>
          {u.lastLoginAt ? formatAge(u.lastLoginAt) : "Never"}
        </span>
      ),
    },
  ];

  const chips = [
    role && {
      key: "role",
      label: `Role: ${ROLES.find((r) => r.value === role)?.label}`,
      onRemove: () => {
        setRole("");
        resetPage();
      },
    },
    state && {
      key: "state",
      label: `State: ${STATES.find((s) => s.value === state)?.label}`,
      onRemove: () => {
        setState("");
        resetPage();
      },
    },
  ].filter((c): c is { key: string; label: string; onRemove: () => void } => Boolean(c));

  return (
    <div className="ra-page">
      <PageHeader
        title="Accounts"
        description="Everybody who can sign in. Switch off an account that is fake or abusive; erase one when its owner asks to be forgotten."
        meta={
          <span>
            <span className="font-mono tabular-nums text-foreground">{data?.meta.total ?? 0}</span>{" "}
            accounts
            {isFetching && !isLoading && (
              <span className="ms-2 text-muted-foreground/70">· updating</span>
            )}
          </span>
        }
        actions={
          <Button
            variant="primary"
            icon={UserPlus}
            onClick={() => setCreating(true)}
            className="hidden md:inline-flex"
          >
            Add staff account
          </Button>
        }
      />

      <FilterBar
        search={{
          value: search,
          onChange: (v) => {
            setSearch(v);
            resetPage();
          },
          placeholder: "Search by name, email or phone",
          label: "Search accounts",
        }}
        chips={chips}
        onClearAll={
          chips.length
            ? () => {
                setRole("");
                setState("");
                resetPage();
              }
            : undefined
        }
        trailing={<DensityToggle density={density} onChange={setDensity} />}
      >
        <FilterSelect
          id="role"
          label="Role"
          value={role}
          onChange={(v) => {
            setRole(v as AccountRole | "");
            resetPage();
          }}
          options={ROLES}
        />
        <FilterSelect
          id="state"
          label="State"
          value={state}
          onChange={(v) => {
            setState(v as "" | "true" | "false");
            resetPage();
          }}
          options={STATES}
        />
      </FilterBar>

      <DataTable
        label="Accounts"
        rows={items}
        columns={columns}
        rowKey={(u) => u.id}
        loading={isLoading}
        density={density}
        rowActions={rowActions}
        rowActionsLabel={(u) => `Actions for ${u.name}`}
        rowTone={(u) => (u.isActive ? undefined : "danger")}
        empty={
          <EmptyState
            inline
            icon={Users}
            title={search || chips.length ? "No accounts match" : "No accounts yet"}
            description={
              search || chips.length
                ? "Try a different search, or clear the filters."
                : "Drivers appear here the first time they sign in."
            }
          />
        }
        mobileRow={(u) => (
          <RecordCard
            title={u.name}
            meta={[u.email, ROLE_LABEL[u.role], u.lastLoginAt ? formatAge(u.lastLoginAt) : null]}
            badge={
              !u.isActive ? (
                <Badge tone="destructive">Switched off</Badge>
              ) : u.id === me?.id ? (
                <Badge tone="primary">You</Badge>
              ) : undefined
            }
            actions={
              rowActions(u).length ? (
                <RowMenu
                  items={rowActions(u)}
                  label={`Actions for ${u.name}`}
                  size="md"
                  variant="secondary"
                />
              ) : undefined
            }
          />
        )}
        footer={
          data && (
            <Pagination
              page={data.meta.page}
              totalPages={data.meta.totalPages}
              total={data.meta.total}
              pageSize={data.meta.limit || 20}
              onChange={setPage}
              noun="accounts"
            />
          )
        }
      />

      <Fab label="Add staff account" onClick={() => setCreating(true)} />

      <ConfirmDialog
        open={Boolean(deactivating)}
        onClose={() => setDeactivating(null)}
        title={`Switch off ${deactivating?.name ?? "this account"}?`}
        description="They are signed out on their next request and cannot sign back in. Nothing is deleted, and you can switch the account back on."
        confirmLabel="Switch off"
        busy={setActive.isPending}
        onConfirm={(reason) => deactivating && deactivate(deactivating, reason)}
        reason={{
          label: "Reason",
          placeholder: "e.g. Claimed a garage they do not own",
          hint: "Recorded in the audit log.",
          minLength: 3,
        }}
      />

      <ConfirmDialog
        open={Boolean(erasing)}
        onClose={() => setErasing(null)}
        title={`Erase ${erasing?.name ?? "this account"} for good?`}
        description={
          erasing?.businessIds.length
            ? "This cannot be undone. Their name comes off every record, their reviews are deleted, and the listings they manage go back to unclaimed and lose their Verified badge."
            : "This cannot be undone. Their name and number come off every record, and their reviews and saved garages are deleted."
        }
        confirmLabel="Erase account"
        busy={erase.isPending}
        onConfirm={(reason) => erasing && eraseUser(erasing, reason)}
        reason={{
          label: "Why is this account being erased?",
          placeholder: "e.g. Deletion request received by email on 7 October",
          hint: "Use this for a request to be forgotten. To stop abuse, switch the account off instead.",
          minLength: 3,
        }}
      />

      <CreateStaffDialog open={creating} onClose={() => setCreating(false)} />

      <InviteLinkDialog
        link={unsent?.link ?? null}
        recipient={unsent?.recipient}
        onClose={() => setUnsent(null)}
      />
    </div>
  );
}

/** Drivers are the ordinary case and get no colour; the roles with power do. */
function RoleBadge({ role }: { role: AccountRole }) {
  if (role === "admin") return <Badge tone="primary">{ROLE_LABEL[role]}</Badge>;
  if (role === "business_owner") return <Badge tone="success">{ROLE_LABEL[role]}</Badge>;
  return <Badge>{ROLE_LABEL[role]}</Badge>;
}

/**
 * Add a member of staff. Only staff: a driver is never created by hand — they
 * come into existence the first time they sign in — and an owner normally
 * arrives by having a claim approved.
 */
function CreateStaffDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateStaffUser();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "business_owner">("admin");
  const [error, setError] = useState<string | null>(null);
  const nameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const roleId = useId();

  function close() {
    setName("");
    setEmail("");
    setPassword("");
    setRole("admin");
    setError(null);
    onClose();
  }

  async function submit() {
    setError(null);
    try {
      await create.mutateAsync({ name: name.trim(), email: email.trim(), password, role });
      toast.success(`${name.trim()} can now sign in`);
      close();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  // The same rules the server applies, so the button is honest about them.
  const ready =
    name.trim().length >= 2 && /^\S+@\S+\.\S+$/.test(email.trim()) && password.length >= 10;

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Add a staff account"
      description="For people who work on RoadAxis. Give them the password yourself; they are not emailed."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={create.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void submit()}
            disabled={!ready}
            loading={create.isPending}
          >
            Create account
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <label htmlFor={nameId} className="block text-sm font-medium text-foreground">
            Name
          </label>
          <input
            id={nameId}
            data-autofocus
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="ra-input ra-control w-full px-3"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={emailId} className="block text-sm font-medium text-foreground">
            Email
          </label>
          <input
            id={emailId}
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="ra-input ra-control w-full px-3"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={passwordId} className="block text-sm font-medium text-foreground">
            Password
          </label>
          <input
            id={passwordId}
            type="text"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="ra-input ra-control w-full px-3 font-mono"
          />
          <p className="text-xs text-muted-foreground">
            At least 10 characters. Shown as you type, because you are about to pass it on.
          </p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor={roleId} className="block text-sm font-medium text-foreground">
            Role
          </label>
          <select
            id={roleId}
            value={role}
            onChange={(e) => setRole(e.target.value as "admin" | "business_owner")}
            className="ra-input ra-control w-full px-3"
          >
            <option value="admin">Administrator — the whole console</option>
            <option value="business_owner">Business owner — their own listings only</option>
          </select>
        </div>
        {error && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
