import { useState, useEffect, type FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Sprout, UserPlus } from "lucide-react";
import { useAuth, roleName } from "../auth/AuthContext";
import * as api from "../api";
import type { UserRole } from "../api";
import Button from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import PlantSprite from "../components/sprites/PlantSprite";

export default function InviteClaim() {
  const { token } = useParams<{ token: string }>();
  const { refresh } = useAuth();
  const navigate = useNavigate();

  const [inviteRole, setInviteRole] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState("");
  const [loading, setLoading] = useState(true);

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.getInviteInfo(token)
      .then((info) => {
        setInviteRole(info.role);
        setLoading(false);
      })
      .catch(() => {
        setInviteError("This invite link is invalid or has expired.");
        setLoading(false);
      });
  }, [token]);

  const passwordsMatch = password === confirmPassword;
  const canSubmit = username && displayName && password.length >= 8 && passwordsMatch;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || !token) return;
    setSubmitError("");
    setSubmitting(true);
    try {
      await api.claimInvite(token, { username, displayName, password });
      await refresh();
      navigate("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create account";
      setSubmitError(msg.includes("409") ? "Username already taken" : msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <p className="text-stone-400 font-display">Checking invite...</p>
      </div>
    );
  }

  if (inviteError) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center p-6">
        <div className="text-center">
          <PlantSprite type="flower" mood="wilting" size={64} className="mx-auto" />
          <h1 className="text-xl font-bold font-display text-stone-100 mt-4">
            Invite Not Found
          </h1>
          <p className="text-stone-400 text-sm font-display mt-2">{inviteError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <PlantSprite type="shrub" mood="happy" size={56} className="mx-auto" />
          <h1 className="text-2xl font-bold font-display text-stone-100 mt-4 flex items-center justify-center gap-2">
            <UserPlus className="text-emerald-400" size={20} />
            You're Invited!
          </h1>
          <p className="text-stone-400 text-sm font-display mt-2">
            You've been invited to join this Bramble garden as a{" "}
            <span className="text-emerald-400 font-semibold">
              {roleName(inviteRole as UserRole)}
            </span>.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. alex"
            autoComplete="username"
            autoFocus
            required
          />
          <Input
            label="Display Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Alex"
            autoComplete="name"
            required
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            error={password && password.length < 8 ? "Must be at least 8 characters" : undefined}
          />
          <Input
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
            error={confirmPassword && !passwordsMatch ? "Passwords don't match" : undefined}
          />

          {submitError && (
            <p className="text-sm text-red-400 font-display">{submitError}</p>
          )}

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={submitting || !canSubmit}
          >
            <Sprout size={18} />
            {submitting ? "Joining..." : "Join the Garden"}
          </Button>
        </form>
      </div>
    </div>
  );
}
