import { Badge, Group, Text } from "@mantine/core";
import { Link } from "react-router";
import type { TagDto } from "../../shared/types";

export function TagList({ tags }: { tags: TagDto[] }) {
  if (tags.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        No tags yet. Add some when you upload.
      </Text>
    );
  }
  return (
    <Group gap="xs">
      {tags.map((t) => (
        <Badge
          key={t.name}
          component={Link}
          to={`/t/${encodeURIComponent(t.name)}`}
          className="tag-link"
          size="lg"
          variant="outline"
          rightSection={
            <Text span size="xs" c="dimmed" fw={800}>
              {t.count}
            </Text>
          }
        >
          {t.name}
        </Badge>
      ))}
    </Group>
  );
}
