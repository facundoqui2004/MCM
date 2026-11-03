"use client";

import { useCallback, useEffect, useRef } from "react";
import { AuthError, ConflictError, mapsApi } from "../api/client";
import { useMindMap } from "../store/mindmap-store";

const DEBOUNCE_MS = 900;
/** En Google Drive cada guardado crea una versión del archivo: se agrupan más los cambios */
const DEBOUNCE_DRIVE_MS = 2500;
const RETRY_BASE_MS = 2000;
const RETRY_MAX_MS = 30000;

/**
 * Guardado automático con debounce. Serializa los guardados (nunca hay dos PUT
 * en vuelo) y usa la versión del servidor para detectar ediciones concurrentes.
 *
 * Si un guardado falla por red o servidor, reintenta solo con espera creciente
 * (2 s, 4 s, 8 s… hasta 30 s) y también apenas el navegador recupera conexión.
 * Mientras haya cambios sin guardar, cerrar la pestaña pide confirmación.
 */
export function useAutosave({ drive = false }: { drive?: boolean } = {}) {
  const debounce = drive ? DEBOUNCE_DRIVE_MS : DEBOUNCE_MS;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const pending = useRef(false);
  const attempts = useRef(0);

  const schedule = (fn: () => void, ms: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(fn, ms);
  };

  const saveNow = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    const s = useMindMap.getState();
    if (!s.mapId || s.saveStatus === "conflict") return;
    if (s.saveStatus === "auth" && !navigator.onLine) return;
    if (inFlight.current) {
      pending.current = true;
      return;
    }
    inFlight.current = true;
    const revisionAtStart = s.revision;
    s.setSaveStatus("saving");
    try {
      const { version } = await mapsApi.save(s.mapId, { title: s.title.trim() || "Mapa sin título", doc: s.toDoc(), version: s.version });
      attempts.current = 0;
      const changedMeanwhile = useMindMap.getState().revision !== revisionAtStart;
      useMindMap.getState().setSaveStatus(changedMeanwhile ? "dirty" : "saved", version);
      if (changedMeanwhile) pending.current = true;
    } catch (err) {
      if (err instanceof ConflictError) {
        useMindMap.getState().setSaveStatus("conflict");
      } else if (err instanceof AuthError) {
        // sin reintentos solos: espera a que el usuario vuelva a iniciar sesión
        useMindMap.getState().setSaveStatus("auth");
      } else {
        useMindMap.getState().setSaveStatus("error");
        const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** attempts.current);
        attempts.current += 1;
        schedule(() => void saveNow(), delay);
      }
    } finally {
      inFlight.current = false;
      // cambios llegados durante el PUT: se guardan enseguida, salvo que estemos
      // en racha de errores (ahí ya hay un reintento con espera programado)
      if (pending.current && !["error", "auth"].includes(useMindMap.getState().saveStatus)) {
        pending.current = false;
        schedule(() => void saveNow(), debounce);
      }
    }
  }, [debounce]);

  useEffect(() => {
    const unsub = useMindMap.subscribe(
      (s) => s.revision,
      (rev) => {
        if (rev === 0) return;
        // durante una racha de errores manda el reintento programado, no cada tecla
        if (["error", "auth"].includes(useMindMap.getState().saveStatus)) return;
        schedule(() => void saveNow(), debounce);
      },
    );
    const flush = () => {
      if (useMindMap.getState().saveStatus === "dirty") void saveNow();
    };
    const online = () => {
      if (["error", "dirty"].includes(useMindMap.getState().saveStatus)) void saveNow();
    };
    const warnUnsaved = (e: BeforeUnloadEvent) => {
      if (["error", "dirty", "saving", "conflict", "auth"].includes(useMindMap.getState().saveStatus)) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    // volvió de iniciar sesión en la ventanita: se guarda lo pendiente
    const authOk = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data?.type === "mm-auth-ok") void saveNow();
    };
    window.addEventListener("message", authOk);
    window.addEventListener("pagehide", flush);
    window.addEventListener("online", online);
    window.addEventListener("beforeunload", warnUnsaved);
    return () => {
      unsub();
      window.removeEventListener("message", authOk);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("online", online);
      window.removeEventListener("beforeunload", warnUnsaved);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [saveNow, debounce]);

  return { saveNow };
}
