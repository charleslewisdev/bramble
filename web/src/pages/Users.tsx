import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users as UsersIcon,
  UserPlus,
  Shield,
  ShieldCheck,
  Sprout,
  Trash2,
  Copy,
  Check,
  UserX,
  UserCheck,
} from "lucide-react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { Select } from "../components/ui/Input";
import { useToast } from "../components/ui/Toast";
import { useAuth, roleName } from "../auth/AuthContext";
import * as api from "../api";
import type { UserRole, UserRecord, InviteRecord } from "../api";

const roleIcons: Record<UserRole, typeof Shield> = {
  groundskeeper: ShieldCheck,
  gardener: Shield,
  helper: Sprout,
};

const roleColors: Record<UserRole, string> = {
  groundskeeper: "text-amber-400",
  gardener: "text-emerald-400",
  helper: "text-sky-400",
};

export default function Users() {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: api.getUsers,
  });

  const { data: invites = [] } = useQuery({
    queryKey: ["invites"],
    queryFn: api.getInvites,
  });

  const createInviteMutation = useMutation({
    mutationFn: (role: "gardener" | "helper") => api.createInvite(role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invites"] });
      showToast("Invite created!", "success");
    },
  });

  const deleteInviteMutation = useMutation({
    mutationFn: api.deleteInvite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invites"] });
      showToast("Invite revoked", "success");
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: number; role: UserRole }) =>
      api.updateUserRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      showToast("Role updated", "success");
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      api.updateUserActive(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      showToast("User updated", "success");
    },
  });

  const [inviteRole, setInviteRole] = useState<"gardener" | "helper">("gardener");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  function copyInviteUrl(invite: InviteRecord) {
    const url = `${window.location.origin}/invite/${invite.token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(invite.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const pendingInvites = invites.filter((i) => !i.claimedBy && new Date(i.expiresAt) > new Date());

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <UsersIcon className="text-emerald-400" size={28} />
        <h1 className="text-2xl font-bold font-display text-stone-100">
          Users & Invites
        </h1>
      </div>

      {/* Users list */}
      <section>
        <h2 className="text-lg font-semibold font-display text-stone-200 mb-3">
          Garden Crew
        </h2>
        <div className="space-y-2">
          {users.map((u) => {
            const RoleIcon = roleIcons[u.role];
            const isCurrentUser = u.id === currentUser?.id;
            return (
              <Card key={u.id} className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <RoleIcon size={16} className={roleColors[u.role]} />
                    <span className="text-sm font-display text-stone-100 font-semibold">
                      {u.displayName}
                    </span>
                    <span className="text-xs font-mono text-stone-500">
                      @{u.username}
                    </span>
                    {isCurrentUser && (
                      <span className="text-xs font-mono text-emerald-400/60">(you)</span>
                    )}
                    {!u.isActive && (
                      <span className="text-xs font-mono text-red-400/80 bg-red-400/10 px-1.5 py-0.5 rounded">
                        deactivated
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-stone-500 font-mono">
                    <span>{roleName(u.role)}</span>
                    {u.lastLoginAt && (
                      <span>Last login: {new Date(u.lastLoginAt).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>

                {!isCurrentUser && (
                  <div className="flex items-center gap-2">
                    <Select
                      value={u.role}
                      onChange={(e) =>
                        updateRoleMutation.mutate({
                          id: u.id,
                          role: e.target.value as UserRole,
                        })
                      }
                      className="!w-auto text-xs !py-1"
                    >
                      <option value="groundskeeper">Groundskeeper</option>
                      <option value="gardener">Gardener</option>
                      <option value="helper">Helper</option>
                    </Select>
                    <button
                      onClick={() =>
                        toggleActiveMutation.mutate({
                          id: u.id,
                          isActive: !u.isActive,
                        })
                      }
                      className="p-1.5 rounded-lg text-stone-500 hover:text-stone-300 hover:bg-stone-800 transition-colors"
                      title={u.isActive ? "Deactivate" : "Reactivate"}
                    >
                      {u.isActive ? <UserX size={16} /> : <UserCheck size={16} />}
                    </button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      {/* Invites */}
      <section>
        <h2 className="text-lg font-semibold font-display text-stone-200 mb-3">
          Invite Links
        </h2>

        <Card className="mb-4">
          <div className="flex items-center gap-3">
            <Select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as "gardener" | "helper")}
              className="!w-auto"
            >
              <option value="gardener">Gardener</option>
              <option value="helper">Helper</option>
            </Select>
            <Button
              onClick={() => createInviteMutation.mutate(inviteRole)}
              disabled={createInviteMutation.isPending}
              size="sm"
            >
              <UserPlus size={16} />
              Create Invite
            </Button>
          </div>
          <p className="text-xs text-stone-500 font-mono mt-2">
            Invites expire after 7 days. Share the link with someone you trust.
          </p>
        </Card>

        {pendingInvites.length === 0 ? (
          <p className="text-sm text-stone-500 font-display">No pending invites.</p>
        ) : (
          <div className="space-y-2">
            {pendingInvites.map((invite) => {
              const RoleIcon = roleIcons[invite.role];
              return (
                <Card key={invite.id} className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <RoleIcon size={14} className={roleColors[invite.role]} />
                      <span className="text-sm font-display text-stone-200">
                        {roleName(invite.role)} invite
                      </span>
                    </div>
                    <p className="text-xs font-mono text-stone-500 mt-1 truncate">
                      /invite/{invite.token}
                    </p>
                    <p className="text-xs font-mono text-stone-600">
                      Expires {new Date(invite.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => copyInviteUrl(invite)}
                      className="p-1.5 rounded-lg text-stone-500 hover:text-stone-300 hover:bg-stone-800 transition-colors"
                      title="Copy invite link"
                    >
                      {copiedId === invite.id ? (
                        <Check size={16} className="text-emerald-400" />
                      ) : (
                        <Copy size={16} />
                      )}
                    </button>
                    <button
                      onClick={() => deleteInviteMutation.mutate(invite.id)}
                      className="p-1.5 rounded-lg text-stone-500 hover:text-red-400 hover:bg-stone-800 transition-colors"
                      title="Revoke invite"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
