# 🛒 Luxury Destilados — E-commerce con Panel de Administración

[![Live Demo](https://img.shields.io/badge/demo-online-brightgreen.svg)](https://maiver4.github.io/Landig-Ventas/)
[![GitHub](https://img.shields.io/badge/github-MaiVer4-blue.svg)](https://github.com/MaiVer4/Landig-Ventas)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

E-commerce moderno y completamente funcional con catálogo dinámico, carrito de compras, checkout por WhatsApp y panel de administración con sincronización en tiempo real vía Supabase.

---

## ✨ Características

### �� Tienda
- Catálogo de productos con filtros por categorías dinámicas
- Modal de detalle de producto con galería de imágenes
- Productos destacados en carrusel
- Sistema de ofertas con porcentaje de descuento y badges
- Carrito persistente con ajuste de cantidades
- Checkout por WhatsApp — genera el mensaje automáticamente con el pedido completo
- Diseño totalmente responsive (mobile, tablet, desktop)
- Formato de moneda colombiana (COP)

### 👨‍💼 Panel de Administración (`/admin.html`)
- Dashboard con métricas: total productos, valor de inventario, stock bajo
- Gráfico de ventas interactivo (diario / semanal / mensual / anual) con Chart.js
- Gestión completa de productos (crear, editar, eliminar, ocultar, destacar)
- Visibilidad y destacado sincronizados entre dispositivos vía Supabase
- Gestión de pedidos (pendiente → pagado / cancelado, descuento de stock automático)
- Gestión de categorías sincronizadas con Supabase
- Exportación de inventario a CSV
- Business Intelligence: insights y recomendaciones

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | HTML5, CSS3, JavaScript Vanilla |
| Estilos Admin | Tailwind CSS (CDN) |
| Iconos | Font Awesome 6.4.0 (CDN) |
| Gráficos | Chart.js (CDN) |
| Base de datos | Supabase (PostgreSQL) |
| Hosting | GitHub Pages |

---

## 📂 Estructura del Proyecto

```
landing-ventas/
├── index.html          # Tienda pública
├── admin.html          # Panel de administración
├── css/
│   └── styles.css      # Estilos de la tienda
├── js/
│   ├── supabase.js     # Cliente Supabase (CRUD Products, Orders, Categories)
│   ├── main.js         # Lógica de la tienda (catálogo, filtros, modales)
│   ├── cart.js         # Carrito y checkout por WhatsApp
│   └── admin.js        # Lógica del panel de administración
├── robots.txt          # Directivas SEO para crawlers
├── sitemap.xml         # Mapa del sitio
└── README.md
```

---

## 🗄️ Base de Datos (Supabase)

El proyecto usa tres tablas en Supabase. Ejecuta este SQL en el **SQL Editor** de tu proyecto:

### Tabla `Products`

```sql
CREATE TABLE public."Products" (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT DEFAULT '',
  price        NUMERIC NOT NULL DEFAULT 0,
  category     TEXT DEFAULT '',
  stock        INTEGER DEFAULT 0,
  image        TEXT DEFAULT '',
  gallery      JSONB DEFAULT '[]',
  is_visible   BOOLEAN DEFAULT true,
  is_featured  BOOLEAN DEFAULT false,
  categories   JSONB DEFAULT '[]'
);

ALTER TABLE public."Products" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read"  ON public."Products" FOR SELECT USING (true);
CREATE POLICY "public write" ON public."Products" FOR ALL   USING (true);
```

### Tabla `Orders`

```sql
CREATE TABLE public."Orders" (
  id          TEXT PRIMARY KEY,
  date        TIMESTAMPTZ DEFAULT NOW(),
  status      TEXT DEFAULT 'pending_whatsapp',
  channel     TEXT DEFAULT 'whatsapp',
  total       NUMERIC DEFAULT 0,
  customer    TEXT DEFAULT '',
  phone       TEXT DEFAULT '',
  items       TEXT DEFAULT '[]',
  address     TEXT DEFAULT '{}'
);

ALTER TABLE public."Orders" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read"  ON public."Orders" FOR SELECT USING (true);
CREATE POLICY "public write" ON public."Orders" FOR ALL   USING (true);
```

### Tabla `Categories`

```sql
CREATE TABLE public."Categories" (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL,
  slug  TEXT NOT NULL UNIQUE,
  "order" INTEGER DEFAULT 0
);

ALTER TABLE public."Categories" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read"  ON public."Categories" FOR SELECT USING (true);
CREATE POLICY "public write" ON public."Categories" FOR ALL   USING (true);
```

---

## ⚙️ Configuración

### 1. Supabase — credenciales

Edita `index.html` y `admin.html`. Busca el bloque `window.supabaseConfig`:

```html
<script>
  window.supabaseConfig = {
    url:     'https://TU-PROYECTO.supabase.co',
    anonKey: 'TU_ANON_KEY'
  };
</script>
```

Encuentra tu URL y `anon key` en **Supabase → Project Settings → API**.

### 2. Número de WhatsApp

Edita `js/cart.js`:

```javascript
const phoneNumber = "573219395309"; // reemplaza con tu número (código de país sin +)
```

### 3. Credenciales del Admin

Edita `js/admin.js` y busca la función `setupAuth`:

```javascript
if (user === 'admin' && pass === 'admin123') {
  // cambia 'admin' y 'admin123' por tus credenciales
}
```

---

## 🚀 Despliegue en GitHub Pages

1. **Fork** este repositorio
2. Ve a **Settings → Pages**
3. Source: `Deploy from a branch` → rama `main` → carpeta `/root`
4. Guarda — tu tienda estará disponible en:
   ```
   https://TU-USUARIO.github.io/Landig-Ventas/
   ```

### Desarrollo local

```bash
git clone https://github.com/MaiVer4/Landig-Ventas.git
cd Landig-Ventas

# Python
python -m http.server 8000

# Node.js
npx serve
```

Abre `http://localhost:8000`.

---

## 🎯 Cómo usar

### Flujo del cliente

1. Navega el catálogo y filtra por categoría
2. Abre el modal de un producto para ver detalles y galería
3. Añade productos al carrito con `+`
4. Ajusta cantidades o elimina ítems en el carrito
5. Haz clic en **Enviar pedido por WhatsApp** → se abre WhatsApp con el resumen completo

### Flujo del administrador

1. Accede a `/admin.html` e inicia sesión
2. **Dashboard** — visualiza métricas y stock bajo
3. **Pedidos** — gestiona los pedidos entrantes:
   - **Pagado** → descuenta el stock automáticamente y sincroniza en Supabase
   - **Cancelado** → archiva el pedido
4. **Inventario** — crea y edita productos; controla visibilidad y destacado (sincronizado en todos los dispositivos vía Supabase)
5. **Categorías** — añade o edita categorías; se reflejan en los filtros de la tienda al instante

### Flujo del pedido

```
Cliente añade productos
        ↓
  Checkout WhatsApp
        ↓
  Pedido guardado en Supabase  ←→  localStorage (fallback)
        ↓
  Estado: Pendiente WhatsApp
        ↓
  Admin revisa
   ├── Pagado   → Stock descontado + Supabase actualizado
   └── Cancelado → Archivado
```

---

## 🌐 SEO

- Meta tags completos (title, description, keywords)
- Open Graph y Twitter Cards
- Structured Data (JSON-LD / Schema.org)
- `robots.txt` y `sitemap.xml` incluidos
- Semántica HTML5 y atributos ARIA

---

## 🔒 Seguridad

> ⚠️ La autenticación del admin es del lado del cliente. Para producción se recomienda implementar autenticación real (Supabase Auth, JWT, etc.) y políticas RLS más restrictivas en Supabase.

---

## 🐛 Troubleshooting

### Los pedidos no aparecen en el admin

Verifica que la tabla `Orders` exista en Supabase y que las políticas RLS permitan lectura y escritura pública (ver SQL de arriba).

### Los productos no cargan

1. Comprueba que `window.supabaseConfig` tenga la URL y anon key correctas
2. Verifica en Supabase → Table Editor que la tabla `Products` tenga filas
3. Asegúrate de que las políticas RLS estén activas

### Visibilidad/destacado no se sincroniza entre dispositivos

Confirma que las columnas `is_visible`, `is_featured` y `categories` existan en la tabla `Products`. Si no, ejecuta:

```sql
ALTER TABLE public."Products" ADD COLUMN IF NOT EXISTS is_visible  BOOLEAN DEFAULT true;
ALTER TABLE public."Products" ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;
ALTER TABLE public."Products" ADD COLUMN IF NOT EXISTS categories  JSONB   DEFAULT '[]';
```

### El gráfico no se muestra

Asegúrate de que Chart.js se cargue desde CDN antes de `admin.js`:

```html
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
```

---

## 🤝 Contribuir

1. Fork el proyecto
2. Crea tu rama: `git checkout -b feature/nueva-funcionalidad`
3. Commit: `git commit -m 'feat: descripción del cambio'`
4. Push: `git push origin feature/nueva-funcionalidad`
5. Abre un Pull Request

---

## 📝 Licencia

MIT — ver [LICENSE](LICENSE) para más detalles.

---

## 👤 Autor

**MaiVer4** · [GitHub](https://github.com/MaiVer4) · [Proyecto](https://github.com/MaiVer4/Landig-Ventas)

---

## 🙏 Créditos

- [Supabase](https://supabase.com) — Backend y base de datos
- [Chart.js](https://www.chartjs.org) — Gráficos
- [Font Awesome](https://fontawesome.com) — Iconos
- [Tailwind CSS](https://tailwindcss.com) — Estilos del admin
