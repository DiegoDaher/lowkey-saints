# 5. Control de versiones del proyecto

## Introducción

El control de versiones constituye un mecanismo fundamental para preservar la
trazabilidad, coordinar el trabajo colaborativo y reducir el riesgo de pérdida
o sobrescritura de cambios. El análisis del árbol Git del proyecto **Lowkey
Saints**, realizado el 7 de octubre de 2026, permite identificar una
organización basada en una rama principal, ramas de trabajo y contribuciones
integradas mediante Pull Requests. A partir de dichas evidencias se establece
la siguiente política para la práctica integradora de Desarrollo Web Integral.

## 5.1 Sistema de control de versiones

El proyecto utiliza **Git** como sistema distribuido de control de versiones.
Esta conclusión se fundamenta en la existencia del directorio `.git`, el
historial de commits, las ramas locales y remotas, y los registros de merge
observados en el repositorio.

Git permite que cada integrante conserve una copia local del historial y
trabaje en una rama independiente antes de integrar sus modificaciones. En
consecuencia, cada cambio puede asociarse con un autor, una fecha, una
descripción y una referencia concreta, lo cual favorece la auditoría técnica
del desarrollo.

Además, el proyecto cuenta con controles automatizados asociados a Git. El
hook `pre-commit` de Husky ejecuta las pruebas configuradas y `lint-staged`;
este último aplica ESLint y Prettier a los archivos incluidos en el commit.
Por tanto, el control de versiones no se limita al almacenamiento del código,
sino que incorpora verificaciones de calidad antes de registrar cambios.

## 5.2 Plataforma

La plataforma utilizada es **GitHub**, específicamente el repositorio
`DiegoDaher/lowkey-saints`. El archivo de configuración remota de Git apunta a:

```text
https://github.com/DiegoDaher/lowkey-saints.git
```

GitHub funciona como repositorio remoto y como espacio de colaboración. En el
historial se identifican integraciones con mensajes como `Merge pull request
#1` a `Merge pull request #5`, lo que evidencia que la plataforma se utiliza
para revisar e incorporar cambios, no únicamente para publicar una copia del
proyecto.

## 5.3 Flujo de trabajo

El flujo adoptado es una **estrategia basada en GitHub Flow**, adaptada a las
necesidades académicas del equipo. No se observa un esquema Git Flow completo,
porque el repositorio no mantiene ramas permanentes `develop`, `release` o
`hotfix`. La rama `main` representa la línea principal y las funcionalidades
se desarrollan en ramas de corta duración que posteriormente se integran
mediante Pull Requests.

El procedimiento establecido es el siguiente:

1. La persona responsable actualiza su copia local a partir de `main`.
2. Se crea una rama de trabajo específica para una funcionalidad,
   corrección o tarea documental.
3. Se realizan commits pequeños y descriptivos, relacionados con una tarea
   concreta.
4. Antes de solicitar la integración se ejecutan, como mínimo, las
   comprobaciones de tipos, lint y compilación indicadas por la documentación
   del proyecto.
5. Se abre un Pull Request hacia `main`, se describe el alcance del cambio y
   se solicitan revisiones.
6. Después de atender observaciones y confirmar que las comprobaciones son
   satisfactorias, una persona autorizada integra la rama.
7. La rama de trabajo se elimina cuando ya no es necesaria.

Este flujo coincide con la práctica observable: el árbol contiene `main` y
ramas de funcionalidad, mientras que el historial registra merges de Pull
Requests. También existe un antecedente de integración directa de una rama
(`Merge branch 'feat/catalog-landing'`); por ello, la política actual
establece que las integraciones futuras deben realizarse preferentemente
mediante Pull Request, evitando que una excepción histórica se convierta en
la regla general.

## 5.4 Nomenclatura de ramas

Para eliminar la coexistencia observada entre `feat/` y `feature/`, se adopta
la siguiente nomenclatura:

| Prefijo     | Uso                                               | Ejemplo                     |
| ----------- | ------------------------------------------------- | --------------------------- |
| `feature/`  | Nueva funcionalidad o módulo                      | `feature/catalog-landing`   |
| `fix/`      | Corrección de un defecto no crítico               | `fix/cart-total`            |
| `hotfix/`   | Corrección urgente sobre la versión principal     | `hotfix/checkout-error`     |
| `docs/`     | Documentación técnica o académica                 | `docs/control-versiones`    |
| `refactor/` | Reestructuración sin cambio funcional intencional | `refactor/product-services` |
| `chore/`    | Mantenimiento, configuración o dependencias       | `chore/update-eslint`       |

