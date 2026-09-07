import { Center, Group, Loader, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { ImageDto, ImagePage } from "../../shared/types";
import { api } from "../api";
import { authClient } from "../auth";
import { ImageGrid } from "./ImageGrid";
import { SessionActions } from "./SessionActions";
import { Shell } from "./Shell";

type Props = {
  docTitle: string;
  heading: ReactNode;
  fetchPage: (cursor: string | null) => Promise<ImagePage>;
  keepAfterTagChange?: (image: ImageDto) => boolean;
  empty: string;
};

const LOAD_DEBOUNCE_MS = 300;

export function Gallery({ docTitle, heading, fetchPage, keepAfterTagChange, empty }: Props) {
  const { data: session } = authClient.useSession();
  const [images, setImages] = useState<ImageDto[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [allTags, setAllTags] = useState<string[]>([]);
  const cursor = useRef<string | null>(null);
  const exhausted = useRef(false);
  const loading = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const sentinel = useRef<HTMLDivElement>(null);
  const generation = useRef(0);

  const loadMore = useCallback(async () => {
    if (loading.current || exhausted.current) return;
    loading.current = true;
    const gen = generation.current;
    try {
      const page = await fetchPage(cursor.current);
      if (gen !== generation.current) return;
      cursor.current = page.nextCursor;
      exhausted.current = page.nextCursor === null;
      setTotal(page.total);
      setImages((prev) => [...(prev ?? []), ...page.images]);
    } catch (e) {
      if (gen === generation.current) setError(e instanceof Error ? e.message : "Couldn't load images");
    } finally {
      if (gen === generation.current) loading.current = false;
    }
  }, [fetchPage]);

  useEffect(() => {
    generation.current++;
    cursor.current = null;
    exhausted.current = false;
    loading.current = false;
    setImages(null);
    setError(null);
    loadMore();
  }, [loadMore]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || images === null) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        clearTimeout(timer.current);
        timer.current = setTimeout(async () => {
          await loadMore();
          // Re-arm so a short page that leaves the sentinel on screen keeps loading.
          observer.unobserve(el);
          observer.observe(el);
        }, LOAD_DEBOUNCE_MS);
      },
      { rootMargin: "600px" },
    );
    observer.observe(el);
    return () => {
      clearTimeout(timer.current);
      observer.disconnect();
    };
  }, [images === null, loadMore]);

  useEffect(() => {
    if (session) api.tags().then((t) => setAllTags(t.map((x) => x.name))).catch(() => {});
  }, [session]);

  const changeTags = (img: ImageDto, next: string[]) => {
    const apply = (updated: ImageDto) =>
      setImages((prev) => {
        if (!prev) return prev;
        const keep = keepAfterTagChange?.(updated) ?? true;
        if (!keep) setTotal((t) => Math.max(0, t - 1));
        return keep ? prev.map((i) => (i.id === updated.id ? updated : i)) : prev.filter((i) => i.id !== updated.id);
      });
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
    <Shell title={docTitle} right={session ? <SessionActions email={session.user.email} /> : undefined}>
      <Stack gap="lg">
        <Group gap="sm" align="baseline">
          {heading}
          {images && (
            <Text c="dimmed">
              {total.toLocaleString()} {total === 1 ? "image" : "images"}
            </Text>
          )}
        </Group>
        {error ? (
          <Text c="red">{error}</Text>
        ) : images === null ? (
          <Loader />
        ) : (
          <ImageGrid images={images} allTags={session ? allTags : undefined} onTagsChange={session ? changeTags : undefined} empty={empty} />
        )}
        <div ref={sentinel} />
        {images && !exhausted.current && (
          <Center py="md">
            <Loader size="sm" />
          </Center>
        )}
      </Stack>
    </Shell>
  );
}
