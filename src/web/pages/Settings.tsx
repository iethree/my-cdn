import { Alert, Center, Group, Loader, Progress, Stack, Text, Title } from "@mantine/core";
import { useEffect, useState } from "react";
import { Navigate } from "react-router";
import type { Stats } from "../../shared/types";
import { api, formatBytes } from "../api";
import { authClient } from "../auth";
import { SessionActions } from "../components/SessionActions";
import { Shell } from "../components/Shell";

export function Settings() {
  const { data: session, isPending } = authClient.useSession();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session) api.stats().then(setStats).catch((e: Error) => setError(e.message));
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

  const pct = stats ? Math.min(100, (stats.storage.bytes / stats.storage.limitBytes) * 100) : 0;
  const color = pct >= 90 ? "red" : pct >= 70 ? "yellow" : "teal";

  return (
    <Shell title="Settings" right={<SessionActions email={session.user.email} />}>
      <Stack gap="xl" maw={720} mx="auto">
        <Title order={2}>Settings</Title>
        {error && <Alert color="red">{error}</Alert>}
        {!stats && !error && <Loader />}
        {stats && (
          <Stack className="sticker" p="lg" gap="sm">
            <Text fw={700}>Data stored</Text>
            <Group align="baseline" gap="xs">
              <Title order={1}>{formatBytes(stats.storage.bytes)}</Title>
              <Text c="dimmed">across {stats.storage.objects.toLocaleString()} images</Text>
            </Group>
            <Progress value={pct} color={color} size="md" radius="xl" />
            <Text size="xs" c="dimmed">
              {formatBytes(stats.storage.limitBytes)} of R2 storage is included free.
            </Text>
          </Stack>
        )}
      </Stack>
    </Shell>
  );
}
