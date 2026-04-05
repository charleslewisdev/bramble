import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Sprout, Sparkles } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import * as api from "../api";
import Button from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import PlantSprite from "../components/sprites/PlantSprite";

export default function Setup() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordsMatch = password === confirmPassword;
  const canSubmit = username && displayName && password.length >= 8 && passwordsMatch;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    setLoading(true);
    try {
      await api.setup({ username, displayName, password });
      await refresh();
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <PlantSprite type="flower" mood="new" size={48} />
            <PlantSprite type="tree" mood="happy" size={56} />
            <PlantSprite type="succulent" mood="happy" size={48} />
          </div>
          <h1 className="text-2xl font-bold font-display text-stone-100 flex items-center justify-center gap-2">
            <Sparkles className="text-amber-400" size={20} />
            Welcome to Bramble
          </h1>
          <p className="text-stone-400 text-sm font-display mt-2">
            Create your Groundskeeper account to get started.
            <br />
            You'll be the head gardener around here.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. charlie"
            autoComplete="username"
            autoFocus
            required
          />
          <Input
            label="Display Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Charlie"
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

          {error && (
            <p className="text-sm text-red-400 font-display">{error}</p>
          )}

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={loading || !canSubmit}
          >
            <Sprout size={18} />
            {loading ? "Planting your roots..." : "Start Gardening"}
          </Button>
        </form>
      </div>
    </div>
  );
}
