# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Personas que usan la app de forma personal, sin un rol profesional particular. El caso que más importa: alguien que pasa un tema de estudio a un mapa mental y vuelve a él para repasar antes de una evaluación.

## Product Purpose

Mindmap Studio sirve para convertir un tema en un mapa de ideas jerárquico y releerlo después. Tiene éxito cuando armar el mapa se siente tan rápido como escribir una lista, y cuando al volver días después la estructura se entiende de un vistazo.

## Positioning

Edición con el teclado primero (Tab, Enter, tipear para reemplazar) sobre un lienzo infinito, con tres distribuciones automáticas (mapa bilateral, árbol, radial) y guardado automático. No necesita cuenta ni configuración: se abre y se escribe.

## Operating Context

- Sesiones de dos tipos: armado (volcar un tema rápido, mayormente con teclado) y repaso (recorrer, plegar y desplegar ramas para autoevaluarse).
- Uso principal en computadora; el celular sirve para mirar o repasar, no para armar mapas largos.
- Los mapas se exportan e importan como JSON.

## Capabilities and Constraints

- Ideas con texto (hasta 2000 caracteres), plegado de ramas, deshacer/rehacer, arrastre libre, export/import JSON.
- Persistencia en SQLite vía API propia (`/api/maps`), con control de versión para no pisar cambios entre pestañas.
- Sin usuarios ni autenticación: todos los mapas son de quien usa la instancia.
- Interfaz en español rioplatense (vos).
- Indeciso: si habrá modo de repaso dedicado (por ejemplo, ocultar hijos y revelarlos de a uno).

## Evidence on Hand

No hay testimonios, métricas de uso, clientes ni capturas de terceros. No inventar ninguno. El mapa de ejemplo de la app ("Lanzar Mindmap Studio") es contenido de demostración, no evidencia.

## Product Principles

1. La velocidad de escritura manda: ninguna mejora puede agregar pasos entre pensar una idea y verla en el mapa.
2. El mapa se tiene que poder releer en frío: jerarquía, color de rama y plegado existen para el repaso, no como adorno.
3. Nada se pierde: guardado automático, deshacer y estados de error claros.
4. Lo avanzado se descubre, no se impone: los atajos aceleran, pero todo se puede hacer también con el mouse.
