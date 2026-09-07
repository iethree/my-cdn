import { ActionIcon, AspectRatio, Badge, CopyButton, Group, SimpleGrid, Text, Tooltip } from "@mantine/core";
import { imageUrl, type ImageDto } from "../../shared/types";
import { CheckIcon, CopyIcon } from "../icons";
import { TagPopover } from "./TagPopover";

type Props = {
  images: ImageDto[];
  onSelect?: (image: ImageDto) => void;
  allTags?: string[];
  onTagsChange?: (image: ImageDto, tags: string[]) => void;
  empty?: string;
};

export function ImageGrid({ images, onSelect, allTags, onTagsChange, empty = "Nothing here yet." }: Props) {
  if (images.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        {empty}
      </Text>
    );
  }
  return (
    <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="lg">
      {images.map((img) => (
        <ImageCard key={img.id} image={img} onSelect={onSelect} allTags={allTags} onTagsChange={onTagsChange} />
      ))}
    </SimpleGrid>
  );
}

function ImageCard({ image: img, onSelect, allTags, onTagsChange }: { image: ImageDto } & Omit<Props, "images" | "empty">) {
  const body = (
    <>
      <AspectRatio ratio={1}>
        <img src={imageUrl("", img.name, 512)} alt={img.name} loading="lazy" />
      </AspectRatio>
      <div className="image-card-caption">
        <Text size="sm" fw={700} truncate>
          {img.name}
        </Text>
        {img.tags.length > 0 && (
          <Group gap={4} mt={4} wrap="nowrap" style={{ overflow: "hidden" }}>
            {img.tags.slice(0, 3).map((t) => (
              <Badge key={t} size="xs">
                {t}
              </Badge>
            ))}
            {img.tags.length > 3 && (
              <Text size="xs" c="dimmed">
                +{img.tags.length - 3}
              </Text>
            )}
          </Group>
        )}
      </div>
    </>
  );

  return (
    <div className="sticker image-card">
      {onSelect ? (
        <div className="image-card-body" onClick={() => onSelect(img)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onSelect(img)}>
          {body}
        </div>
      ) : (
        <a className="image-card-body" href={imageUrl("", img.name)} target="_blank" rel="noreferrer">
          {body}
        </a>
      )}
      <Group className="image-card-actions" gap={4} onClick={(e) => e.stopPropagation()}>
        <CopyButton value={imageUrl(window.location.origin, img.name)}>
          {({ copied, copy }) => (
            <Tooltip label={copied ? "Copied!" : "Copy link"}>
              <ActionIcon variant={copied ? "filled" : "default"} color="teal" radius="xl" aria-label="Copy link" onClick={copy}>
                {copied ? <CheckIcon width={15} height={15} /> : <CopyIcon width={15} height={15} />}
              </ActionIcon>
            </Tooltip>
          )}
        </CopyButton>
        {onTagsChange && <TagPopover image={img} allTags={allTags ?? []} onChange={(tags) => onTagsChange(img, tags)} />}
      </Group>
    </div>
  );
}
