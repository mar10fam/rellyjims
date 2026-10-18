"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn } from "@/lib/auth-client";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const press = (k: string) => {
    setError(null);
    if (k === "⌫") setPin((p) => p.slice(0, -1));
    else if (k && pin.length < 6) setPin((p) => p + k);
  };

  const submit = async () => {
    if (!username || pin.length < 4) return;
    setLoading(true);
    const { error } = await signIn.username({ username: username.trim().toLowerCase(), password: pin });
    setLoading(false);
    if (error) {
      setPin("");
      setError(error.status === 429 ? error.message ?? "Too many attempts" : "Wrong username or PIN");
      return;
    }
    router.replace("/");
    router.refresh();
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <h1 className="text-center text-4xl font-black tracking-tight">rellyjims</h1>

      <input
        className="rounded-xl bg-neutral-900 px-4 py-3 text-lg outline-none ring-1 ring-neutral-800 focus:ring-lime-400"
        placeholder="Username"
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />

      <div className="flex min-h-4 justify-center gap-3" aria-label="PIN">
        {Array.from({ length: pin.length }).map((_, i) => (
          <span key={i} className="h-4 w-4 rounded-full bg-lime-400" />
        ))}
      </div>

      {error && <p className="text-center text-sm text-red-400">{error}</p>}

      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((k, i) =>
          k ? (
            <button
              key={i}
              type="button"
              onClick={() => press(k)}
              className="h-16 rounded-2xl bg-neutral-900 text-2xl font-semibold active:bg-neutral-800"
            >
              {k}
            </button>
          ) : (
            <span key={i} />
          ),
        )}
      </div>

      <button
        type="button"
        disabled={loading || !username || pin.length < 4}
        onClick={submit}
        className="h-14 rounded-2xl bg-lime-400 text-lg font-bold text-neutral-950 disabled:opacity-40"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </main>
  );
}
