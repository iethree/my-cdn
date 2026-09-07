import { ActionIcon, AspectRatio, Badge, CopyButton, Group, SimpleGrid, Text, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useRef, type PointerEvent, type SyntheticEvent } from "react";
import { imageUrl, type ImageDto } from "../../shared/types";
import { CheckIcon, CopyIcon } from "../icons";
import { LazyImage } from "./LazyImage";
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

const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE = 10;

// Touch long-press copies the link. The copy runs on release so it happens inside a user activation.
function useLongPressCopy(url: string) {
  const press = useRef<{ timer?: ReturnType<typeof setTimeout>; armed: boolean; x: number; y: number; swallowClick: boolean }>({
    armed: false,
    x: 0,
    y: 0,
    swallowClick: false,
  });
  const clear = () => {
    clearTimeout(press.current.timer);
    press.current.timer = undefined;
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      navigator.vibrate?.(15);
      notifications.show({ message: "Link copied", autoClose: 1500, withCloseButton: false });
    } catch {
      notifications.show({ color: "red", message: "Couldn't copy the link", autoClose: 2000, withCloseButton: false });
    }
  };
  return {
    onPointerDown: (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      press.current = { armed: false, x: e.clientX, y: e.clientY, swallowClick: false };
      press.current.timer = setTimeout(() => {
        press.current.armed = true;
        navigator.vibrate?.(10);
      }, LONG_PRESS_MS);
    },
    onPointerMove: (e: PointerEvent) => {
      if (!press.current.timer) return;
      if (Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) > MOVE_TOLERANCE) clear();
    },
    onPointerUp: (e: PointerEvent) => {
      const armed = press.current.armed;
      clear();
      press.current.armed = false;
      if (!armed) return;
      e.preventDefault();
      press.current.swallowClick = true;
      copy();
    },
    onPointerCancel: () => {
      clear();
      press.current.armed = false;
    },
    onContextMenu: (e: SyntheticEvent) => {
      if (press.current.timer || press.current.armed) e.preventDefault();
    },
    onClickCapture: (e: SyntheticEvent) => {
      if (!press.current.swallowClick) return;
      press.current.swallowClick = false;
      e.preventDefault();
      e.stopPropagation();
    },
  };
}

function ImageCard({ image: img, onSelect, allTags, onTagsChange }: { image: ImageDto } & Omit<Props, "images" | "empty">) {
  const url = imageUrl(window.location.origin, img.name);
  const longPress = useLongPressCopy(url);
  const body = (
    <>
      <AspectRatio ratio={1}>
        <LazyImage src={imageUrl("", img.name, 512)} alt={img.name} />
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
    <div className="sticker image-card" {...longPress}>
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
        <CopyButton value={url}>
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
