import {
  Action,
  ActionPanel,
  Clipboard,
  getPreferenceValues,
  Grid,
  Icon,
  Keyboard,
  openExtensionPreferences,
  showHUD,
  showToast,
  Toast,
} from "@raycast/api";
import { useFetch } from "@raycast/utils";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { useState } from "react";

// Mirrors ImageDto / ImagePage in src/shared/types.ts.
type Image = {
  id: string;
  name: string;
  contentType: string;
  size: number;
  width: number;
  height: number;
  tags: string[];
  aliases: string[];
};
type ImagePage = { images: Image[]; nextCursor: string | null; total: number };

const PAGE_SIZE = 50;

function baseUrl(): string {
  const raw = getPreferenceValues<Preferences>().baseUrl.trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function imageUrl(base: string, name: string, width?: number): string {
  return `${base}/i/${encodeURIComponent(name)}${width ? `?w=${width}` : ""}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function parseResponse(res: Response): Promise<ImagePage> {
  const body = (await res.json().catch(() => null)) as (ImagePage & { error?: string }) | null;
  if (res.status === 401) throw new Error("This server requires sign-in to search. Deploy the latest my.cdn.");
  if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
  if (!Array.isArray(body?.images)) throw new Error("That doesn't look like a my.cdn server. Check the Base URL.");
  return body;
}

async function copyImage(url: string, name: string) {
  const toast = await showToast({ style: Toast.Style.Animated, title: "Downloading image…" });
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const dir = join(tmpdir(), "my-cdn");
    await mkdir(dir, { recursive: true });
    const file = join(dir, name);
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
    await Clipboard.copy({ file });
    await showHUD("Copied image");
  } catch (e) {
    toast.style = Toast.Style.Failure;
    toast.title = "Couldn't copy image";
    toast.message = e instanceof Error ? e.message : String(e);
  }
}

export default function Command() {
  const base = baseUrl();
  const [query, setQuery] = useState("");
  const { data, isLoading, pagination } = useFetch(
    ({ cursor }) => {
      const params = new URLSearchParams({ q: query, limit: String(PAGE_SIZE) });
      if (cursor) params.set("cursor", cursor);
      return `${base}/api/images?${params}`;
    },
    {
      parseResponse,
      mapResult: (page: ImagePage) => ({
        data: page.images,
        hasMore: page.nextCursor !== null,
        cursor: page.nextCursor,
      }),
      keepPreviousData: true,
      initialData: [],
      failureToastOptions: {
        title: "Search failed",
        primaryAction: { title: "Open Extension Preferences", onAction: () => openExtensionPreferences() },
      },
    },
  );

  return (
    <Grid
      columns={5}
      isLoading={isLoading}
      pagination={pagination}
      onSearchTextChange={setQuery}
      throttle
      searchBarPlaceholder="Search by name, alias or tag"
    >
      {!isLoading && data.length === 0 && (
        <Grid.EmptyView icon={Icon.Image} title={query ? `No images match "${query}"` : "No images yet"} />
      )}
      {data.map((image) => (
        <ImageItem key={image.id} base={base} image={image} />
      ))}
    </Grid>
  );
}

function ImageItem({ base, image }: { base: string; image: Image }) {
  const url = imageUrl(base, image.name);
  return (
    <Grid.Item
      content={{
        value: imageUrl(base, image.name, 512),
        tooltip: `${image.width}×${image.height} · ${formatSize(image.size)}`,
      }}
      title={image.name}
      subtitle={image.tags.join(", ")}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <Action.CopyToClipboard title="Copy URL" content={url} />
            <Action.Paste title="Paste URL" content={url} />
            <Action
              title="Copy Image"
              icon={Icon.Image}
              shortcut={Keyboard.Shortcut.Common.Copy}
              onAction={() => copyImage(url, image.name)}
            />
            <Action.CopyToClipboard
              title="Copy Markdown"
              content={`![${image.name}](${url})`}
              shortcut={{ modifiers: ["cmd", "shift"], key: "m" }}
            />
            <Action.OpenInBrowser url={url} shortcut={Keyboard.Shortcut.Common.Open} />
          </ActionPanel.Section>
          <ActionPanel.Section>
            {image.aliases.length > 0 && (
              <ActionPanel.Submenu title="Copy Alias URL" icon={Icon.Link}>
                {image.aliases.map((alias) => (
                  <Action.CopyToClipboard key={alias} title={alias} content={imageUrl(base, alias)} />
                ))}
              </ActionPanel.Submenu>
            )}
            {image.tags.length > 0 && (
              <ActionPanel.Submenu title="Open Tag Gallery" icon={Icon.Tag}>
                {image.tags.map((tag) => (
                  <Action.OpenInBrowser key={tag} title={tag} url={`${base}/t/${encodeURIComponent(tag)}`} />
                ))}
              </ActionPanel.Submenu>
            )}
            <Action.CopyToClipboard
              title="Copy Name"
              content={image.name}
              shortcut={Keyboard.Shortcut.Common.CopyName}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}
