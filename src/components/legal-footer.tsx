import Link from "next/link";

/** Links legales: Google exige que la página principal enlace la política de privacidad */
export function LegalFooter() {
  return (
    <footer className="mm-legal-footer">
      <Link href="/privacidad">Política de privacidad</Link>
      <span aria-hidden>·</span>
      <Link href="/terminos">Términos de uso</Link>
      <span aria-hidden>·</span>
      <a href="https://github.com/facundoqui2004/MCM" target="_blank" rel="noreferrer">
        Código en GitHub
      </a>
    </footer>
  );
}
