import { Loader, Stack, Title } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useCallback, useEffect, useState } from "react";
import type { ImageDto, TagDto } from "../../shared/types";
import { api } from "../api";
import { ImageGrid } from "../components/ImageGrid";
import { ImageModal } from "../components/ImageModal";
import { SearchBox } from "../components/SearchBox";
import { SessionActions } from "../components/SessionActions";
import { Shell } from "../components/Shell";
import { TagList } from "../components/TagList";
import { UploadBox } from "../components/UploadBox";

export function Dashboard({ user }: { user: { email: string } }) {
  const [query, setQuery] = useState("");
  const [q] = useDebouncedValue(query.trim(), 250);
  const [images, setImages] = useState<ImageDto[] | null>(null);
  const [tags, setTags] = useState<TagDto[]>([]);
  const [selected, setSelected] = useState<ImageDto | null>(null);

  const loadTags = useCallback(() => api.tags().then(setTags).catch(() => {}), []);

  useEffect(() => {
    let live = true;
    api
      .images(q)
      .then((r) => live && setImages(r))
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
      return exists ? prev.map((i) => (i.id === img.id ? img : i)) : [img, ...prev];
    });
    setSelected((s) => (s?.id === img.id ? img : s));
    loadTags();
  };

  const drop = (id: string) => {
    setImages((prev) => prev?.filter((i) => i.id !== id) ?? null);
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
        <SearchBox value={query} onChange={setQuery} />

        {!q && <UploadBox suggestions={tagNames} onUploaded={upsert} />}

        <section>
          <Title order={3} mb="md">
            {q ? `Results for “${q}”` : "Recent uploads"}
          </Title>
          {images === null ? <Loader /> : <ImageGrid images={images} onSelect={setSelected} allTags={tagNames} onTagsChange={changeTags} empty={q ? "No matches." : "Nothing uploaded yet. Drop an image above!"} />}
        </section>

        {!q && (
          <section>
            <Title order={3} mb="md">
              Tags
            </Title>
            <TagList tags={tags} />
          </section>
        )}
      </Stack>

      <ImageModal image={selected} suggestions={tagNames} onClose={() => setSelected(null)} onChange={upsert} onDelete={drop} />
    </Shell>
  );
}
