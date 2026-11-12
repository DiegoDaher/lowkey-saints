# Evidencias de seguridad de APIs y despliegue

Verificación del 11 de noviembre de 2026, zona America/Mexico_City. Los JSON registran fechas UTC. Commit de la mejora: `1f8d45092ecf9c501aa50a615cdece19c1d0cbec`. El despliegue utilizó el árbol de trabajo con los cambios previos de pedidos conservados; el commit no incluye esos cambios ajenos a la práctica.

| Archivo                            | Evidencia y alcance                                                                                      |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------- |
| unit.json                          | 32 pruebas aprobadas de dominio y lector de cuerpos                                                      |
| before-after.json                  | Lector del commit base frente al nuevo: JSON multibyte antes admitido y ahora 413; cancelación del flujo |
| edge.json                          | Comprobación de tipos Deno de api y jobs                                                                 |
| types.json, lint.json, build.json  | Comprobaciones locales aprobadas; build con acceso de red para fuentes                                   |
| browser.json                       | Tres pruebas Playwright aprobadas; catálogo y pedidos usan respuestas controladas                        |
| integration.json                   | Integración aprobada en PostgreSQL 15 desechable; migraciones y pruebas de dominio                       |
| cloud.json                         | API real, Auth, ADMIN 200, STAFF 403, anónimo 401; imágenes 400 y 201 con limpieza; migraciones y TLS    |
| tls-probe.json                     | TLS validado, rechazo de CA ajena, hostname incorrecto y conexión sin TLS                                |
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

La evidencia inicial cloud.json registró una conexión sin TLS. Después de incorporar la CA proporcionada, se validaron los dos tramos: Node y Deno verifican la identidad del servidor; api y jobs reportan TLS 1.3. Supabase tiene Enforce SSL activo. tls-probe.json incluye rechazo de conexión sin TLS, CA ajena y hostname incorrecto. La CA pública no contiene una clave privada.

La primera publicación de esta sesión incluyó .env en el paquete de build. Se agregó .vercelignore, se publicó una versión limpia y se eliminó exclusivamente esa primera publicación. No se observaron valores de secretos en las respuestas públicas; los registros conservados no contienen valores privados.

## Reproducir

`node scripts/practice-checks.mjs unit edge types lint build integration` guarda resultados locales. Para navegador, iniciar primero `npm run dev` y ejecutar `node scripts/practice-checks.mjs browser`.

`node node_modules/tsx/dist/cli.mjs scripts/practice-before-after.ts` reproduce la comparación de lectores sin contactar servicios externos.

`node scripts/practice-cloud-evidence.mjs` crea cuentas y una imagen temporales en el Supabase configurado, comprueba permisos y los elimina; necesita credenciales administrativas y no envía invitaciones. Ejecutar únicamente contra el proyecto autorizado y revisar sus resultados, incluyendo limpieza.

El documento se genera con `scripts/build-practice-document.py` usando el Python administrado de Codex y se renderiza con `scripts/render-practice-word.ps1`. La alternativa Word se usó porque el runtime Windows no incluye LibreOffice. Las imágenes de revisión y el PDF intermedio permanecen en `out/practice-docx-qa`, fuera de los entregables.

Las copias previas a TLS necesitan conservar la configuración de CA antes de reutilizarlas, porque Supabase ahora rechaza conexiones sin cifrado. No ejecutar el script general que activa Cron para una reversión. En Vercel, conservar .vercelignore y elegir solo una publicación limpia.

## Evidencias adicionales de TLS

- tls-enforcement.json: configuración antes y después de exigir SSL.
- tls-deploy.json y tls-backup.json: publicación y copias previas de api y jobs.
- tls-edge-before.json y tls-edge-after.json: cambio observado desde Prisma en ambas funciones.
- tls-deno.json: validación y rechazos de certificado en el runtime Deno.

La configuración compartida está en supabase/functions/_shared/postgres-tls.mjs. El certificado debe coincidir con docs/prod-ca-2021.crt; las pruebas detectan diferencias y caducidad. Prisma CLI configura sslaccept=strict y sslcert; los clientes pg eliminan opciones SSL de la URL para evitar que sobrescriban la CA explícita.

La integración final se ejecutó en un contenedor nuevo con la imagen oficial postgres:15, publicado únicamente en 127.0.0.1:55439. El script creó y eliminó su base temporal; después se retiró el contenedor. No se conectó a las bases de otros contenedores.
