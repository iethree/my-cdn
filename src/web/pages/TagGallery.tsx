import { Badge, Title } from "@mantine/core";
import { useCallback } from "react";
import { useParams } from "react-router";
import { api } from "../api";
import { Gallery } from "../components/Gallery";

export function TagGallery() {
  const { tag = "" } = useParams();
  const fetchPage = useCallback((cursor: string | null) => api.tag(tag, cursor), [tag]);
  return (
    <Gallery
      docTitle={`#${tag}`}
      heading={
        <Title order={2}>
          <Badge size="xl" variant="light" tt="none" style={{ verticalAlign: "middle" }}>
            #{tag}
          </Badge>
        </Title>
      }
      fetchPage={fetchPage}
      keepAfterTagChange={(img) => img.tags.includes(tag)}
      empty="No images with this tag."
    />
  );
}
