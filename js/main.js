// Product Data Manager
const ProductManager = {
    products: [],

    async init() {
        const storedProducts = localStorage.getItem('products');
        let shouldReload = false;
        
        if (storedProducts) {
            this.products = JSON.parse(storedProducts);
             // Migration check for General Store update
             if (this.products.length > 0 && this.products[0].category === 'vapes') {
                shouldReload = true;
            }
        } else {
            shouldReload = true;
        }

        if (shouldReload) {
            try {
                const response = await fetch('data/products.json');
                const data = await response.json();
                this.products = data;
                // Save initial data to LS so Admin changes persist
                localStorage.setItem('products', JSON.stringify(data));
            } catch (error) {
                console.error('Error loading products:', error);
                document.getElementById('productsGrid').innerHTML = '<p>Error al cargar productos.</p>';
            }
        }
        
        this.renderProducts('all');
    },

    renderProducts(category) {
        const container = document.getElementById('productsGrid');
        if (!container) return;

        container.innerHTML = '';

        const filtered = category === 'all' 
            ? this.products 
            : this.products.filter(p => p.category === category);

        if (filtered.length === 0) {
            container.innerHTML = '<p class="text-center" style="grid-column: 1/-1;">No se encontraron productos en esta categoría.</p>';
            return;
        }

        filtered.forEach(product => {
            const card = document.createElement('div');
            card.className = 'product-card';
            card.innerHTML = `
                <div class="product-image-container">
                    <span class="product-category-badge">${product.category}</span>
                    <img src="${product.image}" alt="${product.name}" class="product-image">
                </div>
                <div class="product-info">
                    <h3 class="product-title">${product.name}</h3>
                    <p class="product-desc">${product.description}</p>
                    <div class="product-footer">
                        <span class="product-price">${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(product.price)}</span>
                        ${product.stock > 0 
                            ? `<button class="btn-add" onclick="addToCart(${product.id})" title="Añadir al carrito"><i class="fas fa-plus"></i></button>`
                            : `<button class="btn-secondary" style="font-size:0.8rem; padding: 0.2rem 0.5rem; border-radius: 4px;" disabled>Agotado</button>`
                        }
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    }
};

// Global helper for onclick event
window.addToCart = (id) => {
    const product = ProductManager.products.find(p => p.id === id);
    if (product && product.stock > 0) {
        Cart.add(product);
        // Optional: Animation or toast notification could go here
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    ProductManager.init();

    // Filter Buttons Logic
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all
            filterBtns.forEach(b => b.classList.remove('active'));
            // Add to click
            btn.classList.add('active');
            // Filter
            const category = btn.getAttribute('data-category');
            ProductManager.renderProducts(category);
        });
    });
});
