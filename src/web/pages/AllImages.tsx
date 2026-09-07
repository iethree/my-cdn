import { Center, Loader, Title } from "@mantine/core";
import { useCallback } from "react";
import { Navigate } from "react-router";
import { api } from "../api";
import { authClient } from "../auth";
import { Gallery } from "../components/Gallery";
import { Shell } from "../components/Shell";

export function AllImages() {
  const { data: session, isPending } = authClient.useSession();
  const fetchPage = useCallback((cursor: string | null) => api.images("", cursor), []);
  if (isPending) {
    return (
      <Shell>
        <Center py="xl">
          <Loader />
        </Center>
      </Shell>
    );
  }
  if (!session) return <Navigate to="/" replace />;
  return <Gallery docTitle="All images" heading={<Title order={2}>All images</Title>} fetchPage={fetchPage} empty="Nothing uploaded yet." />;
}
