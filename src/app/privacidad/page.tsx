import Link from "next/link";

export const metadata = { title: "Política de privacidad — Mindmap Studio" };

const UPDATED = "3 de noviembre de 2026";

export default function Privacidad() {
  return (
    <main className="home mm-legal">
      <Link href="/" className="mm-legal-back">
        ← Volver a Mindmap Studio
      </Link>
      <h1>Política de privacidad</h1>
      <p className="mm-legal-date">Última actualización: {UPDATED}</p>

      <p>
        Mindmap Studio es una aplicación web para crear mapas mentales. Esta política explica qué datos usa la app,
        para qué y dónde quedan guardados.
      </p>

      <h2>1. Si usás la app sin iniciar sesión</h2>
      <p>
        Los mapas que crees se guardan en la base de datos del sitio. No se piden datos personales. Esos mapas no
        están protegidos por una cuenta, así que no guardes información sensible en ellos.
      </p>

      <h2>2. Si iniciás sesión con Google</h2>
      <p>Al iniciar sesión, Google le entrega a la app:</p>
      <ul>
        <li>
          <strong>Tu nombre, tu email y tu foto de perfil</strong>: se usan sólo para mostrarte con qué cuenta
          entraste.
        </li>
        <li>
          <strong>Permiso de acceso a Google Drive limitado a los archivos que crea la app</strong> (permiso{" "}
          <code>drive.file</code>): la app guarda cada mapa como un archivo <code>.mindmap.json</code> en una carpeta
          &quot;Mindmap Studio&quot; de tu Drive, y los lee para mostrártelos. No puede ver, abrir ni modificar ningún
          otro archivo de tu Drive.
        </li>
      </ul>
      <p>
        Tus mapas quedan en <strong>tu</strong> Google Drive, no en los servidores de la app. La app no tiene una base
        de datos de usuarios: los datos de tu sesión viajan en una cookie cifrada que sólo el servidor puede leer, y que
        se borra al cerrar sesión.
      </p>

      <h2>3. Qué no hacemos</h2>
      <ul>
        <li>No vendemos, alquilamos ni compartimos tus datos con nadie.</li>
        <li>No usamos tus datos para publicidad ni para entrenar modelos de inteligencia artificial.</li>
        <li>No leemos el contenido de tus mapas salvo para guardarlos y mostrártelos.</li>
      </ul>
      <p>
        El uso de la información recibida de las APIs de Google cumple con la{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
          Política de datos de usuario de los servicios de API de Google
        </a>
        , incluidos los requisitos de uso limitado.
      </p>

      <h2>4. Servicios que usa la app</h2>
      <ul>
        <li>
          <strong>Vercel</strong>: aloja la app.
        </li>
        <li>
          <strong>Google</strong>: inicio de sesión y almacenamiento en Google Drive.
        </li>
        <li>
          <strong>Turso</strong>: base de datos de los mapas creados sin iniciar sesión.
        </li>
      </ul>

      <h2>5. Cómo borrar tus datos</h2>
      <ul>
        <li>Tus mapas: borralos desde la app o directamente desde la carpeta &quot;Mindmap Studio&quot; de tu Drive.</li>
        <li>
          El acceso de la app a tu cuenta: quitalo cuando quieras desde{" "}
          <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">
            myaccount.google.com/permissions
          </a>
          .
        </li>
        <li>La sesión: tocá &quot;Cerrar sesión&quot; en la página principal.</li>
      </ul>

      <h2>6. Contacto</h2>
      <p>
        Para consultas sobre privacidad, escribinos abriendo un issue en{" "}
        <a href="https://github.com/facundoqui2004/MCM/issues" target="_blank" rel="noreferrer">
          github.com/facundoqui2004/MCM
        </a>{" "}
        o al email de asistencia que figura en la pantalla de inicio de sesión de Google.
      </p>
    </main>
  );
}
