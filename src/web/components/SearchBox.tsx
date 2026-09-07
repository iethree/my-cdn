import { CloseButton, TextInput } from "@mantine/core";
import { SearchIcon } from "../icons";

export function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <TextInput
      size="lg"
      radius="xl"
      placeholder="Search by name, alias or tag…"
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      leftSection={<SearchIcon />}
      rightSection={value ? <CloseButton onClick={() => onChange("")} aria-label="Clear search" /> : null}
      aria-label="Search images"
    />
  );
}
