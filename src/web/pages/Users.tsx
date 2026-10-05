import { ActionIcon, Button, Center, Group, Loader, PasswordInput, Stack, Text, TextInput, Title, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router";
import { generatePassword, PASSWORD_MAX, PASSWORD_MIN } from "../../shared/password";
import { EMAIL_RE, type UserDto } from "../../shared/types";
import { api } from "../api";
import { authClient } from "../auth";
import { SessionActions } from "../components/SessionActions";
import { Shell } from "../components/Shell";
import { useConfig } from "../config";
import { CopyIcon, TrashIcon } from "../icons";

const fail = (e: unknown) =>
  notifications.show({ color: "red", title: "That didn't work", message: e instanceof Error ? e.message : "Unknown error" });

export function Users() {
  const { data: session, isPending } = authClient.useSession();
  const { plan } = useConfig();
  const [users, setUsers] = useState<UserDto[] | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (session) api.users().then(setUsers).catch(fail);
  }, [session]);

  if (isPending) {
    return (
      <Shell>
        <Center py="xl">
          <Loader />
        </Center>
      </Shell>
    );
  }
  if (!session) return <Navigate to="/" replace />;

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) return fail(new Error("Enter a valid email address"));
    if (plan === "free" && (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX)) {
      return fail(new Error(`Password must be ${PASSWORD_MIN} to ${PASSWORD_MAX} characters`));
    }
    setBusy(true);
    try {
      setUsers(await api.addUser(value, plan === "free" ? password : undefined));
      if (plan === "free") {
        notifications.show({
          color: "teal",
          title: `Added ${value}`,
          message: `Share their password with them: ${password}`,
          autoClose: false,
        });
      }
      setEmail("");
      setPassword("");
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      setUsers(await api.removeUser(id));
      setConfirm(null);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="Users" right={<SessionActions email={session.user.email} />}>
      <Stack gap="xl" maw={640} mx="auto">
        <div>
          <Title order={2}>Users</Title>
          <Text c="dimmed" size="sm">
            Anyone listed here can sign in{plan === "free" ? " with their password" : " with a magic link"}, upload, and manage users.
          </Text>
        </div>

        <form onSubmit={add}>
          <Group gap="xs" wrap="nowrap" align="flex-end">
            <TextInput
              label="Add a user"
              type="email"
              placeholder="someone@example.com"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <Button type="submit" loading={busy} disabled={!email.trim() || (plan === "free" && !password)}>
              Add
            </Button>
          </Group>
          {plan === "free" && (
            <Group gap="xs" wrap="nowrap" align="flex-end" mt="sm">
              <PasswordInput
                label="Their password"
                description="They can change it after signing in."
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                style={{ flex: 1 }}
              />
              <Button variant="light" onClick={() => setPassword(generatePassword())}>
                Generate
              </Button>
              <Tooltip label="Copy password">
                <ActionIcon variant="default" size="lg" aria-label="Copy password" disabled={!password} onClick={() => navigator.clipboard.writeText(password)}>
                  <CopyIcon />
                </ActionIcon>
              </Tooltip>
            </Group>
          )}
        </form>

        {users === null ? (
          <Loader />
        ) : (
          <Stack gap="sm">
            {users.map((u) => {
              const isMe = u.id === session.user.id;
              return (
                <Group key={u.id} className="sticker" p="sm" justify="space-between" wrap="nowrap">
                  <div style={{ minWidth: 0 }}>
                    <Text fw={700} truncate>
                      {u.email}
                      {isMe && (
                        <Text span c="dimmed" fw={500} size="sm">
                          {" "}
                          (you)
                        </Text>
                      )}
                    </Text>
                    <Text size="xs" c="dimmed">
                      added {new Date(u.createdAt).toLocaleDateString()}
                    </Text>
                  </div>
                  {!isMe && (
                    <Button
                      variant={confirm === u.id ? "filled" : "subtle"}
                      color="red"
                      size="xs"
                      leftSection={<TrashIcon width={14} height={14} />}
                      onClick={() => (confirm === u.id ? remove(u.id) : setConfirm(u.id))}
                      onBlur={() => setConfirm(null)}
                      disabled={busy || users.length <= 1}
                    >
                      {confirm === u.id ? "Really remove?" : "Remove"}
                    </Button>
                  )}
                </Group>
              );
            })}
          </Stack>
        )}
      </Stack>
    </Shell>
  );
}
