import { ActionIcon, Chip, Group, Popover, ScrollArea, Stack, Text, TextInput, Tooltip } from "@mantine/core";
import { useMemo, useState } from "react";
import { normalizeTag, TAG_RE, type ImageDto } from "../../shared/types";
import { TagIcon } from "../icons";

type Props = { image: ImageDto; allTags: string[]; onChange: (tags: string[]) => void };

export function TagPopover({ image, allTags, onChange }: Props) {
  const [opened, setOpened] = useState(false);
  const [filter, setFilter] = useState("");
  const query = normalizeTag(filter);
  const options = useMemo(() => {
    const set = new Set([...allTags, ...image.tags]);
    return [...set].sort().filter((t) => !query || t.includes(query));
  }, [allTags, image.tags, query]);
  const canCreate = query && TAG_RE.test(query) && !options.includes(query);

  const toggle = (tag: string) =>
    onChange(image.tags.includes(tag) ? image.tags.filter((t) => t !== tag) : [...image.tags, tag].sort());

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-end"
      width={240}
      shadow="md"
      radius="md"
      trapFocus
      withinPortal
    >
      <Popover.Target>
        <Tooltip label="Tags" disabled={opened}>
          <ActionIcon
            variant="default"
            radius="xl"
            aria-label="Edit tags"
            onClick={(e) => {
              e.stopPropagation();
              setOpened((o) => !o);
            }}
          >
            <TagIcon width={15} height={15} />
          </ActionIcon>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown onClick={(e) => e.stopPropagation()}>
        <Stack gap="xs">
          <TextInput
            size="xs"
            placeholder={allTags.length ? "Filter or add a tag…" : "New tag…"}
            value={filter}
            onChange={(e) => setFilter(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (canCreate || options.length === 1)) {
                e.preventDefault();
                toggle(canCreate ? query : options[0]!);
                setFilter("");
              }
            }}
            data-autofocus
          />
          <ScrollArea.Autosize mah={220}>
            <Group gap={6}>
              {options.map((t) => (
                <Chip key={t} size="xs" checked={image.tags.includes(t)} onChange={() => toggle(t)}>
                  {t}
                </Chip>
              ))}
              {canCreate && (
                <Chip size="xs" variant="outline" checked={false} onChange={() => (toggle(query), setFilter(""))}>
                  + {query}
                </Chip>
              )}
              {options.length === 0 && !canCreate && (
                <Text size="xs" c="dimmed">
                  {query ? "Not a valid tag name" : "No tags yet. Type one above."}
                </Text>
              )}
            </Group>
          </ScrollArea.Autosize>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
