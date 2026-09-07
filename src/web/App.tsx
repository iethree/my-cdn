import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { BrowserRouter, Route, Routes } from "react-router";
import { Home } from "./pages/Home";
import { NotFound } from "./pages/NotFound";
import { TagGallery } from "./pages/TagGallery";
import { Users } from "./pages/Users";
import { theme } from "./theme";

export function App() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <Notifications position="bottom-right" />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/t/:tag" element={<TagGallery />} />
          <Route path="/u" element={<Users />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </MantineProvider>
  );
}
