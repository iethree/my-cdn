import { Center, Group, Loader, Stack, Text, TextInput, Title } from "@mantine/core";
import { useEffect, useState } from "react";
import { Navigate } from "react-router";
import { normalizeTag, type TagDto } from "../../shared/types";
import { api } from "../api";
import { authClient } from "../auth";
import { SessionActions } from "../components/SessionActions";
import { Shell } from "../components/Shell";
import { TagList } from "../components/TagList";
import { SearchIcon } from "../icons";

export function AllTags() {
  const { data: session, isPending } = authClient.useSession();
  const [tags, setTags] = useState<TagDto[] | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (session) api.tags().then(setTags).catch(() => setTags([]));
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

  const q = normalizeTag(filter);
  const shown = (tags ?? []).filter((t) => !q || t.name.includes(q));

  return (
    <Shell title="Tags" right={<SessionActions email={session.user.email} />}>
      <Stack gap="lg">
        <Group gap="sm" align="baseline">
          <Title order={2}>Tags</Title>
          {tags && (
            <Text c="dimmed">
              {tags.length} {tags.length === 1 ? "tag" : "tags"}
              {q && `, ${shown.length} matching`}
            </Text>
          )}
        </Group>
        <TextInput radius="xl" placeholder="Filter tags…" leftSection={<SearchIcon />} value={filter} onChange={(e) => setFilter(e.currentTarget.value)} maw={360} aria-label="Filter tags" />
        {tags === null ? <Loader /> : <TagList tags={shown} empty={q ? "No tags match." : "No tags yet. Add some when you upload."} />}
      </Stack>
    </Shell>
  );
}
