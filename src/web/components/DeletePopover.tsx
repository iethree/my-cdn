import { ActionIcon, Button, Group, Popover, Stack, Text, Tooltip } from "@mantine/core";
import { useState } from "react";
import { TrashIcon } from "../icons";

export function DeletePopover({ name, onConfirm }: { name: string; onConfirm: () => Promise<void> | void }) {
  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-end" width={220} shadow="md" radius="md" withinPortal>
      <Popover.Target>
        <Tooltip label="Delete" disabled={opened}>
          <ActionIcon variant="default" radius="xl" aria-label="Delete image" onClick={(e) => { e.stopPropagation(); setOpened((o) => !o); }}>
            <TrashIcon width={15} height={15} />
          </ActionIcon>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown onClick={(e) => e.stopPropagation()}>
        <Stack gap="xs">
          <Text size="sm">
            Delete <b>{name}</b>? Its links will stop working.
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button size="compact-sm" variant="default" onClick={() => setOpened(false)}>
              Keep
            </Button>
            <Button
              size="compact-sm"
              color="red"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm();
                } finally {
                  setBusy(false);
                  setOpened(false);
                }
              }}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
