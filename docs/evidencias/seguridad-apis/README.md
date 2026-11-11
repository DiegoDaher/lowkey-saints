# Evidencias de seguridad de APIs y despliegue

Verificación del 11 de noviembre de 2026, zona America/Mexico_City. Los JSON registran fechas UTC. Commit de la mejora: `1f8d45092ecf9c501aa50a615cdece19c1d0cbec`. El despliegue utilizó el árbol de trabajo con los cambios previos de pedidos conservados; el commit no incluye esos cambios ajenos a la práctica.

| Archivo                            | Evidencia y alcance                                                                                      |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------- |
| unit.json                          | 30 pruebas aprobadas de dominio y lector de cuerpos                                                      |
| before-after.json                  | Lector del commit base frente al nuevo: JSON multibyte antes admitido y ahora 413; cancelación del flujo |
| edge.json                          | Comprobación de tipos Deno de api y jobs                                                                 |
| types.json, lint.json, build.json  | Comprobaciones locales aprobadas; build con acceso de red para fuentes                                   |
| browser.json                       | Tres pruebas Playwright aprobadas; catálogo y pedidos usan respuestas controladas                        |
| integration.json                   | Prueba bloqueada: PostgreSQL local no disponible en 127.0.0.1:55439                                      |
| cloud.json                         | API real, Auth, ADMIN 200, STAFF 403, anónimo 401; imágenes 400 y 201 con limpieza; migraciones y TLS    |
| tls-probe.json                     | Validación PostgreSQL verify-full bloqueada por SELF_SIGNED_CERT_IN_CHAIN                                |
| vercel-deploy.json                 | Publicación limpia READY, sin .env, asignada a lowkey-saints.vercel.app                                  |
| vercel-env.json                    | Nombres de las dos variables públicas persistidas en Production, sin valores                             |
| backend-backup.json                | Descarga de copia previa; archivos en out/practice-backend-before, fuera de Git                          |
| backend-cors.json                  | Origen Vercel agregado a ALLOWED_ORIGINS                                                                 |
| backend-deploy.json                | Publicación exitosa de api; no se desplegó jobs ni se ejecutaron migraciones                             |
| publication.json                   | Sitio 200, /admin 307 al login, catálogo 200 con origen Vercel permitido; TLS 1.3 validado               |
| sistema-local.png, login-local.png | Capturas del frontend local sin datos personales                                                         |
| sistema-vercel.png                 | Captura de la interfaz publicada                                                                         |
| arquitectura.png                   | Diagrama explicativo, no captura ni evidencia de ejecución                                               |
| document-qa.json                   | Renderizado y revisión del documento Word                                                                |
| manifest.json                      | SHA-256 de evidencias y archivos fuente relevantes                                                       |

## Resultados y límites

El catálogo remoto estaba vacío. Los datos de Auth, tokens y finanzas se omitieron de las respuestas guardadas. Las cuentas y la PNG temporales de las pruebas se eliminaron al terminar. Las pruebas de exceso de tamaño fueron locales; no se realizaron pruebas de carga en nube ni envíos de correo.

La conexión con APP_DATABASE_URL se probó desde este equipo: no tenía cifrado. El intento de verificación estricta no pudo confiar en la cadena. Esto no mide por sí solo la conexión desde Edge Functions. Obtener la CA oficial del proyecto y verificar los tramos cliente–pooler y pooler–PostgreSQL antes de declarar este control completo.

La primera publicación de esta sesión incluyó .env en el paquete de build. Se agregó .vercelignore, se publicó una versión limpia y se eliminó exclusivamente esa primera publicación. No se observaron valores de secretos en las respuestas públicas; los registros conservados no contienen valores privados.

## Reproducir

`node scripts/practice-checks.mjs unit edge types lint build integration` guarda resultados locales. Para navegador, iniciar primero `npm run dev` y ejecutar `node scripts/practice-checks.mjs browser`.

`node node_modules/tsx/dist/cli.mjs scripts/practice-before-after.ts` reproduce la comparación de lectores sin contactar servicios externos.

`node scripts/practice-cloud-evidence.mjs` crea cuentas y una imagen temporales en el Supabase configurado, comprueba permisos y los elimina; necesita credenciales administrativas y no envía invitaciones. Ejecutar únicamente contra el proyecto autorizado y revisar sus resultados, incluyendo limpieza.

El documento se genera con `scripts/build-practice-document.py` usando el Python administrado de Codex y se renderiza con `scripts/render-practice-word.ps1`. La alternativa Word se usó porque el runtime Windows no incluye LibreOffice. Las imágenes de revisión y el PDF intermedio permanecen en `out/practice-docx-qa`, fuera de los entregables.

La copia de reversión de API debe conservarse hasta cerrar la práctica. Para una reversión, usar la función de esa copia con el destino Supabase verificado; no ejecutar el script general que activa Cron. En Vercel, conservar .vercelignore y elegir solo una publicación limpia.
