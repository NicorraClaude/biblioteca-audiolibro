# Proyecto: La biblioteca de audiolibros más grande (legal) — spec v3

> Pegá este archivo en Claude Code como spec. Reemplaza versiones anteriores. Guardalo como `PROJECT_SPEC.md`.

---

## Rol
Ingeniero full-stack senior. Construí, de forma incremental y guiándome paso a paso, una plataforma web bilingüe (es/en) de audiolibros + e-books con un canal de YouTube asociado, **diseñada para escalar a decenas de miles de títulos**. El usuario NO es programador: dame siempre indicaciones precisas, comandos listos para pegar y links completos cuando necesites algo de mí. Pará al final de cada fase, mostrame cómo probarla, y esperá mi OK.

## Modelo legal de TRES capas — INNEGOCIABLE
El sistema clasifica TODO contenido en una de tres capas y nunca las mezcla:

### Capa 1 — Dominio público / CC (motor de crecimiento, ilimitado)
- Audiolibro completo + descarga, narrado o importado de LibriVox.
- **Se ingiere SOLO si la fuente confirma dominio público o CC comercial.**

### Capa 2 — Copyright vigente, SIN licencia → solo reseña original + afiliados
- PROHIBIDO descargar, almacenar, narrar o reproducir el texto.
- Solo contenido original transformador (lecciones, análisis, opinión) + `affiliateLinks`.

### Capa 3 — Copyright CON licencia (para acuerdos futuros con editoriales)
- Un título de esta capa NO se publica salvo que exista un `licenseRecord` válido (acuerdo, territorio, vigencia, condiciones de copias).
- El sistema BLOQUEA publicar cualquier audiolibro de copyright sin ese registro. Esta es la puerta para los acuerdos: se construye ahora, se activan títulos uno a uno al firmar.

## Motor de ingesta masiva (el corazón del crecimiento)
- `scripts/ingest-gutendex.ts`: consume **https://gutendex.com/books** (JSON, sin API key).
  - Query base: `?languages=en,es&copyright=false&sort=popular` y paginar con el campo `next`.
  - **REGLA DURA: si `copyright` de un libro NO es `false`, se descarta. Nunca se ingiere texto con copyright.**
  - Por cada libro: guardar metadatos, bajar el texto plano (`pg{id}.txt`), y encolar para TTS o matchear audio existente.
  - Idempotente. Pensado para correr en cron continuo → la base crece sola, minuto a minuto.
- `scripts/match-librivox.ts`: contra el catálogo de LibriVox (https://librivox.org/api/info), marca qué títulos ya tienen audio grabado (costo $0) en vez de generarlos.
- Objetivo de escala: arrancar con los **100 más populares en dominio público (en+es)**, y dejar el cron andando para llegar a miles.

## Stack
Next.js (App Router) + TypeScript + Tailwind · SQLite + Prisma (migrable a Postgres) · Deploy en Vercel. Capa de voz como adaptador `TTSProvider` con prioridad: LibriVox import → **OpenAI TTS (`gpt-4o-mini-tts`, por defecto)** → TTS local (Kokoro/Piper) → ElevenLabs (premium, off por defecto). YouTube Data API v3 para subir y capturar `videoId`.

### Voces (inicial)
2 voces multilingües: masculina `onyx`, femenina `nova`. Config lista para escalar a 4 (una M y una F dedicada por idioma).

## Modelo de datos (`Book`)
```
id, slug, title, author, language ("es"|"en"),
contentLayer (1 | 2 | 3),
contentType ("full_audiobook" | "summary" | "licensed_audiobook"),
categories[], description, coverImageUrl,
sourceName, sourceUrl, gutenbergId, copyright (bool),
licenseStatus ("public_domain" | "cc" | "copyrighted_summary_only" | "licensed"),
licenseRecord { agreementRef, territory, expiresAt, copyTerms } | null,   // Capa 3
ebookPdfUrl, ebookEpubUrl,        // Capa 1
affiliateLinks[],                 // Capa 2
audioVersions[ { voiceId, voiceName, youtubeVideoId, durationSeconds, status } ],
publishedAt, viewsCached, downloadCount
```
Regla de integridad: si `contentLayer == 3` y `licenseRecord` es null o vencido → estado `blocked`, no se publica.

## Web
Catálogo en grilla con badge de capa; filtros por categoría, idioma y orden alfabético; buscador por título/autor (parcial, sin acentos); ficha con embed de YouTube, selector de voz, y según capa: descarga (1), afiliados (2), o reproducción licenciada (3). SEO completo. Ganchos de monetización: afiliados, membresía/Patreon, sponsors.

## Fases
1. **MVP web** con 10 libros a mano + filtros + buscador + ficha. Deploy en Vercel.
2. **Motor Gutendex**: ingesta de los 100 PD más populares (en+es), con la regla dura de `copyright=false`. Match con LibriVox.
3. **Pipeline TTS OpenAI**: generar 1 audiolibro de prueba (`onyx`/`nova`), con control de costo.
4. **YouTube**: subida automática + captura de `videoId`.
5. **Escala + cron**: dejar el ingester corriendo en loop; sumar Capa 2 (reseñas+afiliados) y la estructura de Capa 3 (licenseRecord) lista para acuerdos.

## Reglas de trabajo
Arrancá por Fase 1. Comandos exactos para instalar/correr/deployar. Código comentado simple. Antes de cualquier API (OpenAI, YouTube) explicame qué credencial necesito y el link para conseguirla. El ingester nunca toca contenido con copyright.
