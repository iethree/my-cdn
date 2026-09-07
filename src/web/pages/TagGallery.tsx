import { Badge, Group, Loader, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import type { ImageDto } from "../../shared/types";
import { api } from "../api";
import { authClient } from "../auth";
import { ImageGrid } from "../components/ImageGrid";
import { SessionActions } from "../components/SessionActions";
import { Shell } from "../components/Shell";

export function TagGallery() {
  const { tag = "" } = useParams();
  const [images, setImages] = useState<ImageDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [allTags, setAllTags] = useState<string[]>([]);
  const { data: session } = authClient.useSession();

  useEffect(() => {
    setImages(null);
    api
      .tag(tag)
      .then((r) => setImages(r.images))
      .catch((e: Error) => setError(e.message));
  }, [tag]);

  useEffect(() => {
    if (session) api.tags().then((t) => setAllTags(t.map((x) => x.name))).catch(() => {});
  }, [session]);

  const changeTags = (img: ImageDto, next: string[]) => {
    const apply = (updated: ImageDto) =>
      setImages((prev) => prev?.map((i) => (i.id === updated.id ? updated : i)) ?? null);
    apply({ ...img, tags: next });
    api
      .update(img.id, { tags: next })
      .then((updated) => {
        apply(updated);
        setAllTags((prev) => [...new Set([...prev, ...updated.tags])].sort());
      })
      .catch((e: Error) => {
        notifications.show({ color: "red", message: e.message });
        apply(img);
      });
  };

  return (
    <Shell right={session ? <SessionActions email={session.user.email} /> : undefined}>
      <Stack gap="lg">
        <Group gap="sm" align="baseline">
          <Title order={2}>
            <Badge size="xl" variant="light" tt="none" style={{ verticalAlign: "middle" }}>
              #{tag}
            </Badge>
          </Title>
          {images && (
            <Text c="dimmed">
              {images.length} {images.length === 1 ? "image" : "images"}
            </Text>
          )}
        </Group>
        {error ? <Text c="red">{error}</Text> : images === null ? <Loader /> : <ImageGrid
            images={images}
            allTags={session ? allTags : undefined}
            onTagsChange={session ? changeTags : undefined}
            empty="No images with this tag."
          />}
      </Stack>
    </Shell>
  );
}
