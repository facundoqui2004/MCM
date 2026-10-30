# Mindmap Studio

Editor de mapas mentales en el navegador, pensado para **estudiar y repasar**: armás un tema con el teclado tan rápido como escribís una lista, y después lo plegás y desplegás de a un nivel para autoevaluarte.

**Demo:** [mcm-xi.vercel.app](https://mcm-xi.vercel.app)

![Los cuatro temas claros de Mindmap Studio](docs/temas.jpg)

## Qué hace

- **Teclado primero:** `Tab` crea una idea hija, `Enter` una hermana y tipear sobre una idea reemplaza su texto. Todo también se puede hacer con el mouse.
- **Tres distribuciones automáticas:** mapa bilateral, árbol y radial, con transiciones animadas.
- **Modo repaso:** `-` pliega todo el mapa y `+` lo vuelve a abrir de a un nivel. `/` pliega una rama sola.
- **Búsqueda y copia:** `Ctrl F` busca sin importar los acentos y abre las ramas plegadas; `Ctrl C` copia una rama como lista con sangría para pegarla en tus apuntes.
- **Nada se pierde:**
  - Guardado automático con reintento si se corta la conexión.
  - Aviso al borrar con botón *Deshacer*.
  - Si el mismo mapa se edita en dos pestañas, ofrece guardar tu versión como copia.
- **5 temas:** Papel, Cuaderno, Lavanda, Minimal y Estudio oscuro.
- **Exportar e importar** mapas como JSON.
- **Accesible y adaptable:**
  - Contrastes de al menos 4,5:1.
  - Anuncios para lector de pantalla.
  - Áreas táctiles de 44 px y vista legible en el celular.

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript |
| Lienzo | React Flow 12 (`@xyflow/react`) con nodos y conexiones propios |
| Estado | Zustand |
| Animación | Motion |
| Estilos | Tailwind CSS 4 + variables CSS por tema |
| Datos | Drizzle ORM + libSQL (SQLite local, [Turso](https://turso.tech) en producción) |
| Validación | Zod, el mismo esquema en cliente y servidor |
| Hosting | Vercel |

## Correrlo en tu computadora

```bash
npm install
npm run dev        # http://localhost:3000
```

Sin configuración, los mapas se guardan en `./data/mindmaps.db`. La tabla se crea sola.

## Deploy en Vercel

Vercel no guarda archivos entre despliegues, así que en producción la base va en Turso. Usa el mismo motor que el SQLite local, así que el código no cambia.

1. En Turso: crear una base y copiar su **URL** (`libsql://…`) y un **token**.
2. En Vercel: importar este repo y cargar las variables de entorno:
   - `DATABASE_URL` = `libsql://<tu-base>.turso.io`
   - `DATABASE_AUTH_TOKEN` = `<token>`
3. Desplegar. Cada `git push` a `main` vuelve a publicar.

Si falta la base, la app muestra un error que dice qué variable configurar.

## Atajos

| Tecla | Acción |
|---|---|
| `Tab` | Idea hija |
| `Enter` / `Shift+Enter` | Idea hermana después / antes |
| `Supr` | Borrar la idea y su rama |
| `F2` o doble clic | Renombrar |
| `/` | Plegar o desplegar la rama |
| `-` / `+` | Plegar todo / desplegar un nivel |
| Flechas | Moverse entre ideas |
| `Esc` | Soltar la selección |
| `Ctrl F` | Buscar en el mapa |
| `Ctrl C` | Copiar la rama como lista |
| `Ctrl Z` / `Ctrl Shift Z` | Deshacer / rehacer |
| `Ctrl S` | Guardar ahora |
| `Espacio` + arrastrar | Mover el lienzo |

## Estructura

```
src/
├─ app/                      páginas y API (/api/maps)
├─ features/
│  ├─ mindmap/
│  │  ├─ model/              dominio puro: árbol, layouts, medición, esquema Zod
│  │  ├─ store/              estado y acciones (Zustand), historial
│  │  ├─ hooks/              atajos, autoguardado, animación de posiciones
│  │  └─ components/         lienzo, nodo, conexión, barra de herramientas
│  └─ theme/                 temas y selector
└─ server/                   base de datos (Drizzle) y repositorio
```

## API

| Método | Ruta | Uso |
|---|---|---|
| GET | `/api/maps` | Lista de mapas |
| POST | `/api/maps` | Crear o importar un mapa |
| GET | `/api/maps/:id` | Leer un mapa |
| PUT | `/api/maps/:id` | Guardar (con control de versión: `409` si otra pestaña guardó antes) |
| DELETE | `/api/maps/:id` | Borrar |
| GET | `/api/maps/:id/export` | Descargar el `.mindmap.json` |

## Diseño

`PRODUCT.md` describe para quién es la app y qué tiene que resolver. Las mejoras de usabilidad se hicieron con [Impeccable](https://github.com/pbakaus/impeccable), siguiendo sus pasos de crítica y arreglos: el puntaje subió de 28 a 34 sobre 40.
