"use client";

import { useState } from "react";
import { Provider } from "react-redux";
import { makeStore, type AppStore } from "@/store/index";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { Toaster } from "@/components/ui/toast";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [store] = useState<AppStore>(() => makeStore());

  return (
    <Provider store={store}>
      <ThemeProvider>{children}</ThemeProvider>
      <Toaster />
    </Provider>
  );
}
