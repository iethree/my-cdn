import { Anchor, Button, CopyButton, Group, Progress, Stack, TagsInput, Text, Tooltip } from "@mantine/core";
import { Dropzone, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import { useEffect, useRef, useState } from "react";
import { imageUrl, MAX_UPLOAD_BYTES, type ImageDto } from "../../shared/types";
import { formatBytes, uploadImage, type ClientUploadEvent } from "../api";
import { CheckIcon, CopyIcon, UploadIcon, XIcon } from "../icons";

type Stage = "queued" | "uploading" | "analyzing" | "compressing" | "storing" | "done" | "error";
type Item = { key: string; file: File; preview: string; stage: Stage; loaded: number; image?: ImageDto; error?: string };

const ACCEPT = IMAGE_MIME_TYPE.filter((t) => t !== "image/svg+xml");
const CONCURRENCY = 3;
const UPLOAD_SHARE = 55;
const PROCESS_STEPS: Record<Stage, number> = {
  queued: 0,
  uploading: 0,
  analyzing: 10,
  compressing: 25,
  storing: 40,
  done: 45,
  error: 0,
};

function status(item: Item): string {
  switch (item.stage) {
    case "queued":
      return "Waiting…";
    case "uploading":
      return `Uploading · ${formatBytes(item.loaded)} of ${formatBytes(item.file.size)} (${Math.round((item.loaded / item.file.size) * 100)}%)`;
    case "analyzing":
      return "Uploaded · checking image…";
    case "compressing":
      return "Compressing (max 2048px)…";
    case "storing":
      return "Saving…";
    case "done": {
      const saved = 1 - item.image!.size / item.file.size;
      return `Done · ${formatBytes(item.file.size)} → ${formatBytes(item.image!.size)}${saved > 0.01 ? ` (−${Math.round(saved * 100)}%)` : ""} · ${item.image!.width}×${item.image!.height}`;
    }
    case "error":
      return item.error ?? "Failed";
  }
}

export function UploadBox({ suggestions, onUploaded }: { suggestions: string[]; onUploaded: (image: ImageDto) => void }) {
  const [tags, setTags] = useState<string[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const queue = useRef<Item[]>([]);
  const active = useRef(0);
  const tagsRef = useRef(tags);
  tagsRef.current = tags;
  const previews = useRef<string[]>([]);

  useEffect(() => () => previews.current.forEach((p) => URL.revokeObjectURL(p)), []);

  const patch = (key: string, p: Partial<Item>) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...p } : i)));

  const pump = () => {
    while (active.current < CONCURRENCY && queue.current.length) {
      const item = queue.current.shift()!;
      active.current++;
      const onEvent = (e: ClientUploadEvent) => {
        if (e.stage === "uploading") patch(item.key, { stage: "uploading", loaded: e.loaded });
        else if (e.stage !== "done" && e.stage !== "error") patch(item.key, { stage: e.stage });
      };
      uploadImage(item.file, tagsRef.current, onEvent)
        .then((image) => {
          patch(item.key, { stage: "done", image });
          onUploaded(image);
        })
        .catch((err: Error) => patch(item.key, { stage: "error", error: err.message }))
        .finally(() => {
          active.current--;
          pump();
        });
    }
  };

  const onDrop = (files: File[]) => {
    const fresh = files.map<Item>((file) => ({
      key: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      stage: "queued",
      loaded: 0,
    }));
    previews.current.push(...fresh.map((i) => i.preview));
    setItems((prev) => [...fresh, ...prev]);
    queue.current.push(...fresh);
    pump();
  };

  const onReject = (rejections: { file: File }[]) => {
    setItems((prev) => [
      ...rejections.map<Item>(({ file }) => ({
        key: crypto.randomUUID(),
        file,
        preview: "",
        stage: "error",
        loaded: 0,
        error: file.size > MAX_UPLOAD_BYTES ? "Larger than 25 MB" : "Not a supported image",
      })),
      ...prev,
    ]);
  };

  return (
    <Stack gap="md">
      <Dropzone
        className="dropzone"
        onDrop={onDrop}
        onReject={onReject}
        accept={ACCEPT}
        maxSize={MAX_UPLOAD_BYTES}
        multiple
        py={48}
        styles={{ root: { border: undefined, background: undefined } }}
      >
        <Stack align="center" gap={6} style={{ pointerEvents: "none" }}>
          <UploadIcon width={40} height={40} />
          <Text size="xl" fw={800}>
            Drop images here
          </Text>
          <Text size="sm" c="dimmed">
            or click to pick some · JPEG, PNG, GIF, WebP, AVIF · up to 25 MB each
          </Text>
        </Stack>
      </Dropzone>

      <TagsInput
        label="Tags for new uploads"
        placeholder="Type a tag and press Enter"
        value={tags}
        onChange={(v) => setTags(v.map((t) => t.trim().toLowerCase()).filter(Boolean))}
        data={suggestions}
        splitChars={[",", " "]}
        clearable
      />

      {items.length > 0 && (
        <Stack gap="sm">
          {items.map((item) => (
            <UploadRow key={item.key} item={item} onDismiss={() => setItems((p) => p.filter((i) => i.key !== item.key))} />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function UploadRow({ item, onDismiss }: { item: Item; onDismiss: () => void }) {
  const uploadPct = item.stage === "uploading" ? (item.loaded / item.file.size) * UPLOAD_SHARE : item.stage === "queued" ? 0 : UPLOAD_SHARE;
  const processPct = PROCESS_STEPS[item.stage];
  const busy = !["done", "error", "queued"].includes(item.stage);
  const link = item.image ? imageUrl(window.location.origin, item.image.name) : "";

  return (
    <Group className="sticker" p="sm" wrap="nowrap" align="flex-start">
      {item.preview ? <img className="thumb" src={item.preview} alt="" /> : <div className="thumb" />}
      <Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
        <Group justify="space-between" wrap="nowrap">
          <Text fw={700} size="sm" truncate>
            {item.image?.name ?? item.file.name}
          </Text>
          {!busy && (
            <Button variant="subtle" color="gray" size="compact-xs" onClick={onDismiss} aria-label="Dismiss">
              <XIcon width={14} height={14} />
            </Button>
          )}
        </Group>
        <Progress.Root size="lg" radius="xl">
          <Tooltip label="Upload">
            <Progress.Section value={uploadPct} color="brand" animated={item.stage === "uploading"} />
          </Tooltip>
          <Tooltip label="Compress and store">
            <Progress.Section value={processPct} color={item.stage === "done" ? "teal" : "grape"} animated={busy && item.stage !== "uploading"} />
          </Tooltip>
        </Progress.Root>
        <Text size="xs" c={item.stage === "error" ? "red" : "dimmed"}>
          {status(item)}
        </Text>
        {item.image && (
          <Group gap="xs" wrap="nowrap">
            <Anchor href={link} target="_blank" rel="noreferrer" size="sm" fw={700} truncate>
              {link}
            </Anchor>
            <CopyButton value={link}>
              {({ copied, copy }) => (
                <Button size="compact-sm" variant={copied ? "filled" : "light"} color={copied ? "teal" : "brand"} onClick={copy} leftSection={copied ? <CheckIcon width={14} height={14} /> : <CopyIcon width={14} height={14} />}>
                  {copied ? "Copied" : "Copy"}
                </Button>
              )}
            </CopyButton>
          </Group>
        )}
      </Stack>
    </Group>
  );
}
