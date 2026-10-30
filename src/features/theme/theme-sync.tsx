"use client";

import { useLayoutEffect } from "react";
import { readDocumentTheme, useTheme } from "./theme-store";

/** Alinea el estado con el tema que aplicó el script de <head> (antes de pintar). */
export function ThemeSync() {
  useLayoutEffect(() => {
    useTheme.setState({ theme: readDocumentTheme() });
  }, []);
  return null;
}
