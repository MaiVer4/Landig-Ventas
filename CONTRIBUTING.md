# Contribuir a NovaMarket

¡Gracias por tu interés en contribuir! 🎉

## 🐛 Reportar Bugs

Antes de reportar un bug, verifica que:
- No haya sido reportado anteriormente en [Issues](https://github.com/MaiVer4/Landig-Ventas/issues)
- Puedas reproducir el error consistentemente

### Cómo reportar

1. Ve a [Issues](https://github.com/MaiVer4/Landig-Ventas/issues/new)
2. Usa el formato:

```markdown
## Descripción del Bug
[Descripción clara y concisa]

## Pasos para Reproducir
1. Ve a '...'
2. Haz clic en '...'
3. Observa el error

## Comportamiento Esperado
[Qué debería pasar]

## Comportamiento Actual
[Qué está pasando]

## Screenshots
[Si aplica]

## Entorno
- OS: [ej. Windows 10]
- Navegador: [ej. Chrome 120]
- Versión del proyecto: [ej. commit hash]
```

## 💡 Sugerir Features

1. Abre un [Issue](https://github.com/MaiVer4/Landig-Ventas/issues/new)
2. Usa el prefijo `[FEATURE]` en el título
3. Describe:
   - Qué problema resuelve
   - Cómo lo imaginas funcionando
   - Por qué sería útil

## 🔀 Pull Requests

### Proceso

1. **Fork el repositorio**
   ```bash
   # Haz click en Fork en GitHub
   ```

2. **Clona tu fork**
   ```bash
   git clone https://github.com/TU-USUARIO/Landig-Ventas.git
   cd Landig-Ventas
   ```

3. **Crea una rama**
   ```bash
   git checkout -b feature/nueva-funcionalidad
   # o
   git checkout -b fix/correccion-bug
   ```

4. **Haz tus cambios**
   - Escribe código limpio y comentado
   - Sigue las convenciones del proyecto
   - Testea tus cambios

5. **Commit**
   ```bash
   git add .
   git commit -m "Add: descripción concisa del cambio"
   ```

   Prefijos de commit:
   - `Add:` - Nueva funcionalidad
   - `Fix:` - Corrección de bug
   - `Update:` - Actualización de funcionalidad existente
   - `Remove:` - Eliminación de código
   - `Refactor:` - Refactorización sin cambiar funcionalidad
   - `Docs:` - Cambios en documentación
   - `Style:` - Cambios de formato/estilo

6. **Push**
   ```bash
   git push origin feature/nueva-funcionalidad
   ```

7. **Abre un Pull Request**
   - Ve a tu fork en GitHub
   - Click en "Pull Request"
   - Describe tus cambios detalladamente

### Checklist del PR

- [ ] El código funciona correctamente
- [ ] He probado en Chrome, Firefox y Safari
- [ ] He probado en mobile y desktop
- [ ] El código está comentado cuando es necesario
- [ ] He actualizado la documentación si aplica
- [ ] No hay warnings en la consola
- [ ] Los commits tienen mensajes descriptivos

## 📝 Guía de Estilo

### JavaScript

```javascript
// ✅ Bueno
const Cart = {
    items: [],
    
    add(product) {
        // Comentario claro explicando lógica compleja
        this.items.push(product);
        this.save();
    }
};

// ❌ Malo
const cart={items:[],add:function(p){this.items.push(p);this.save()}};
```

### CSS

```css
/* ✅ Bueno: Clases descriptivas, comentarios útiles */
.product-card {
    display: flex;
    flex-direction: column;
    /* Mejora la accesibilidad del foco */
    outline: 2px solid transparent;
}

/* ❌ Malo: Sin comentarios, nombres genéricos */
.pc{display:flex;flex-direction:column;}
```

### HTML

```html
<!-- ✅ Bueno: Semántico, accesible -->
<button class="btn-add" onclick="addToCart(1)" aria-label="Añadir al carrito">
    <i class="fas fa-plus" aria-hidden="true"></i>
</button>

<!-- ❌ Malo: Div genérico, sin accesibilidad -->
<div onclick="addToCart(1)">+</div>
```

## 🎯 Áreas para Contribuir

### 🟢 Fácil (Good First Issues)
- Corrección de typos en documentación
- Mejora de mensajes de error
- Añadir validaciones de formulario
- Mejorar estilos responsive

### 🟡 Medio
- Añadir animaciones CSS
- Implementar filtros de búsqueda
- Crear sistema de notificaciones
- Optimizar rendimiento

### 🔴 Avanzado
- Implementar backend con Node.js
- Añadir tests unitarios
- Crear PWA con service workers
- Integración con pasarelas de pago

## 🔍 Testing Local

```bash
# Iniciar servidor local
python -m http.server 8000

# O con Node.js
npx serve

# Abrir en navegador
# http://localhost:8000
```

### Checklist de Testing

- [ ] Añadir productos al carrito
- [ ] Modificar cantidades
- [ ] Checkout por WhatsApp
- [ ] Login en admin (admin/admin123)
- [ ] Crear/editar/eliminar productos
- [ ] Marcar pedidos como pagado/cancelado
- [ ] Verificar que el stock se descuenta
- [ ] Probar en mobile
- [ ] Verificar que persiste en localStorage

## 📞 Comunicación

- **Issues**: Para bugs y features
- **Pull Requests**: Para contribuciones de código
- **Discussions**: Para preguntas generales (si está activado)

## ⚖️ Licencia

Al contribuir, aceptas que tus contribuciones se licencien bajo la [Licencia MIT](LICENSE).

---

¡Gracias por hacer NovaMarket mejor! 🚀
