// Product Data Manager
const ProductManager = {
    products: [],

    async init() {
        if (!(window.supabaseHelpers && window.supabaseHelpers.fetchProducts)) {
            console.error('Supabase no está disponible en el frontend');
            document.getElementById('productsGrid').innerHTML = '<p>Error al cargar productos.</p>';
            return;
        }

        try {
            const data = await window.supabaseHelpers.fetchProducts();
            const inStock = Array.isArray(data) ? data.filter(p => (p.stock || 0) > 0) : [];

            // Normalize fields to keep UI stable even si faltan columnas opcionales
            this.products = inStock.map(p => ({
                ...p,
                gallery: p.gallery || [p.image, p.image, p.image].filter(Boolean),
                reviews: p.reviews || [],
                rating: p.rating || 0,
                fullDescription: p.fullDescription || p.description || ''
            }));
        } catch (error) {
            console.error('Error loading products desde Supabase:', error);
            document.getElementById('productsGrid').innerHTML = '<p>Error al cargar productos.</p>';
            return;
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
            card.setAttribute('data-product-id', product.id);
            
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
            
            // Rating stars
            const ratingStars = product.rating ? `
                <div class="product-card-rating">
                    <span class="stars">${getStarsHtml(product.rating)}</span>
                    <span class="rating-text">${product.rating}</span>
                </div>
            ` : '';
            
            card.innerHTML = `
                <div class="product-image-container relative">
                    ${offerBadge}
                    <span class="product-category-badge">${product.category}</span>
                    <img src="${product.image}" alt="${product.name}" class="product-image">
                </div>
                <div class="product-info">
                    <h3 class="product-title">${product.name}</h3>
                    ${ratingStars}
                    <p class="product-desc">${product.description}</p>
                    <div class="product-footer">
                        ${priceHtml}
                        ${product.stock > 0 
                            ? `<button class="btn-add" onclick="event.stopPropagation(); addToCart('${product.id}')" title="Añadir al carrito"><i class="fas fa-plus"></i></button>`
                            : `<button class="btn-secondary" style="font-size:0.8rem; padding: 0.2rem 0.5rem; border-radius: 4px;" disabled>Agotado</button>`
                        }
                    </div>
                </div>
            `;
            
            // Add click event to open product detail
            card.addEventListener('click', () => openProductModal(product.id));
            
            container.appendChild(card);
        });
    }
};

// Helper function to generate star icons
function getStarsHtml(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    let html = '';
    for (let i = 0; i < fullStars; i++) {
        html += '<i class="fas fa-star"></i>';
    }
    if (hasHalfStar) {
        html += '<i class="fas fa-star-half-alt"></i>';
    }
    for (let i = 0; i < emptyStars; i++) {
        html += '<i class="far fa-star"></i>';
    }
    return html;
}

