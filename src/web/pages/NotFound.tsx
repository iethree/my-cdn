import { Anchor, Stack, Text, Title } from "@mantine/core";
import { Link } from "react-router";
import { Shell } from "../components/Shell";

export function NotFound() {
  return (
    <Shell>
      <Stack align="center" py="xl" gap="xs">
        <Title order={2}>Nothing here</Title>
        <Text c="dimmed">That page doesn't exist.</Text>
        <Anchor component={Link} to="/" fw={700}>
          Back home
        </Anchor>
      </Stack>
    </Shell>
  );
}
