import { ActionIcon, Container, Group, useComputedColorScheme, useMantineColorScheme } from "@mantine/core";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { MoonIcon, SunIcon } from "../icons";

export function Shell({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme("light");
  return (
    <>
      <header>
          <Group justify="space-between" p="md">
            <Link to="/" className="wordmark">
              my<span>.</span>cdn
            </Link>
            <Group gap="xs">
              {right}
              <ActionIcon
                variant="default"
                size="lg"
                radius="xl"
                aria-label="Toggle color scheme"
                onClick={() => setColorScheme(scheme === "dark" ? "light" : "dark")}
              >
                {scheme === "dark" ? <SunIcon /> : <MoonIcon />}
              </ActionIcon>
            </Group>
          </Group>
      </header>
      <Container size="lg" py="xl">
        {children}
      </Container>
    </>
  );
}
