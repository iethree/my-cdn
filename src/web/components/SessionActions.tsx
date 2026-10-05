import { Burger, Button, Group, Menu, Text, useComputedColorScheme, useMantineColorScheme } from "@mantine/core";
import { useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { authClient } from "../auth";
import { useConfig } from "../config";
import { GearIcon, GridIcon, KeyIcon, MoonIcon, SunIcon, UsersIcon } from "../icons";
import { ChangePasswordModal } from "./ChangePasswordModal";

type Item = { key: string; label: string; icon: ReactNode; to?: string; onClick?: () => void };

export function SessionActions({ email }: { email: string }) {
  const path = useLocation().pathname;
  const { plan } = useConfig();
  const [pwOpen, setPwOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme("light");
  const onUsers = path.startsWith("/u");

  const items: Item[] = [
    ...(!path.startsWith("/all") ? [{ key: "all", label: "All images", icon: <GridIcon width={14} height={14} />, to: "/all" }] : []),
    { key: "users", label: onUsers ? "Images" : "Users", icon: <UsersIcon width={14} height={14} />, to: onUsers ? "/" : "/u" },
    ...(plan === "free" ? [{ key: "password", label: "Password", icon: <KeyIcon width={14} height={14} />, onClick: () => setPwOpen(true) }] : []),
    ...(!path.startsWith("/settings") ? [{ key: "settings", label: "Settings", icon: <GearIcon width={14} height={14} />, to: "/settings" }] : []),
  ];
  const themeItem: Item = {
    key: "theme",
    label: scheme === "dark" ? "Light mode" : "Dark mode",
    icon: scheme === "dark" ? <SunIcon width={14} height={14} /> : <MoonIcon width={14} height={14} />,
    onClick: () => setColorScheme(scheme === "dark" ? "light" : "dark"),
  };
  const signOut: Item = { key: "signout", label: "Sign out", icon: null, onClick: () => authClient.signOut() };

  const button = (item: Item) =>
    item.to ? (
      <Button key={item.key} component={Link} to={item.to} variant="default" size="xs" radius="xl" leftSection={item.icon}>
        {item.label}
      </Button>
    ) : (
      <Button key={item.key} variant="default" size="xs" radius="xl" leftSection={item.icon} onClick={item.onClick}>
        {item.label}
      </Button>
    );

  const menuItem = (item: Item) =>
    item.to ? (
      <Menu.Item key={item.key} component={Link} to={item.to} leftSection={item.icon}>
        {item.label}
      </Menu.Item>
    ) : (
      <Menu.Item key={item.key} leftSection={item.icon} onClick={item.onClick}>
        {item.label}
      </Menu.Item>
    );

  return (
    <>
      <Group gap="xs" visibleFrom="sm">
        <Text size="sm" c="dimmed">
          {email}
        </Text>
        {items.map(button)}
        {button(signOut)}
      </Group>

      <Menu opened={menuOpen} onChange={setMenuOpen} position="bottom-end" width={230} radius="md" shadow="md">
        <Menu.Target>
          <Burger hiddenFrom="sm" size="sm" opened={menuOpen} aria-label="Menu" />
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{email}</Menu.Label>
          {items.map(menuItem)}
          <Menu.Divider />
          {menuItem(themeItem)}
          {menuItem(signOut)}
        </Menu.Dropdown>
      </Menu>

      {plan === "free" && <ChangePasswordModal opened={pwOpen} onClose={() => setPwOpen(false)} />}
    </>
  );
}
