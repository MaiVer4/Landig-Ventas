const Cart = {
    items: [],

    init() {
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
        if (this.items.length === 0) return;

        let message = "Hola, me gustaría realizar el siguiente pedido:\n\n";
        let total = 0;

        this.items.forEach(item => {
            const subtotal = item.price * item.quantity;
            total += subtotal;
            message += `- ${item.name} (x${item.quantity}): ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(subtotal)}\n`;
        });

        message += `\n*Total a pagar: ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(total)}*`;

        // Encode and open WhatsApp (Replace number with your storefront number)
        // Using a dummy placeholder number 1234567890
        const phoneNumber = "573001234567"; 
        const url = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
        
        // Optional: clear cart after checkout
        // this.items = [];
        // this.save();
        // this.render();
    }
};

// Event Listeners for Cart UI
document.addEventListener('DOMContentLoaded', () => {
    Cart.init();

    const cartBtn = document.getElementById('cartBtn');
    const closeCartBtn = document.getElementById('closeCartBtn');
    const cartOverlay = document.getElementById('cartOverlay');
    const checkoutBtn = document.getElementById('checkoutBtn');

    if (cartBtn) cartBtn.addEventListener('click', () => Cart.open());
    if (closeCartBtn) closeCartBtn.addEventListener('click', () => Cart.close());
    if (cartOverlay) cartOverlay.addEventListener('click', () => Cart.close());
    if (checkoutBtn) checkoutBtn.addEventListener('click', () => Cart.checkout());
});
