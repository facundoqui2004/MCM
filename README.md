# Mindmap Studio

Editor de mapas mentales con el teclado como protagonista, lienzo infinito y estética "Dark Studio".
Next.js 15 (App Router) · TypeScript · Tailwind v4 · React Flow v12 · Zustand · Motion · Drizzle + SQLite (libSQL).

## Arranque

```bash
npm install
cp .env.example .env.local   # opcional: por defecto usa ./data/mindmaps.db
npm run dev                  # http://localhost:3000
```

La tabla se crea sola en el primer request (`ensureSchema`). Para migraciones formales: `npm run db:generate && npm run db:migrate`.

## Deploy en Vercel

Vercel no guarda archivos entre despliegues, así que en producción la base va en [Turso](https://turso.tech) (libSQL, el mismo motor que el SQLite local; el código no cambia).

1. En Turso: crear una base y copiar su **URL** (`libsql://…`) y un **token**.
2. En Vercel: *Add New → Project*, importar este repo (Next.js se detecta solo).
3. En *Environment Variables*:
   - `DATABASE_URL` = `libsql://<tu-base>.turso.io`
   - `DATABASE_AUTH_TOKEN` = `<token>`
4. *Deploy*. La tabla se crea sola en el primer pedido.

Si falta la base, la app muestra un error que dice qué variable configurar.

## Atajos

| Tecla | Acción |
|---|---|
| `Tab` | Idea hija (y entra a editar) |
| `Enter` / `Shift+Enter` | Idea hermana después / antes |
| `Supr` / `Backspace` | Borrar la idea y su rama |
| `F2` o doble clic | Renombrar |
| Tipear sobre una idea | Reemplaza su texto |
| `/` | Plegar / desplegar la rama |
| `-` / `+` | Plegar todo / desplegar un nivel (para repasar) |
| `Esc` | Soltar la selección (Tab vuelve a recorrer la interfaz) |
| Flechas | Moverse entre ideas |
| `Espacio` + arrastrar | Mover el lienzo |
| Rueda / pellizco | Zoom centrado en el puntero |
| `Ctrl F` | Buscar en el mapa (despliega ramas plegadas y centra el resultado) |
| `Ctrl C` | Copiar la rama seleccionada como lista con sangría (para apuntes) |
| `Ctrl Z` / `Ctrl Shift Z` | Deshacer / rehacer (plegar y desplegar no cuentan) |
| `Ctrl S` | Guardar ahora (igual hay autoguardado) |

## Estructura

```
src/
├─ app/
│  ├─ page.tsx                     Lista de mapas (Server Component)
│  ├─ map/[id]/page.tsx            Editor (carga el mapa en el servidor)
│  └─ api/maps/
│     ├─ route.ts                  GET lista · POST crear/importar
│     └─ [id]/route.ts             GET · PUT (concurrencia optimista) · DELETE
│        └─ export/route.ts        GET descarga .mindmap.json
├─ features/mindmap/
│  ├─ model/                       Dominio puro (sin React)
│  │  ├─ types.ts                  MindNodeModel, MindMapDoc
│  │  ├─ tree.ts                   Recorridos: visibles, descendientes, hojas
│  │  ├─ measure.ts                Medición sincrónica de texto (Canvas 2D)
│  │  ├─ layout.ts                 Bilateral · árbol vertical · radial
│  │  ├─ geometry.ts               Dirección de crecimiento, bounds
│  │  ├─ schema.ts                 Zod: validación compartida cliente/servidor
│  │  ├─ palette.ts / factory.ts
│  ├─ store/mindmap-store.ts       Zustand: estado, acciones, historial
│  ├─ hooks/                       Atajos, autoguardado, posiciones animadas
│  ├─ components/                  Canvas, nodo, conexión, dock, editor
│  └─ api/client.ts                Cliente fetch tipado
└─ server/
   ├─ db/{schema,client}.ts        Drizzle + libSQL
   └─ maps/repository.ts           Acceso a datos
```

## API

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| GET | `/api/maps` | — | `MindMapSummary[]` |
| POST | `/api/maps` | `{ title?, doc? }` | `201 MindMapRecord` · `422` |
| GET | `/api/maps/:id` | — | `MindMapRecord` · `404` |
| PUT | `/api/maps/:id` | `{ title, doc, version }` | `{ version, updatedAt }` · `409 { current }` · `422` |
| DELETE | `/api/maps/:id` | — | `{ ok: true }` · `404` |
| GET | `/api/maps/:id/export` | — | archivo `.mindmap.json` |

`PUT` sólo aplica si `version` coincide con la de la base (`UPDATE … WHERE id = ? AND version = ?`). Si otra pestaña guardó antes, devuelve `409` con la versión actual.

## Pasar a PostgreSQL

Cambiar `sqliteTable` → `pgTable` en `server/db/schema.ts` (con `jsonb` para `data`) y el driver en `server/db/client.ts` a `drizzle-orm/node-postgres`. El repositorio y la API no cambian.

## Diseño con Impeccable

El proyecto incluye [Impeccable](https://github.com/pbakaus/impeccable) (Apache 2.0) en `.claude/skills/impeccable/`.

- `PRODUCT.md`: para quién es la app y qué tiene que resolver. Lo leen todos los comandos.
- `.impeccable/critique/`: historial de críticas (28 → 32 → 30 → 34 sobre 40, todas el 2026-10-30).

En Claude Code: `/impeccable critique`, `/impeccable polish`, `/impeccable audit`, etc. Sin Claude Code, se le puede pedir a Claude que siga las instrucciones de `.claude/skills/impeccable/SKILL.md`.
