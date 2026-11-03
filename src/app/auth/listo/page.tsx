"use client";

import { useEffect } from "react";

/**
 * Fin del inicio de sesión abierto en una ventana aparte (cuando la sesión
 * venció en medio de la edición): avisa al editor y se cierra sola, así no se
 * pierde nada de lo que había en pantalla.
 */
export default function AuthDone() {
  useEffect(() => {
    window.opener?.postMessage({ type: "mm-auth-ok" }, window.location.origin);
    const t = setTimeout(() => window.close(), 300);
    return () => clearTimeout(t);
  }, []);
  return (
    <main className="home">
      <p>Listo, ya iniciaste sesión. Podés cerrar esta ventana.</p>
    </main>
  );
}
