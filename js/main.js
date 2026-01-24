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

        let filtered;
        if (category === 'all') {
            filtered = this.products;
        } else if (category === 'ofertas') {
            filtered = this.products.filter(p => p.isOffer);
        } else {
            filtered = this.products.filter(p => p.category === category);
        }

        if (filtered.length === 0) {
            container.innerHTML = '<p class="text-center" style="grid-column: 1/-1;">No se encontraron productos en esta categoría.</p>';
            return;
        }

        filtered.forEach(product => {
            const card = document.createElement('div');
            card.className = 'product-card';
            
            // Offer Calc
            let priceHtml = '';
            let finalPrice = product.price;

            if (product.isOffer && product.discountPercent > 0) {
                finalPrice = product.price * (1 - product.discountPercent / 100);
                priceHtml = `
                    <div style="display:flex; flex-direction:column; align-items: flex-start;">
                        <span class="old-price">${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(product.price)}</span>
                        <span class="product-price" style="color: var(--danger-color); font-weight: 800;">
                            ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(finalPrice)}
                        </span>
                    </div>
                `;
            } else {
                priceHtml = `<span class="product-price">${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(product.price)}</span>`;
            }

            // Offer badge logic
            const offerBadge = product.isOffer ? `<div class="offer-sticker">-${product.discountPercent || 0}%</div>` : '';
            
            card.innerHTML = `
                <div class="product-image-container relative">
                    ${offerBadge}
                    <span class="product-category-badge">${product.category}</span>
                    <img src="${product.image}" alt="${product.name}" class="product-image">
                </div>
                <div class="product-info">
                    <h3 class="product-title">${product.name}</h3>
                    <p class="product-desc">${product.description}</p>
                    <div class="product-footer">
                        ${priceHtml}
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
        // Calculate effective price if offer
        let effectivePrice = product.price;
        if (product.isOffer && product.discountPercent > 0) {
            effectivePrice = product.price * (1 - product.discountPercent / 100);
        }

        // Pass a copy with the effective price
        Cart.add({
            ...product,
            price: effectivePrice
        });
        
        // Show tiny feedback
        const btn = event.currentTarget;
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => btn.innerHTML = originalHtml, 1000);
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    ProductManager.init();

    // Render Dynamic Filters from LocalStorage Categories
    const categoriesContainer = document.getElementById('categoryFilters');
    const storedCategories = localStorage.getItem('categories');
    let categoriesList = [];

    // Default Fallback matching Admin defaults if LS empty
    if (storedCategories) {
        categoriesList = JSON.parse(storedCategories);
    } else {
        categoriesList = [
            { name: 'Tecnología', slug: 'tecnologia', visible: true },
            { name: 'Moda', slug: 'moda', visible: true },
            { name: 'Hogar', slug: 'hogar', visible: true },
            { name: 'Deportes', slug: 'deportes', visible: true },
            { name: 'Ofertas', slug: 'ofertas', visible: true }
        ];
    }

    if (categoriesContainer) {
        // Clear existing except static if any (we will rebuild all)
        categoriesContainer.innerHTML = '';

        // 1. "Todos" Button (Always Present)
        const allBtn = document.createElement('button');
        allBtn.className = 'filter-btn active';
        allBtn.setAttribute('data-category', 'all');
        allBtn.textContent = 'Todos';
        categoriesContainer.appendChild(allBtn);

        // 2. Dynamic Buttons
        categoriesList.forEach(cat => {
            if (cat.visible) {
                const btn = document.createElement('button');
                btn.className = 'filter-btn';
                btn.setAttribute('data-category', cat.slug);
                
                // Icon logic for specific known types or generic
                let iconHtml = '';
                if(cat.slug === 'ofertas') iconHtml = '<i class="fas fa-percent mr-1"></i> ';
                
                btn.innerHTML = iconHtml + cat.name;
                categoriesContainer.appendChild(btn);
            }
        });

        // 3. Re-attach Event Listeners
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
    }
});
