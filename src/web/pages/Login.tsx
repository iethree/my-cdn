import { Button, Center, Stack, Text, TextInput, Title } from "@mantine/core";
import { useState, type FormEvent } from "react";
import { authClient } from "../auth";
import { Shell } from "../components/Shell";

export function Login() {
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

  return (
    <Shell>
      <Center py="xl">
        <Stack className="sticker" p="xl" gap="md" maw={420} w="100%">
          <Title order={2}>Sign in</Title>
          {sent ? (
            <Text>
              If <b>{email}</b> is on the list, a sign-in link is on its way. It expires in 10 minutes.
            </Text>
          ) : (
            <form onSubmit={submit}>
              <Stack gap="md">
                <TextInput
                  type="email"
                  required
                  autoFocus
                  size="md"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.currentTarget.value)}
                  error={error}
                />
                <Button type="submit" size="md" loading={busy}>
                  Send magic link
                </Button>
              </Stack>
            </form>
          )}
        </Stack>
      </Center>
    </Shell>
  );
}