Después del prefijo se utilizará una descripción breve, en minúsculas,
separada por guiones y sin espacios ni caracteres especiales. La rama
`main` se reservará para el código integrado y potencialmente entregable.
Las ramas existentes `feat/admin-inventory-finance`, `feat/orders-wh`,
`feat/pdp-sidecart` y `feat/catalog-landing` se consideran nombres heredados
válidos para preservar la trazabilidad; las ramas nuevas deberán emplear
`feature/` para mantener una convención única.

## 5.5 Política de integración

La integración se realizará desde una rama de trabajo hacia `main` mediante
Pull Request. No se deberán efectuar commits directos en `main`, excepto en
casos administrativos previamente acordados por el equipo. Antes de aceptar
un cambio, se comprobará lo siguiente:

- que el cambio corresponde al objetivo descrito en el Pull Request;
- que no introduce conflictos con el estado actual de `main`;
- que el hook `pre-commit` y las comprobaciones de ESLint y Prettier se
  encuentran satisfechos;
- que `npm run check-types` y `npm run build` terminan correctamente cuando
  el cambio afecta código o configuración ejecutable;
- que la documentación relacionada se actualiza cuando cambia el
  comportamiento o la estructura del proyecto.

La autorización corresponde a una persona distinta de quien implementó el
cambio, siempre que la disponibilidad del equipo lo permita. En un equipo
pequeño, la responsabilidad mínima será que exista una revisión explícita y
que quien mantenga la rama principal confirme la integración. Esta separación
introduce una verificación por pares y evita que la incorporación dependa
únicamente de la persona autora.

## 5.6 Pull Requests / Merge Requests

En GitHub se utilizarán **Pull Requests**. Se abrirá uno cuando una rama de
trabajo alcance un estado revisable y se pretenda integrarla en `main`.
El Pull Request deberá incluir una descripción del problema o requisito
atendido, un resumen de la solución, los archivos o módulos involucrados,
las comprobaciones ejecutadas y, cuando corresponda, capturas o instrucciones
para validar el resultado visual.

La revisión deberá verificar:

1. correspondencia con el alcance solicitado;
2. claridad, mantenibilidad y coherencia con la arquitectura existente;
3. ausencia de secretos, credenciales o archivos generados;
4. compatibilidad con TypeScript, Next.js y las convenciones de formato;
5. comportamiento esperado y posibles efectos secundarios;
6. resultado de las comprobaciones automáticas y de la revisión manual.

Los comentarios de revisión deberán resolverse o contestarse antes de la
aceptación. Una vez aprobado el Pull Request y satisfechas las comprobaciones,
la persona mantenedora de `main` realizará el merge. La plataforma registra
la relación entre la rama, la revisión y el commit resultante, conservando la
trazabilidad de la integración.

## 5.7 Acceso de usuarios

El historial de commits permite identificar al menos a dos participantes:

| Participante identificable                | Responsabilidad propuesta                                                                                                                       |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Diego Daher Díaz Contreras (`DiegoDaher`) | Propietario o mantenedor del repositorio; administra `main`, configura las reglas de integración, revisa Pull Requests y coordina las entregas. |
| Manuel Hernández Rubio (`matt2130`)       | Colaborador de desarrollo; implementa funcionalidades en ramas de trabajo, documenta sus cambios y solicita revisión antes de integrar.         |

La autoría del historial no constituye, por sí sola, una prueba completa de
los permisos vigentes en GitHub. Por ello, los permisos efectivos deberán
confirmarse en la configuración de **Settings > Collaborators** del
repositorio. Como política de mínimo privilegio, el propietario o mantenedor
conservará permisos administrativos y los demás integrantes trabajarán con
permisos de escritura únicamente cuando los necesiten para crear ramas y
Pull Requests. Las reglas de protección de `main`, si se habilitan, deberán
requerir revisión y comprobaciones antes del merge.

Todo integrante con acceso debe proteger las credenciales, no compartir
tokens y no incorporar variables de entorno ni secretos al repositorio. Cada
persona será responsable de sus commits, de atender los comentarios de
revisión y de mantener sincronizada su rama antes de solicitar la integración.
Cuando se incorporen nuevos integrantes, el mantenedor documentará su rol,
verificará que el nivel de acceso sea adecuado y les comunicará esta política.

## Conclusión

El proyecto presenta una base funcional de colaboración con Git y GitHub:
dispone de una rama principal, ramas de trabajo, historial de autores y
evidencia de Pull Requests integrados. La formalización propuesta conserva
esas prácticas y corrige su principal área de mejora: unificar la nomenclatura
de ramas y establecer que toda integración ordinaria pase por revisión,
comprobaciones automáticas y autorización explícita.
