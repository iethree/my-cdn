import { ActionIcon, Badge, Button, CopyButton, Group, Modal, Stack, TagsInput, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useEffect, useState } from "react";
import { imageUrl, NAME_RE, type ImageDto } from "../../shared/types";
import { api, formatBytes } from "../api";
import { CheckIcon, CopyIcon, TrashIcon, XIcon } from "../icons";

type Props = {
  image: ImageDto | null;
  suggestions: string[];
  onClose: () => void;
  onChange: (image: ImageDto) => void;
  onDelete: (id: string) => void;
};

const fail = (e: unknown) =>
  notifications.show({ color: "red", title: "That didn't work", message: e instanceof Error ? e.message : "Unknown error" });

export function ImageModal({ image, suggestions, onClose, onChange, onDelete }: Props) {
  const [name, setName] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [alias, setAlias] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (image) {
      setName(image.name);
      setTags(image.tags);
      setAlias("");
      setConfirm(false);
    }
  }, [image]);

  if (!image) return null;
  const origin = window.location.origin;
  const dirty = name !== image.name || tags.join(",") !== image.tags.join(",");

  const run = async (fn: () => Promise<ImageDto | void>) => {
    setBusy(true);
    try {
      const updated = await fn();
      if (updated) onChange(updated);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    run(async () => {
      if (!NAME_RE.test(name)) throw new Error("Names may only contain letters, numbers, dots, dashes and underscores");
      return api.update(image.id, { name, tags });
    });

  const addAlias = () =>
    run(async () => {
      const a = alias.trim();
      if (!NAME_RE.test(a)) throw new Error("Aliases may only contain letters, numbers, dots, dashes and underscores");
      const updated = await api.addAlias(image.id, a);
      setAlias("");
      return updated;
    });

  const remove = () =>
    run(async () => {
      await api.remove(image.id);
      onDelete(image.id);
      onClose();
    });

  return (
    <Modal opened onClose={onClose} title={<Text fw={800}>{image.name}</Text>} size="lg">
      <Stack gap="md">
        <img className="preview" src={imageUrl("", image.name, 1024)} alt={image.name} />
        <Text size="xs" c="dimmed" ta="center">
          {image.width}×{image.height} · {formatBytes(image.size)} · {image.contentType.replace("image/", "")} · uploaded as “{image.originalName}” on{" "}
          {new Date(image.createdAt).toLocaleDateString()}
        </Text>

        <LinkRow label="Link" url={imageUrl(origin, image.name)} />

        <TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <TagsInput label="Tags" value={tags} onChange={setTags} data={suggestions} splitChars={[",", " "]} clearable />
        <Group justify="flex-end">
          <Button onClick={save} disabled={!dirty || busy} loading={busy && dirty}>
            Save changes
          </Button>
        </Group>

        <Stack gap="xs">
          <Text fw={700} size="sm">
            Aliases
          </Text>
          <Text size="xs" c="dimmed">
            Extra names that point at this same image.
          </Text>
          {image.aliases.map((a) => (
            <Group key={a} gap="xs" wrap="nowrap">
              <Badge size="lg" variant="outline" style={{ flex: 1, justifyContent: "flex-start" }} tt="none">
                {a}
              </Badge>
              <CopyButton value={imageUrl(origin, a)}>
                {({ copied, copy }) => (
                  <ActionIcon variant="light" color={copied ? "teal" : "brand"} onClick={copy} aria-label="Copy alias link">
                    {copied ? <CheckIcon /> : <CopyIcon />}
                  </ActionIcon>
                )}
              </CopyButton>
              <ActionIcon variant="subtle" color="red" onClick={() => run(() => api.removeAlias(image.id, a))} aria-label="Remove alias">
                <XIcon />
              </ActionIcon>
            </Group>
          ))}
          <Group gap="xs" wrap="nowrap">
            <TextInput
              placeholder="another-name.jpg"
              value={alias}
              onChange={(e) => setAlias(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && addAlias()}
              style={{ flex: 1 }}
            />
            <Button variant="light" onClick={addAlias} disabled={!alias.trim() || busy}>
              Add alias
            </Button>
          </Group>
        </Stack>

        <Group justify="space-between" mt="sm">
          <Button
            variant={confirm ? "filled" : "subtle"}
            color="red"
            leftSection={<TrashIcon />}
            onClick={() => (confirm ? remove() : setConfirm(true))}
            onBlur={() => setConfirm(false)}
            disabled={busy}
          >
            {confirm ? "Really delete?" : "Delete"}
          </Button>
          <Button variant="default" onClick={onClose}>
            Close
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function LinkRow({ label, url }: { label: string; url: string }) {
  return (
    <TextInput
      label={label}
      value={url}
      readOnly
      onFocus={(e) => e.currentTarget.select()}
      rightSectionWidth={44}
      rightSection={
        <CopyButton value={url}>
          {({ copied, copy }) => (
            <ActionIcon variant="light" color={copied ? "teal" : "brand"} onClick={copy} aria-label="Copy link">
              {copied ? <CheckIcon /> : <CopyIcon />}
            </ActionIcon>
          )}
        </CopyButton>
      }
    />
  );
}
