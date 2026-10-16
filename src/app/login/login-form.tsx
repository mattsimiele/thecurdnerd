"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    getSupabaseBrowserClient().auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/dashboard");
    });
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    const { error: signInError } = await getSupabaseBrowserClient().auth.signInWithPassword({ email, password });
    if (signInError) {
      setError("That email or password is not recognized, or this account has not been invited.");
      setPending(false);
      return;
    }
    router.replace("/dashboard");
  }

  return <main className="login-page">
    <Link className="wordmark wordmark-dark" href="/">THE CURD NERD<span>DATA HOUSE</span></Link>
    <div className="login-visual"><img src="https://picsum.photos/seed/quiet-restaurant-table/1400/1800" alt="A quiet, prepared dining room" /><p>The whole business,<br />ready before service.</p></div>
    <section className="login-panel">
      <div className="login-copy"><p>Private manager access</p><h1>Welcome back.</h1><p>Use the email address associated with your manager invitation.</p></div>
      <form onSubmit={submit} className="login-form">
        <label>Email<input name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label>Password<input name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button-dark" disabled={pending}>{pending ? "Signing in…" : "Enter dashboard"}</button>
      </form>
      <p className="demo-note">Accounts are invitation-only. Contact an administrator if you need access.</p>
    </section>
  </main>;
}
