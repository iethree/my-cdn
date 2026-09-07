import { Button, Group, Text } from "@mantine/core";
import { Link, useLocation } from "react-router";
import { authClient } from "../auth";
import { GridIcon, UsersIcon } from "../icons";

export function SessionActions({ email }: { email: string }) {
  const path = useLocation().pathname;
  const onUsers = path.startsWith("/u");
  return (
    <Group gap="xs">
      <Text size="sm" c="dimmed" visibleFrom="sm">
        {email}
      </Text>
      {!path.startsWith("/all") && (
        <Button component={Link} to="/all" variant="default" size="xs" radius="xl" leftSection={<GridIcon width={14} height={14} />}>
          All images
        </Button>
      )}
      <Button
        component={Link}
        to={onUsers ? "/" : "/u"}
        variant="default"
        size="xs"
        radius="xl"
        leftSection={<UsersIcon width={14} height={14} />}
      >
        {onUsers ? "Images" : "Users"}
      </Button>
      <Button variant="default" size="xs" radius="xl" onClick={() => authClient.signOut()}>
        Sign out
      </Button>
    </Group>
  );
}
