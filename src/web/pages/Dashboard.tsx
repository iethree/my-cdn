import { ActionIcon, Anchor, Collapse, Group, Loader, Stack, Text, Title, Tooltip } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import type { ImageDto, TagDto } from "../../shared/types";
import { api } from "../api";
import { ImageGrid } from "../components/ImageGrid";
import { ImageModal } from "../components/ImageModal";
import { SearchBox } from "../components/SearchBox";
import { SessionActions } from "../components/SessionActions";
import { Shell } from "../components/Shell";
import { TagList } from "../components/TagList";
import { UploadBox } from "../components/UploadBox";
import { PlusIcon, XIcon } from "../icons";

export function Dashboard({ user }: { user: { email: string } }) {
  const [query, setQuery] = useState("");
  const [q] = useDebouncedValue(query.trim(), 250);
  const [images, setImages] = useState<ImageDto[] | null>(null);
  const [total, setTotal] = useState(0);
  const [tags, setTags] = useState<TagDto[]>([]);
  const [selected, setSelected] = useState<ImageDto | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const loadTags = useCallback(() => api.tags().then(setTags).catch(() => {}), []);

  useEffect(() => {
    let live = true;
    api
      .images(q, null, q ? 60 : 24)
      .then((r) => {
        if (!live) return;
        setImages(r.images);
        setTotal(r.total);
      })
      .catch((e: Error) => notifications.show({ color: "red", message: e.message }));
    return () => {
      live = false;
    };
  }, [q]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  const upsert = (img: ImageDto) => {
    setImages((prev) => {
      if (!prev) return [img];
      const exists = prev.some((i) => i.id === img.id);
      if (!exists) setTotal((t) => t + 1);
      return exists ? prev.map((i) => (i.id === img.id ? img : i)) : [img, ...prev];
    });
    setSelected((s) => (s?.id === img.id ? img : s));
    loadTags();
  };

  const remove = async (img: ImageDto) => {
    try {
      await api.remove(img.id);
      drop(img.id);
      notifications.show({ message: `Deleted ${img.name}` });
    } catch (e) {
      notifications.show({ color: "red", message: e instanceof Error ? e.message : "Couldn't delete" });
    }
  };

  const drop = (id: string) => {
    setImages((prev) => prev?.filter((i) => i.id !== id) ?? null);
    setTotal((t) => Math.max(0, t - 1));
    loadTags();
  };

  const tagNames = tags.map((t) => t.name);

  const changeTags = (img: ImageDto, next: string[]) => {
    upsert({ ...img, tags: next });
    api
      .update(img.id, { tags: next })
      .then(upsert)
      .catch((e: Error) => {
        notifications.show({ color: "red", message: e.message });
        upsert(img);
      });
  };

  return (
    <Shell
      right={<SessionActions email={user.email} />}
    >
      <Stack gap="xl">
        <Group gap="sm" wrap="nowrap" align="center">
          <div style={{ flex: 1 }}>
            <SearchBox value={query} onChange={setQuery} />
          </div>
          <Tooltip label={uploadOpen ? "Close uploader" : "Upload images"}>
            <ActionIcon
              size={50}
              radius="xl"
              variant={uploadOpen ? "default" : "filled"}
              aria-label={uploadOpen ? "Close uploader" : "Upload images"}
              aria-expanded={uploadOpen}
              onClick={() => setUploadOpen((o) => !o)}
            >
              {uploadOpen ? <XIcon width={22} height={22} /> : <PlusIcon width={24} height={24} />}
            </ActionIcon>
          </Tooltip>
        </Group>

        <Collapse expanded={uploadOpen && !q}>
          <UploadBox suggestions={tagNames} onUploaded={upsert} />
        </Collapse>

        {!q && (
          <section>
            <Group justify="space-between" align="baseline" mb="sm">
              <Title order={3}>Tags</Title>
              <Anchor component={Link} to="/t" fw={700} size="sm">
                View all →
              </Anchor>
            </Group>
            <TagList tags={tags} singleRow />
          </section>
        )}

        <section>
          <Group justify="space-between" align="baseline" mb="md">
            <Group gap="sm" align="baseline">
              <Title order={3}>{q ? `Results for “${q}”` : "Recent uploads"}</Title>
              {images && total > images.length && (
                <Text c="dimmed" size="sm">
                  showing {images.length} of {total.toLocaleString()}
                </Text>
              )}
            </Group>
            {!q && (
              <Anchor component={Link} to="/all" fw={700} size="sm">
                View all →
              </Anchor>
            )}
          </Group>
          {images === null ? <Loader /> : <ImageGrid images={images} onSelect={setSelected} allTags={tagNames} onTagsChange={changeTags} onDelete={remove} empty={q ? "No matches." : "Nothing uploaded yet. Drop an image above!"} />}
        </section>
      </Stack>

      <ImageModal image={selected} suggestions={tagNames} onClose={() => setSelected(null)} onChange={upsert} onDelete={drop} />
    </Shell>
  );
}
