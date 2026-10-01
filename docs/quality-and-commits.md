# Calidad y flujo de commits

## Qué ocurre al instalar

`package.json` define el script `prepare` como `husky`. Por eso `npm install` inicializa Husky y deja disponibles los hooks de `.husky`. Si se clona el repositorio y los hooks no funcionan, ejecuta de nuevo:

```bash
npm install
```

No se deben editar los archivos generados dentro de `node_modules`; la configuración del proyecto está en `package.json`, `.husky/pre-commit`, `eslint.config.mjs` y `.prettierrc`.

## Qué ocurre al hacer commit

El hook `.husky/pre-commit` ejecuta, en este orden:

```text
npm test
npx lint-staged
```

El commit se detiene si un comando devuelve un código distinto de cero.

### 1. Pruebas

`npm test` está definido actualmente como un placeholder que imprime `No tests specified`. El hook ya reserva el punto de entrada para pruebas reales; cuando se incorpore un runner, debe sustituirse ese script y mantenerse ejecutable en local y CI.

### 2. lint-staged

`lint-staged` solo procesa archivos incluidos en el commit, no todo el repositorio:

| Archivos staged                  | Acciones                                   |
| -------------------------------- | ------------------------------------------ |
| `*.ts`, `*.tsx`, `*.js`, `*.jsx` | `eslint --fix`, después `prettier --write` |
| `*.json`, `*.css`, `*.md`        | `prettier --write`                         |

Las acciones pueden modificar el contenido staged. Después de que termine el hook, revisa `git diff` y `git diff --cached`; si el hook deja cambios adicionales, vuelve a añadirlos antes de confirmar.

## Herramientas

### Husky

Husky conecta Git con scripts versionados en `.husky`. En este proyecto el único hook configurado es `pre-commit`, que protege cada commit antes de crearlo.

### ESLint

`npm run lint` usa ESLint 9 con las configuraciones de Next.js Core Web Vitals y TypeScript. También se ejecuta sobre los archivos JavaScript/TypeScript staged a través de lint-staged, con `--fix`.

El archivo `eslint.config.mjs` ignora `.next`, `out`, `build` y `next-env.d.ts`, además de aplicar las reglas de Next.js. Los errores que no puedan repararse automáticamente bloquean el commit.

### Prettier

`npm run format` formatea todo el repositorio. El hook solo formatea archivos staged compatibles con la configuración.

`.prettierrc` establece:

- punto y coma;
- comillas dobles;
- indentación de dos espacios;
- comas finales estilo ES5;
- orden automático de clases Tailwind mediante `prettier-plugin-tailwindcss`.

Para una modificación normal, es preferible ejecutar `npx prettier --write <archivo>` sobre el archivo concreto o dejar que lint-staged lo haga.

### TypeScript

`npm run check-types` ejecuta `tsc --noEmit` con `strict: true`. Esta comprobación no está conectada actualmente al hook `pre-commit`, por lo que debe ejecutarse manualmente antes de abrir una revisión o cuando se cambien contratos, imports o tipos.

### Next.js y build

`npm run build` valida la compilación de Next.js y detecta problemas que ESLint o TypeScript pueden no cubrir, como errores de rutas, Server Components o integración del framework. También debe ejecutarse antes de entregar cambios relevantes.

## Flujo recomendado

```bash
git status
npm run check-types
npm run lint
npm run build
git add <archivos>
git diff --cached
 git commit -m "tipo: descripción breve"
```

No es necesario ejecutar manualmente `lint-staged` para un commit normal: Husky lo ejecuta al final del hook. El espacio inicial de `git commit` en el ejemplo anterior no forma parte del comando; debe escribirse como `git commit ...`.

Si se desea revisar exactamente lo que hará el hook sin crear un commit:

```bash
npm test
npx lint-staged
```

## Cuando falla un commit

1. Lee el primer error; los errores posteriores pueden ser consecuencia del primero.
2. Corrige el archivo fuente, no el resultado generado en `.next`.
3. Ejecuta la comprobación específica (`npm run lint`, `npm run check-types` o `npm run build`).
4. Revisa los cambios que `--fix` haya realizado.
5. Vuelve a hacer `git add` y repite el commit.

Evita `git commit --no-verify`: salta precisamente las comprobaciones que mantienen consistente el repositorio. Solo debe utilizarse como excepción consciente y documentada, nunca para ocultar un fallo.

## Variables y archivos sensibles

`.gitignore` excluye `.env*`, dependencias, artefactos de Next.js, builds y archivos generados de TypeScript/Prisma. No añadas secretos, URLs completas de bases de datos, claves de Supabase ni credenciales de correo al commit. Comparte las variables mediante el mecanismo seguro del equipo y documenta únicamente sus nombres y propósito.
