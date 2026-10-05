import { Button, Center, PasswordInput, Stack, Text, TextInput, Title } from "@mantine/core";
import { useState, type FormEvent } from "react";
import { authClient } from "../auth";
import { Shell } from "../components/Shell";
import { useConfig } from "../config";

export function Login() {
  const { name, plan } = useConfig();
  return (
    <Shell title="Sign in">
      <Center py="xl">
        <Stack className="sticker" p="xl" gap="md" maw={420} w="100%">
          <Title order={2}>Sign in to {name}</Title>
          {plan === "free" ? <PasswordLogin /> : <MagicLinkLogin />}
        </Stack>
      </Center>
    </Shell>
  );
}

function MagicLinkLogin() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await authClient.signIn.magicLink({ email, callbackURL: "/", errorCallbackURL: "/?error=link" });
    setBusy(false);
    if (error) setError(error.message ?? "Couldn't send the link. Try again in a minute.");
    else setSent(true);
  };

  if (sent) {
    return (
      <Text>
        If <b>{email}</b> is on the list, a sign-in link is on its way. It expires in 10 minutes.
      </Text>
    );
  }
  return (
    <form onSubmit={submit}>
      <Stack gap="md">
        <Text c="dimmed" size="sm">
          Enter your email and we'll send you a magic link. No password needed.
        </Text>
        <TextInput type="email" required autoFocus size="md" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.currentTarget.value)} error={error} />
        <Button type="submit" size="md" loading={busy}>
          Send magic link
        </Button>
      </Stack>
    </form>
  );
}

function PasswordLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await authClient.signIn.email({ email, password });
    setBusy(false);
    if (error) setError(error.status === 429 ? "Too many attempts. Wait a moment and try again." : "Wrong email or password.");
  };

  return (
    <form onSubmit={submit}>
      <Stack gap="md">
        <TextInput type="email" required autoFocus size="md" label="Email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
        <PasswordInput required size="md" label="Password" value={password} onChange={(e) => setPassword(e.currentTarget.value)} error={error} />
        <Button type="submit" size="md" loading={busy}>
          Sign in
        </Button>
      </Stack>
    </form>
  );
}