// Product Modal Functions
function openProductModal(productId) {
    const product = ProductManager.products.find(p => String(p.id) === String(productId));
    if (!product) return;
    
    const modal = document.getElementById('productModal');
    const overlay = document.getElementById('productModalOverlay');
    
    // Populate modal content
    document.getElementById('modalCategory').textContent = product.category;
    document.getElementById('modalTitle').textContent = product.name;
    
    // Rating
    const ratingHtml = `
        <span class="stars">${getStarsHtml(product.rating || 0)}</span>
        <span class="rating-value">${product.rating || 'N/A'}</span>
        <span class="rating-count">(${product.reviews ? product.reviews.length : 0} opiniones)</span>
    `;
    document.getElementById('modalRating').innerHTML = ratingHtml;
    
    // Description
    document.getElementById('modalDescription').textContent = product.fullDescription || product.description;
    
    // Price
    let priceHtml = '';
    let finalPrice = product.price;
    if (product.isOffer && product.discountPercent > 0) {
        finalPrice = product.price * (1 - product.discountPercent / 100);
        priceHtml = `
            <span class="current-price">${formatPrice(finalPrice)}</span>
            <span class="original-price">${formatPrice(product.price)}</span>
            <span class="discount-badge">-${product.discountPercent}%</span>
        `;
    } else {
        priceHtml = `<span class="current-price">${formatPrice(product.price)}</span>`;
    }
    document.getElementById('modalPrice').innerHTML = priceHtml;
    
    // Stock
    const stockEl = document.getElementById('modalStock');
    if (product.stock > 10) {
        stockEl.innerHTML = '<i class="fas fa-check-circle"></i> En stock';
        stockEl.className = 'product-modal-stock in-stock';
    } else if (product.stock > 0) {
        stockEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> ¡Solo quedan ${product.stock} unidades!`;
        stockEl.className = 'product-modal-stock low-stock';
    } else {
        stockEl.innerHTML = '<i class="fas fa-times-circle"></i> Agotado';
        stockEl.className = 'product-modal-stock out-of-stock';
    }
    
    // Add to cart button
    const addBtn = document.getElementById('modalAddToCart');
    addBtn.disabled = product.stock <= 0;
    addBtn.onclick = () => {
        addToCart(product.id);
        // Visual feedback
        const originalHtml = addBtn.innerHTML;
        addBtn.innerHTML = '<i class="fas fa-check"></i> ¡Agregado!';
        setTimeout(() => addBtn.innerHTML = originalHtml, 1500);
    };
    
    // Gallery
    const gallery = product.gallery || [product.image, product.image, product.image];
    const mainImg = document.getElementById('galleryMainImg');
    mainImg.src = gallery[0];
    mainImg.alt = product.name;
    
    const thumbsContainer = document.getElementById('galleryThumbs');
    thumbsContainer.innerHTML = '';
    gallery.forEach((img, index) => {
        const thumb = document.createElement('div');
        thumb.className = `gallery-thumb ${index === 0 ? 'active' : ''}`;
        thumb.innerHTML = `<img src="${img}" alt="${product.name} - imagen ${index + 1}">`;
        thumb.addEventListener('click', () => {
            mainImg.src = img;
            document.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
            thumb.classList.add('active');
        });
        thumbsContainer.appendChild(thumb);
    });
    
    // Reviews
    const reviewsList = document.getElementById('reviewsList');
    reviewsList.innerHTML = '';
    if (product.reviews && product.reviews.length > 0) {
        product.reviews.forEach(review => {
            const reviewEl = document.createElement('div');
            reviewEl.className = 'review-item';
            reviewEl.innerHTML = `
                <div class="review-header">
                    <span class="review-user"><i class="fas fa-user-circle"></i> ${review.user}</span>
                    <span class="review-date">${formatDate(review.date)}</span>
                </div>
                <div class="review-stars">${getStarsHtml(review.rating)}</div>
                <p class="review-comment">${review.comment}</p>
            `;
            reviewsList.appendChild(reviewEl);
        });
    } else {
        reviewsList.innerHTML = '<p style="color: var(--text-light); text-align: center;">Aún no hay opiniones para este producto.</p>';
    }
    
    // Open modal
    modal.classList.add('open');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeProductModal() {
    const modal = document.getElementById('productModal');
    const overlay = document.getElementById('productModalOverlay');
    
    modal.classList.remove('open');
    overlay.classList.remove('open');
    document.body.style.overflow = '';
}

// Helper to format price
function formatPrice(price) {
    return new Intl.NumberFormat('es-CO', { 
        style: 'currency', 
        currency: 'COP', 
        minimumFractionDigits: 0 
    }).format(price);
}

// Helper to format date
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('es-CO', options);
}

// Global filter helper used by nav
window.filterBy = (slug) => {
    const buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    const target = document.querySelector(`.filter-btn[data-category="${slug}"]`);
    if (target) {
        target.classList.add('active');
    }
    ProductManager.renderProducts(slug || 'all');
    const catalog = document.getElementById('catalogo');
    if (catalog) catalog.scrollIntoView({ behavior: 'smooth' });
};

// Global helper for onclick event
window.addToCart = (id) => {
    const product = ProductManager.products.find(p => String(p.id) === String(id));
    if (product && product.stock > 0) {
        // Calculate effective price if offer
        let effectivePrice = product.price;
        if (product.isOffer && product.discountPercent > 0) {
            effectivePrice = product.price * (1 - product.discountPercent / 100);
        }

        // Pass a copy with the effective price and normalize id as string
        Cart.add({
            ...product,
            id: String(product.id),
            price: effectivePrice
        });
        
        // Show tiny feedback
        const btn = event.currentTarget;
        if (btn) {
            const originalHtml = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i>';
            setTimeout(() => btn.innerHTML = originalHtml, 1000);
        }
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    ProductManager.init();

    // Product Modal Event Listeners
    const closeModalBtn = document.getElementById('closeProductModal');
    const modalOverlay = document.getElementById('productModalOverlay');
    
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeProductModal);
    }
    
    if (modalOverlay) {
        modalOverlay.addEventListener('click', closeProductModal);
    }
    
    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeProductModal();
        }
    });

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
