import { ActionIcon, Container, Group, Box, useComputedColorScheme, useMantineColorScheme } from "@mantine/core";
import { useEffect, type ReactNode } from "react";
import { Link } from "react-router";
import { applyDocument, useConfig } from "../config";
import { MoonIcon, SunIcon } from "../icons";

function Wordmark({ name }: { name: string }) {
  const dot = name.indexOf(".");
  if (dot <= 0 || dot === name.length - 1) return <>{name}</>;
  return (
    <>
      {name.slice(0, dot)}
      <span>.</span>
      {name.slice(dot + 1)}
    </>
  );
}

export function Shell({ children, right, title }: { children: ReactNode; right?: ReactNode; title?: string }) {
  const config = useConfig();
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme("light");

  useEffect(() => applyDocument(config, title), [config, title]);

  return (
    <>
      <header className="topbar">
        <Box p="sm">
          <Group justify="space-between">
            <Link to="/" className="wordmark">
              <Wordmark name={config.name} />
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
        </Box>
      </header>
      <Container size="lg" py="xl">
        {children}
      </Container>
    </>
  );
}
