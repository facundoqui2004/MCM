import Link from "next/link";

export const metadata = { title: "Términos de uso — Mindmap Studio" };

export default function Terminos() {
  return (
    <main className="home mm-legal">
      <Link href="/" className="mm-legal-back">
        ← Volver a Mindmap Studio
      </Link>
      <h1>Términos de uso</h1>
      <p className="mm-legal-date">Última actualización: 3 de noviembre de 2026</p>

      <h2>1. El servicio</h2>
      <p>
        Mindmap Studio es una aplicación web gratuita para crear mapas mentales, ofrecida &quot;tal como está&quot;, como
        proyecto personal y educativo.
      </p>

      <h2>2. Tus mapas son tuyos</h2>
      <p>
        El contenido que crees te pertenece. Si iniciás sesión con Google, tus mapas se guardan en tu propio Google
        Drive y podés descargarlos, moverlos o borrarlos cuando quieras.
      </p>

      <h2>3. Uso aceptable</h2>
      <p>No uses la app para guardar contenido ilegal ni para intentar acceder a datos de otras personas.</p>

      <h2>4. Sin garantías</h2>
      <p>
        Hacemos lo posible para que la app funcione bien y no se pierda nada (tiene guardado automático y copias en tu
        Drive), pero no podemos garantizar que esté siempre disponible ni libre de errores. Te recomendamos exportar los
        mapas importantes.
      </p>

      <h2>5. Cambios</h2>
      <p>
        Estos términos y la <Link href="/privacidad">política de privacidad</Link> pueden actualizarse. La fecha de
        arriba indica la última versión.
      </p>
    </main>
  );
}
