const Cart = {
    items: [],
    selectedPayment: 'whatsapp',

    init() {
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
            // Only store what the cart UI needs — keeps localStorage lean
            this.items.push({
                id: String(product.id),
                name: product.name,
                price: product.price,
                image: product.image || '',
                quantity: 1
            });
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

    _showToast(message, type = 'info') {
        const existing = document.getElementById('cartToast');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.id = 'cartToast';
        toast.style.cssText = [
            'position:fixed', 'bottom:20px', 'left:50%', 'transform:translateX(-50%)',
            'z-index:99999', 'max-width:90vw', 'padding:12px 18px',
            'border-radius:10px', 'font-size:13px', 'font-weight:600',
            'box-shadow:0 4px 20px rgba(0,0,0,0.25)', 'text-align:center',
            type === 'error'
                ? 'background:#fef2f2;color:#b91c1c;border:1px solid #fca5a5'
                : 'background:#f0fdf4;color:#166534;border:1px solid #86efac'
        ].join(';');
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 7000);
    },

    selectPayment(method) {
        this.selectedPayment = method;
        const optWa = document.getElementById('optWhatsapp');
        const optWp = document.getElementById('optWompi');
        if (optWa) optWa.classList.toggle('selected', method === 'whatsapp');
        if (optWp) optWp.classList.toggle('selected', method === 'wompi');
        const btn = document.getElementById('sendWhatsAppBtn');
        if (btn) {
            if (method === 'wompi') {
                btn.innerHTML = '<span><i class="fas fa-credit-card"></i> Pagar en línea</span>';
            } else {
                btn.innerHTML = '<span><i class="fab fa-whatsapp"></i> Enviar por WhatsApp</span>';
            }
        }
    },

    async sha256(message) {
        const encoder = new TextEncoder();
        const data = encoder.encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
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
            cartItemsContainer.innerHTML = '<div style="text-align: center; margin-top: 2rem; color: var(--white-dim, rgba(245,245,240,0.3));">Tu carrito está vacío</div>';
            cartTotalElement.innerText = '$0';
            return;
        }

        let total = 0;
        cartItemsContainer.innerHTML = this.items.map(item => {
            const subtotal = item.price * item.quantity;
            total += subtotal;
            return `
                <div class="cart-item">
                    <div class="cart-item-image">
                        <img src="${item.image}" alt="${item.name}">
                    </div>
                    <div class="cart-item-info">
                        <div class="cart-item-name">${item.name}</div>
                        <div class="cart-item-price">${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(item.price)}</div>
                        <div class="cart-item-qty">
                            <button class="qty-btn" onclick="Cart.updateQuantity('${item.id}', -1)">-</button>
                            <span>${item.quantity}</span>
                            <button class="qty-btn" onclick="Cart.updateQuantity('${item.id}', 1)">+</button>
                            <button class="cart-item-remove" onclick="Cart.remove('${item.id}')"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        cartTotalElement.innerText = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(total);
    },

    open() {
        document.getElementById('cartSidebar').classList.add('active');
        document.getElementById('cartOverlay').classList.add('active');
    },

    close() {
        document.getElementById('cartSidebar').classList.remove('active');
        document.getElementById('cartOverlay').classList.remove('active');
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
        this.selectPayment('whatsapp'); // Resetear al default cada vez que se abre
        document.getElementById('orderModal').classList.add('active');
        document.getElementById('orderModalOverlay').classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    closeOrderModal() {
        document.getElementById('orderModal').classList.remove('active');
        document.getElementById('orderModalOverlay').classList.remove('active');
        document.body.style.overflow = '';
    },

    backToCart() {
        this.closeOrderModal();
        this.open();
    },

    async checkout() {
        if (this.selectedPayment === 'wompi') {
            await this.checkoutWompi();
        } else {
            await this.checkoutWhatsApp();
        }
    },

    async checkoutWompi() {
        const cfg = window.wompiConfig;
        if (!cfg || !cfg.publicKey || !cfg.integritySecret ||
            cfg.publicKey === 'PENDIENTE' || cfg.integritySecret === 'PENDIENTE') {
            this._showToast('⚠️ Pasarela de pagos no configurada aún. Por favor usa WhatsApp.', 'error');
            return;
        }

        const nameInput    = document.getElementById('customerName');
        const phoneInput   = document.getElementById('customerPhone');
        const cityInput    = document.getElementById('customerCity');
        const addressInput = document.getElementById('customerAddress');

        const customerName         = nameInput?.value?.trim()    || '';
        const customerPhone        = phoneInput?.value?.trim()   || '';
        const customerCity         = cityInput?.value?.trim()    || '';
        const customerAddress      = addressInput?.value?.trim() || '';
        const customerNeighborhood = document.getElementById('customerNeighborhood')?.value?.trim() || '';
        const customerApartment    = document.getElementById('customerApartment')?.value?.trim()    || '';
        const customerLandmark     = document.getElementById('customerLandmark')?.value?.trim()     || '';
        const customerNotes        = document.getElementById('customerNotes')?.value?.trim()        || '';

        let hasError = false;
        if (!customerName)  { nameInput?.classList.add('error');    hasError = true; } else { nameInput?.classList.remove('error'); }
        if (!customerPhone || customerPhone.replace(/\D/g, '').length < 10) { phoneInput?.classList.add('error'); hasError = true; } else { phoneInput?.classList.remove('error'); }
        if (!customerCity)    { cityInput?.classList.add('error');    hasError = true; } else { cityInput?.classList.remove('error'); }
        if (!customerAddress) { addressInput?.classList.add('error'); hasError = true; } else { addressInput?.classList.remove('error'); }
        if (hasError) { alert('Por favor completa todos los campos obligatorios marcados con (*)'); return; }
        if (this.items.length === 0) { alert('El carrito está vacío'); return; }

        let fullAddress = customerAddress;
        if (customerApartment)    fullAddress += `, ${customerApartment}`;
        if (customerNeighborhood) fullAddress += ` - ${customerNeighborhood}`;
        fullAddress += `, ${customerCity}`;

        const total       = this.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
        const orderId     = Date.now();
        const reference   = `LUXDEST-${orderId}`;
        const amountCents = Math.round(total * 100);

        const newOrder = {
            id:       orderId,
            date:     new Date().toISOString(),
            status:   'pending_payment',
            channel:  'wompi',
            items:    JSON.parse(JSON.stringify(this.items)),
            total,
            customer: customerName,
            phone:    customerPhone,
            address: {
                city:         customerCity,
                street:       customerAddress,
                neighborhood: customerNeighborhood,
                apartment:    customerApartment,
                landmark:     customerLandmark,
                notes:        customerNotes,
                full:         fullAddress
            }
        };

        // Guardar en localStorage
        try {
            const existing = JSON.parse(localStorage.getItem('orders') || '[]');
            existing.push(newOrder);
            localStorage.setItem('orders', JSON.stringify(existing));
        } catch (e) {}

        // Guardar en Supabase antes de redirigir
        if (window.supabaseHelpers && window.supabaseHelpers.addOrder) {
            try { await window.supabaseHelpers.addOrder(newOrder); } catch (e) { console.warn('Supabase pre-save wompi failed:', e); }
        }

        // Guardar referencia para verificar al retornar
        localStorage.setItem('wompiPendingRef', JSON.stringify({ reference, orderId: String(orderId) }));

        // Generar firma de integridad: SHA256(reference + amountCents + "COP" + integritySecret)
        const signature = await this.sha256(`${reference}${amountCents}COP${cfg.integritySecret}`);

        // Construir URL de checkout Wompi
        // IMPORTANTE: URLSearchParams codifica ':' como '%3A' en las claves,
        // lo que hace que Wompi devuelva 403. Se construye manualmente para
        // preservar los ':' literales que Wompi requiere en sus parámetros.
        const redirectUrl = window.location.origin + window.location.pathname;
        const wompiParams = [
            ['public-key',                        cfg.publicKey],
            ['currency',                          'COP'],
            ['amount-in-cents',                   String(amountCents)],
            ['reference',                         reference],
            ['signature:integrity',               signature],
            ['redirect-url',                      redirectUrl],
            ['customer-data:full-name',           customerName],
            ['customer-data:phone-number',        customerPhone.replace(/\D/g, '').slice(-10)],
            ['customer-data:phone-number-prefix', '+57']
        ];
        // Codifica valores pero mantiene ':' sin codificar en los nombres de clave
        const queryString = wompiParams
            .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
            .join('&');

        window.location.href = `https://checkout.wompi.co/p/?${queryString}`;
    },

    async checkoutWhatsApp() {
        // Get all form inputs
        const nameInput = document.getElementById('customerName');
        const phoneInput = document.getElementById('customerPhone');
        const cityInput = document.getElementById('customerCity');
        const addressInput = document.getElementById('customerAddress');
        const neighborhoodInput = document.getElementById('customerNeighborhood');
        const apartmentInput = document.getElementById('customerApartment');
        const landmarkInput = document.getElementById('customerLandmark');
        const notesInput = document.getElementById('customerNotes');

        // Get values
        const customerName = nameInput?.value?.trim() || '';
        const customerPhone = phoneInput?.value?.trim() || '';
        const customerCity = cityInput?.value?.trim() || '';
        const customerAddress = addressInput?.value?.trim() || '';
        const customerNeighborhood = neighborhoodInput?.value?.trim() || '';
        const customerApartment = apartmentInput?.value?.trim() || '';
        const customerLandmark = landmarkInput?.value?.trim() || '';
        const customerNotes = notesInput?.value?.trim() || '';

        // Validate required fields
        let hasError = false;

        if (!customerName) {
            nameInput?.classList.add('error');
            hasError = true;
        } else {
            nameInput?.classList.remove('error');
        }

        const phoneDigits = customerPhone.replace(/\D/g, '');
        if (!customerPhone || phoneDigits.length < 10) {
            phoneInput?.classList.add('error');
            hasError = true;
        } else {
            phoneInput?.classList.remove('error');
        }

        if (!customerCity) {
            cityInput?.classList.add('error');
            hasError = true;
        } else {
            cityInput?.classList.remove('error');
        }

        if (!customerAddress) {
            addressInput?.classList.add('error');
            hasError = true;
        } else {
            addressInput?.classList.remove('error');
        }

        if (hasError) {
            alert('Por favor completa todos los campos obligatorios marcados con (*)');
            return;
        }

        if (this.items.length === 0) {
            alert('El carrito está vacío');
            return;
        }

        // Build full address
        let fullAddress = customerAddress;
        if (customerApartment) fullAddress += `, ${customerApartment}`;
        if (customerNeighborhood) fullAddress += ` - ${customerNeighborhood}`;
        fullAddress += `, ${customerCity}`;

        // Build WhatsApp message
        let message = `📦 *NUEVO PEDIDO*\n\n`;
        message += `👤 *Datos del Cliente:*\n`;
        message += `• Nombre: *${customerName}*\n`;
        message += `• Teléfono: *${customerPhone}*\n\n`;
        
        message += `📍 *Dirección de Entrega:*\n`;
        message += `• ${fullAddress}\n`;
        if (customerLandmark) message += `• Referencia: ${customerLandmark}\n`;
        if (customerNotes) message += `• Notas: ${customerNotes}\n`;
        message += `\n`;

        message += `🛒 *Productos:*\n`;

        let total = 0;
        this.items.forEach(item => {
            const subtotal = item.price * item.quantity;
            total += subtotal;
            message += `- ${item.name} (x${item.quantity}): ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(subtotal)}\n`;
        });

        message += `\n💰 *Total a pagar: ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(total)}*`;
        message += `\n\n✨ _¡Gracias por tu pedido!_`;

        // 1. Save Order to LocalStorage for Admin
        const newOrder = {
            id: Date.now(),
            date: new Date().toISOString(),
            status: 'pending_whatsapp',
            channel: 'whatsapp',
            items: JSON.parse(JSON.stringify(this.items)),
            total: total,
            customer: customerName,
            phone: customerPhone,
            address: {
                city: customerCity,
                street: customerAddress,
                neighborhood: customerNeighborhood,
                apartment: customerApartment,
                landmark: customerLandmark,
                notes: customerNotes,
                full: fullAddress
            }
        };

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

        // 2. Guardar en Supabase (si está disponible)
        if (window.supabaseHelpers && window.supabaseHelpers.addOrder) {
            try {
                await window.supabaseHelpers.addOrder(newOrder);
                console.log('✅ Pedido guardado en Supabase:', newOrder.id);
            } catch (err) {
                console.error('❌ Error enviando pedido a Supabase:', err?.message || err, err);
                // Show a visible warning on any device (including mobile)
                Cart._showToast('⚠️ El pedido se envió por WhatsApp pero no se pudo registrar en el sistema. Código: ' + (err?.message || 'desconocido'), 'error');
            }
        } else {
            console.warn('⚠️ supabaseHelpers no disponible — pedido guardado solo en localStorage');
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
    }
    
    if (closeCartBtn) {
        closeCartBtn.addEventListener('click', () => Cart.close());
    }
    
    if (cartOverlay) {
        cartOverlay.addEventListener('click', () => Cart.close());
    }
    
    if (confirmOrderBtn) {
        confirmOrderBtn.addEventListener('click', () => Cart.openOrderModal());
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
        sendWhatsAppBtn.addEventListener('click', () => Cart.checkout());
    }

    // Close with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            Cart.closeOrderModal();
        }
    });
});
