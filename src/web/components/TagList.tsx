import { Badge, Group, Text } from "@mantine/core";
import { Link } from "react-router";
import type { TagDto } from "../../shared/types";

export function TagList({ tags, singleRow = false, empty = "No tags yet. Add some when you upload." }: { tags: TagDto[]; singleRow?: boolean; empty?: string }) {
  if (tags.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        {empty}
      </Text>
    );
  }
  const badges = tags.map((t) => (
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
  ));
  return singleRow ? (
    <div className="tag-row">
      <Group gap="xs" wrap="nowrap">
        {badges}
      </Group>
    </div>
  ) : (
    <Group gap="xs">{badges}</Group>
  );
}
