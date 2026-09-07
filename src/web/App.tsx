import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import { cachedConfig, ConfigContext, fetchConfig } from "./config";
import { AllImages } from "./pages/AllImages";
import { Home } from "./pages/Home";
import { NotFound } from "./pages/NotFound";
import { TagGallery } from "./pages/TagGallery";
import { Users } from "./pages/Users";
import { makeTheme } from "./theme";

export function App() {
  const [config, setConfig] = useState(cachedConfig);
  const theme = useMemo(() => makeTheme(config.color), [config.color]);

  useEffect(() => {
    fetchConfig()
      .then((fresh) => {
        if (fresh.name !== config.name || fresh.color !== config.color) setConfig(fresh);
      })
      .catch(() => {});
  }, []);

  return (
    <ConfigContext.Provider value={config}>
      <MantineProvider theme={theme} defaultColorScheme="auto">
        <Notifications position="bottom-right" />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/t/:tag" element={<TagGallery />} />
            <Route path="/u" element={<Users />} />
            <Route path="/all" element={<AllImages />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </MantineProvider>
    </ConfigContext.Provider>
  );
}
