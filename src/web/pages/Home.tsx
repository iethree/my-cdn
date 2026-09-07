import { Center, Loader } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useEffect } from "react";
import { useSearchParams } from "react-router";
import { authClient } from "../auth";
import { Shell } from "../components/Shell";
import { Dashboard } from "./Dashboard";
import { Login } from "./Login";

export function Home() {
  const { data: session, isPending } = authClient.useSession();
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    if (params.get("error")) {
      notifications.show({ color: "red", title: "Sign-in link didn't work", message: "It may have expired. Request a new one." });
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  if (isPending) {
    return (
      <Shell>
        <Center py="xl">
          <Loader />
        </Center>
      </Shell>
    );
  }
  return session ? <Dashboard user={session.user} /> : <Login />;
}
