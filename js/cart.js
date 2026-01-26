const Cart = {
    items: [],

    init() {
        console.log('🛒 Cart.js cargado correctamente');
        const savedCart = localStorage.getItem('cart');
        if (savedCart) {
            this.items = JSON.parse(savedCart).map(i => ({ ...i, id: String(i.id) }));
        }
        this.render();
        this.updateBadge();
    },

    add(product) {
        const existingItem = this.items.find(item => String(item.id) === String(product.id));
        if (existingItem) {
            existingItem.quantity++;
        } else {
            this.items.push({ ...product, quantity: 1 });
        }
        this.save();
        this.render();
        this.open();
        this.updateBadge();
    },

    remove(id) {
        this.items = this.items.filter(item => String(item.id) !== String(id));
        this.save();
        this.render();
        this.updateBadge();
    },

    updateQuantity(id, change) {
        const item = this.items.find(item => String(item.id) === String(id));
        if (item) {
            item.quantity += change;
            if (item.quantity <= 0) {
                this.remove(id);
            } else {
                this.save();
                this.render();
                this.updateBadge();
            }
        }
    },

    save() {
        localStorage.setItem('cart', JSON.stringify(this.items));
    },

    updateBadge() {
        const count = this.items.reduce((sum, item) => sum + item.quantity, 0);
        const badge = document.getElementById('cartCount');
        if (badge) badge.innerText = count;
    },

    render() {
        const cartItemsContainer = document.getElementById('cartItems');
        const cartTotalElement = document.getElementById('cartTotal');
        
        if (!cartItemsContainer) return; // Might be on a page without cart sidebar

        if (this.items.length === 0) {
            cartItemsContainer.innerHTML = '<div style="text-align: center; margin-top: 2rem; color: #64748b;">Tu carrito está vacío</div>';
            cartTotalElement.innerText = '$0.00';
            return;
        }

        let total = 0;
        cartItemsContainer.innerHTML = this.items.map(item => {
            const subtotal = item.price * item.quantity;
            total += subtotal;
            return `
                <div class="cart-item">
                    <img src="${item.image}" alt="${item.name}" class="cart-item-img">
                    <div class="cart-item-details">
                        <div class="cart-item-title">${item.name}</div>
                        <div class="cart-item-price">${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(item.price)} x ${item.quantity}</div>
                        <div class="cart-item-controls">
                            <button class="qty-btn" onclick="Cart.updateQuantity('${item.id}', -1)">-</button>
                            <span>${item.quantity}</span>
                            <button class="qty-btn" onclick="Cart.updateQuantity('${item.id}', 1)">+</button>
                            <button class="action-btn btn-delete" style="margin-left: auto; padding: 2px 6px;" onclick="Cart.remove('${item.id}')"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        cartTotalElement.innerText = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(total);
    },

    open() {
        document.getElementById('cartSidebar').classList.add('open');
        document.getElementById('cartOverlay').classList.add('open');
    },

    close() {
        document.getElementById('cartSidebar').classList.remove('open');
        document.getElementById('cartOverlay').classList.remove('open');
    },

    // Open confirmation modal
    openOrderModal() {
        if (this.items.length === 0) {
            alert('El carrito está vacío');
            return;
        }

        // Populate order summary
        const orderItemsList = document.getElementById('orderItemsList');
        const orderTotalAmount = document.getElementById('orderTotalAmount');
        
        let total = 0;
        orderItemsList.innerHTML = this.items.map(item => {
            const subtotal = item.price * item.quantity;
            total += subtotal;
            return `
                <div class="order-item-row">
                    <span class="order-item-name">${item.name}</span>
                    <span class="order-item-qty">x${item.quantity}</span>
                    <span class="order-item-price">${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(subtotal)}</span>
                </div>
            `;
        }).join('');

        orderTotalAmount.innerText = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(total);

        // Clear form
        document.getElementById('customerName').value = '';
        document.getElementById('customerPhone').value = '';
        document.getElementById('customerName').classList.remove('error');
        document.getElementById('customerPhone').classList.remove('error');

        // Close cart and open order modal
        this.close();
        document.getElementById('orderModal').classList.add('open');
        document.getElementById('orderModalOverlay').classList.add('open');
        document.body.style.overflow = 'hidden';
    },

    closeOrderModal() {
        document.getElementById('orderModal').classList.remove('open');
        document.getElementById('orderModalOverlay').classList.remove('open');
        document.body.style.overflow = '';
    },

    backToCart() {
        this.closeOrderModal();
        this.open();
    },

    async checkout() {
        // Validate form
        const nameInput = document.getElementById('customerName');
        const phoneInput = document.getElementById('customerPhone');
        const customerName = nameInput.value.trim();
        const customerPhone = phoneInput.value.trim();

        let hasError = false;

        if (!customerName) {
            nameInput.classList.add('error');
            hasError = true;
        } else {
            nameInput.classList.remove('error');
        }

        // Validación básica para números colombianos (10 dígitos, con o sin espacios)
        const phoneDigits = customerPhone.replace(/\D/g, '');
        if (!customerPhone || phoneDigits.length < 10) {
            phoneInput.classList.add('error');
            hasError = true;
        } else {
            phoneInput.classList.remove('error');
        }

        if (hasError) {
            alert('Por favor completa todos los campos requeridos');
            return;
        }

        if (this.items.length === 0) {
            alert('El carrito está vacío');
            return;
        }

        // Build WhatsApp message
        let message = `*NUEVO PEDIDO*\n\n`;
        message += `*Datos del Cliente:*\n`;
        message += `Hola, soy *${customerName}*\n`;
        message += `Mi número telefónico: *${customerPhone}*\n\n`;
        message += `*Productos:*\n`;

        let total = 0;
        this.items.forEach(item => {
            const subtotal = item.price * item.quantity;
            total += subtotal;
            message += `- ${item.name} (x${item.quantity}): ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(subtotal)}\n`;
        });

        message += `\n*Total a pagar: ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(total)}*`;
 

        // 1. Save Order to LocalStorage for Admin
        const newOrder = {
            id: Date.now(),
            date: new Date().toISOString(),
            status: 'pending_whatsapp',
            channel: 'whatsapp',
            items: JSON.parse(JSON.stringify(this.items)),
            total: total,
            customer: customerName,
            phone: customerPhone
        };

        console.log('🛒 Creando nuevo pedido:', newOrder);

        let existingOrders;
        try {
            const ordersData = localStorage.getItem('orders');
            existingOrders = ordersData ? JSON.parse(ordersData) : [];
        } catch (err) {
            console.error('❌ Error leyendo pedidos previos', err);
            existingOrders = [];
        }

        if (!Array.isArray(existingOrders)) {
            existingOrders = [];
        }

        existingOrders.push(newOrder);
        localStorage.setItem('orders', JSON.stringify(existingOrders));
        console.log('✅ Pedido guardado localmente. Total de pedidos:', existingOrders.length);

        // 2. Guardar en Supabase (si está disponible)
        if (window.supabaseHelpers && window.supabaseHelpers.addOrder) {
            try {
                await window.supabaseHelpers.addOrder(newOrder);
                console.log('✅ Pedido enviado a Supabase');
            } catch (err) {
                console.error('❌ Error enviando pedido a Supabase', err);
            }
        } else {
            console.warn('ℹ️ Supabase no inicializado, solo se guardó en localStorage');
        }

        // 3. Abrir WhatsApp con manejo de bloqueo de popups
        const phoneNumber = "573219395309"; 
        const url = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
        const win = window.open(url, '_blank');

        if (!win || win.closed || typeof win.closed === 'undefined') {
            alert('No se pudo abrir WhatsApp. Activa las ventanas emergentes o copia y abre este enlace:\n\n' + url);
            return; // No limpiar el carrito si no se abrió
        }
        
        // 4. Clear cart and close modal solo si se abrió WhatsApp
        this.items = [];
        this.save();
        this.render();
        this.closeOrderModal();
        this.updateBadge();
    }
};

// Event Listeners for Cart UI
document.addEventListener('DOMContentLoaded', () => {
    console.log('📦 Inicializando Cart...');
    Cart.init();

    const cartBtn = document.getElementById('cartBtn');
    const closeCartBtn = document.getElementById('closeCartBtn');
    const cartOverlay = document.getElementById('cartOverlay');
    const confirmOrderBtn = document.getElementById('confirmOrderBtn');
    const closeOrderModal = document.getElementById('closeOrderModal');
    const orderModalOverlay = document.getElementById('orderModalOverlay');
    const backToCartBtn = document.getElementById('backToCartBtn');
    const sendWhatsAppBtn = document.getElementById('sendWhatsAppBtn');

    if (cartBtn) {
        cartBtn.addEventListener('click', () => Cart.open());
        console.log('✅ cartBtn listener attached');
    }
    
    if (closeCartBtn) {
        closeCartBtn.addEventListener('click', () => Cart.close());
        console.log('✅ closeCartBtn listener attached');
    }
    
    if (cartOverlay) {
        cartOverlay.addEventListener('click', () => Cart.close());
        console.log('✅ cartOverlay listener attached');
    }
    
    // New: Confirm Order button opens the order modal
    if (confirmOrderBtn) {
        confirmOrderBtn.addEventListener('click', () => {
            console.log('📋 Confirm order button clicked!');
            Cart.openOrderModal();
        });
        console.log('✅ confirmOrderBtn listener attached');
    }

    // Order Modal controls
    if (closeOrderModal) {
        closeOrderModal.addEventListener('click', () => Cart.closeOrderModal());
    }

    if (orderModalOverlay) {
        orderModalOverlay.addEventListener('click', () => Cart.closeOrderModal());
    }

    if (backToCartBtn) {
        backToCartBtn.addEventListener('click', () => Cart.backToCart());
    }

    if (sendWhatsAppBtn) {
        sendWhatsAppBtn.addEventListener('click', () => {
            console.log('🚀 Send WhatsApp button clicked!');
            Cart.checkout();
        });
        console.log('✅ sendWhatsAppBtn listener attached');
    }

    // Close with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            Cart.closeOrderModal();
        }
    });
});
