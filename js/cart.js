const Cart = {
    items: [],

    init() {
        console.log('🛒 Cart.js cargado correctamente');
        const savedCart = localStorage.getItem('cart');
        if (savedCart) {
            this.items = JSON.parse(savedCart);
        }
        this.render();
        this.updateBadge();
    },

    add(product) {
        const existingItem = this.items.find(item => item.id === product.id);
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
        this.items = this.items.filter(item => item.id !== id);
        this.save();
        this.render();
        this.updateBadge();
    },

    updateQuantity(id, change) {
        const item = this.items.find(item => item.id === id);
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
                            <button class="qty-btn" onclick="Cart.updateQuantity(${item.id}, -1)">-</button>
                            <span>${item.quantity}</span>
                            <button class="qty-btn" onclick="Cart.updateQuantity(${item.id}, 1)">+</button>
                            <button class="action-btn btn-delete" style="margin-left: auto; padding: 2px 6px;" onclick="Cart.remove(${item.id})"><i class="fas fa-trash"></i></button>
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

    checkout() {
        if (this.items.length === 0) {
            alert('El carrito está vacío');
            return;
        }

        let message = "Hola, me gustaría realizar el siguiente pedido:\n\n";
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
            items: JSON.parse(JSON.stringify(this.items)), // Deep copy
            total: total,
            customer: 'Cliente Web'
        };

        console.log('🛒 Creando nuevo pedido:', newOrder);

        let existingOrders;
        try {
            const ordersData = localStorage.getItem('orders');
            console.log('📦 Pedidos existentes (raw):', ordersData);
            existingOrders = ordersData ? JSON.parse(ordersData) : [];
        } catch (err) {
            console.error('❌ Error leyendo pedidos previos, se reinicia la lista', err);
            existingOrders = [];
        }

        if (!Array.isArray(existingOrders)) {
            console.warn('⚠️ Formato de pedidos inválido detectado, se crea lista nueva');
            existingOrders = [];
        }

        existingOrders.push(newOrder);
        const ordersJSON = JSON.stringify(existingOrders);
        localStorage.setItem('orders', ordersJSON);
        console.log('✅ Pedido guardado. Total de pedidos:', existingOrders.length);
        console.log('📋 Contenido final en localStorage:', ordersJSON);

        // 2. Open WhatsApp
        const phoneNumber = "573219395309"; 
        const url = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
        
        // 3. Clear cart
        this.items = [];
        this.save();
        this.render();
        this.close();
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
    const checkoutBtn = document.getElementById('checkoutBtn');

    if (cartBtn) {
        cartBtn.addEventListener('click', () => Cart.open());
        console.log('✅ cartBtn listener attached');
    } else {
        console.error('❌ cartBtn not found');
    }
    
    if (closeCartBtn) {
        closeCartBtn.addEventListener('click', () => Cart.close());
        console.log('✅ closeCartBtn listener attached');
    } else {
        console.error('❌ closeCartBtn not found');
    }
    
    if (cartOverlay) {
        cartOverlay.addEventListener('click', () => Cart.close());
        console.log('✅ cartOverlay listener attached');
    } else {
        console.error('❌ cartOverlay not found');
    }
    
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', () => {
            console.log('🚀 Checkout button clicked!');
            Cart.checkout();
        });
        console.log('✅ checkoutBtn listener attached');
    } else {
        console.error('❌ checkoutBtn not found');
    }
});
