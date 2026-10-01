# 🛍️ E-Commerce Landing Page & WhatsApp Order Management System

Solución integral de comercio electrónico diseñada para tiendas de ropa que operan a través de redes sociales (Instagram). Combina una landing page de alta conversión para clientes con un backoffice de control de stock, gestión de variantes y flujo de checkout asistido vía WhatsApp.

---

## 🚀 Características Principales

### Experiencia de Compra (Landing Page)

- **Hero & Catálogo Dinámico:** Presentación de colecciones con filtrado por categorías, tallas y ordenamiento.
- **Ficha de Producto Avanzada:**
  - Carrusel de fotos de alta resolución.
  - Guía de tallas interactiva con medidas en centímetros y referencia del modelo.
  - Selector dinámico de variantes (Talla / Color) con indicador de stock en tiempo real.
  - Sistema de lista de deseos (**Wishlist**) con incio de Sesión del usuario.
  - Módulo dinámico _"Completa el look"_ con sugrencias de productos.
  - Alerta _"Avisarme cuando haya stock"_ para capturar correos cuando una talla está agotada.
- **Checkout Asistido vía WhatsApp:**
  - Resumen de pedido con ID único (`#PED-XXXX`).
  - Reserva de stock temporal configurable (ej. 3 a 6 horas).
  - Redirección automática a WhatsApp con mensaje preformateado que incluye desglose de prendas, datos de envío.

### Panel de Administración (Backoffice)

- **Gestión de Catálogo:** Alta y edición de productos, galería de fotos múltiple y control de costos internos vs. precio venta.
- **Control de Inventario y Variantes:** Matriz por prenda para tallas y colores, con actualización manual o automática por venta concretada.
- **Gestión de Pedidos:** Tabla Kanban/Listado para cambiar estados (_Pendiente de pago_, _Pagado/Confirmado_, _Cancelado_, _Enviado_). La cancelación libera el stock reservado al catálogo.
- **Sistema de Reposición Automatizado:** Alerta masiva por correo a clientes suscritos tan pronto como una variante recibe nuevo stock.

---

## 🛠️ Stack Tecnológico

| Capa                      | Tecnología                         | Justificación                                                                                                        |
| :------------------------ | :--------------------------------- | :------------------------------------------------------------------------------------------------------------------- |
| **Framework Full-Stack**  | Next.js (React + App Router)       | Renderizado SSR/ISR para SEO y velocidad en Instagram, API Routes integradas y un solo lenguaje en todo el proyecto. |
| **Lenguaje**              | TypeScript                         | Tipado estricto extremo a extremo entre base de datos, APIs y componentes de UI.                                     |
| **Estilos & UI**          | Tailwind CSS + shadcn/ui           | Desarrollo acelerado de componentes accesibles (modales, drawres, tablas y selectores).                              |
| **Base de Datos & ORM**   | Supabase - PostgreSQL + Prisma ORM | Modelado relacional robusto con transacciones seguras para manejo de inventario.                                     |
| **Gestor de Medios**      | Cloudinary / Uploadthing           | CDN para carga y distribución rápida de imágenes de ropa optimizadas.                                                |
| **Mailing Transaccional** | Resend + React Email /supabase     | Entrega de correos de notificación de reposición con plantillas HTML limpias.                                        |
| **Gestor de Paquetes**    | pnpm                               | Instalación rápida y eficiente de dependencias compartidas.                                                          |

---

## 🏛️ Arquitectura y Patrones de Diseño

El sistema sigue una **Arquitectura Cliente-Servidor en Capas** aprovechando Next.js:

1. **Capa de Presentación:** Componentes visuales (Server Components y Client Components) optimizados para móviles y desktop.
2. **Capa de Lógica de Negocio (Server Actions / Services):** Control de reservas temporales, cálculo de promociones y reglas de inventario.
3. **Capa de Acceso a Datos (Repository Pattern):** Consultas desacopladas a través de Prisma Client hacia la base de datos PostgreSQL.

### Patrones de Software Implementados

- **Repository Pattern:** Desacopla la lógica de base de datos de las rutas/acciones (`ProductRepository`, `OrderRepository`).
- **Observer Pattern:** Notificación asíncrona de eventos (ej. cuando `Variant.stock` pasa de 0 a > 0, se dispara el servicio de correos a la lista de espera).
- **Strategy Pattern:** Cálculo de envíos y descuentos de referidos según reglas dinámicas.

---

## 👥 Organización del Equipo (4 Desarrolladores)

- **Dev 1 (Frontend Catálogo & UX):** Hero, catálogo, carruseles, guía de tallas y módulo cross-selling.
- **Dev 2 (Carrito, WhatsApp & Referidos):** Wishlist, drawer de compra, generador de enlace a WhatsApp y validación de cupones.
- **Dev 3 (Backoffice & Admin UI):** Tableros de administración, carga multimedia, formularios de producto y seguimiento de costos.
- **Dev 4 (Backend, Datos & Integraciones):** Modelado en Prisma, mutaciones transaccionales de stock, endpoints REST/Actions y worker de mailing con Resend.

---

## ⚙️ Instalación y Configuración Local

### 1. Prerrequisitos

- Node.js (v18.x o superior)
- pnpm instalado globalmente (`npm i -g pnpm`)
- Instancia de PostgreSQL en ejecución (local o en la nube)

### 2. Clonar el repositorio

```bash
git clone [https://github.com/tu-organizacion/tienda-ropa.git](https://github.com/tu-organizacion/tienda-ropa.git)
cd tienda-ropa
```

### 3. Instalar dependencias

```bash
pnpm install
```

### 4. Variables de Entorno

Copia el archivo de ejemplo y completa los valores requeridos:

```bash
cp .env.example .env
```

Parámetros en `.env`:

```env
DATABASE_URL="postgresql://usuario:password@localhost:5432/tienda_ropa?schema=public"
NEXT_PUBLIC_WHATSAPP_NUMBER="521XXXXXXXXXX"
CLOUDINARY_CLOUD_NAME=""
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""
RESEND_API_KEY="re_xxxxxxxxxxxx"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 5. Migraciones y Base de Datos

```bash
pnpm prisma migrate dev --name init
pnpm prisma db seed
```

### 6. Ejecutar en Entorno de Desarrollo

```bash
pnpm dev
```

La aplicación estará disponible en `http://localhost:3000`.
