import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Sprout } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import Button from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import PlantSprite from "../components/sprites/PlantSprite";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      navigate("/");
    } catch (err) {
      setError("Invalid username or password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <PlantSprite type="flower" mood="happy" size={64} className="mx-auto" />
          <h1 className="text-2xl font-bold font-display text-stone-100 mt-4 flex items-center justify-center gap-2">
            <Sprout className="text-emerald-400" size={24} />
            Bramble
          </h1>
          <p className="text-stone-400 text-sm font-display mt-1">
            Sign in to your garden
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            required
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          {error && (
            <p className="text-sm text-red-400 font-display">{error}</p>
          )}

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={loading || !username || !password}
          >
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
