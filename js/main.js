// Product Data Manager
const ProductManager = {
    products: [],
    categoryMap: {}, // slug → visible name

    // Resolve one or more slugs to their visible names
    catName(slug) {
        return this.categoryMap[slug] || slug;
    },
    catNames(slugs) {
        if (!Array.isArray(slugs) || slugs.length === 0) return '';
        return slugs.map(s => this.catName(s)).join(' · ');
    },

    async init() {
        if (!(window.supabaseHelpers && window.supabaseHelpers.fetchProducts)) {
            console.error('Supabase no está disponible en el frontend');
            document.getElementById('productsGrid').innerHTML = '<p>Error al cargar productos.</p>';
            return;
        }

        let rawCategories = [];
        try {
            const data = await window.supabaseHelpers.fetchProducts();
            // Build slug → name map: try Supabase first, then localStorage, then defaults
            if (window.supabaseHelpers.fetchCategories) {
                try {
                    const sbCats = await window.supabaseHelpers.fetchCategories();
                    if (Array.isArray(sbCats) && sbCats.length > 0) {
                        rawCategories = sbCats;
                        localStorage.setItem('categories', JSON.stringify(sbCats));
                    }
                } catch (e) { /* silent fallback */ }
            }
            if (!rawCategories.length) {
                rawCategories = JSON.parse(localStorage.getItem('categories') || '[]');
            }
            this.categoryMap = {};
            rawCategories.forEach(c => { this.categoryMap[c.slug] = c.name; });
            // Fallback defaults in case both Supabase and localStorage are empty
            if (!Object.keys(this.categoryMap).length) {
                this.categoryMap = {
                    'destilados-thc': 'Destilados THC',
                    'baterias-para-destilados': 'Baterías para Destilados',
                    'destilados-importados': 'Destilados Importados',
                    'destilados-nacionales': 'Destilados Nacionales',
                    'ofertas': 'Ofertas'
                };
            }
            // Filter by visibility: is_visible column (Supabase, cross-device) is source of truth.
            // Fall back to localStorage hiddenProducts for devices/browsers that haven't synced yet.
            const hiddenIds = JSON.parse(localStorage.getItem('hiddenProducts') || '[]');
            const inStock = Array.isArray(data)
                ? data.filter(p => {
                    if ((p.stock || 0) <= 0) return false;
                    if (p.is_visible === false) return false;  // Supabase column
                    if (p.is_visible == null && hiddenIds.includes(String(p.id))) return false; // localStorage fallback
                    return true;
                })
                : [];

            // Normalize fields — categories column from Supabase takes priority over localStorage
            const storedCats = JSON.parse(localStorage.getItem('productCategories') || '{}');
            this.products = inStock.map(p => {
                const sbCats = Array.isArray(p.categories) && p.categories.length > 0 ? p.categories : null;
                const cats = sbCats || storedCats[String(p.id)] || (p.category ? [p.category] : []);
                return {
                    ...p,
                    category: cats[0] || p.category || '',
                    categories: cats,
                    gallery: Array.isArray(p.gallery) && p.gallery.length > 0 ? p.gallery : [p.image].filter(Boolean),
                    reviews: p.reviews || [],
                    rating: p.rating || 0,
                    fullDescription: p.fullDescription || p.description || ''
                };
            });
        } catch (error) {
            console.error('Error loading products desde Supabase:', error);
            document.getElementById('productsGrid').innerHTML = '<p>Error al cargar productos.</p>';
            return;
        }

        this.renderProducts('all');
        // Render featured product in hero (if any)
        this.renderFeatured();
        // Render filter buttons with categories loaded from Supabase
        this.renderFilterButtons(rawCategories);
    },

    renderFilterButtons(categoriesList) {
        const container = document.getElementById('categoryFilters');
        if (!container) return;

        // If no categories provided, use defaults
        if (!categoriesList || !categoriesList.length) {
            categoriesList = Object.entries(this.categoryMap).map(([slug, name], i) => ({
                id: `cat-${i + 1}`, name, slug, order: i, visible: true
            }));
        }

        container.innerHTML = '';

        // "Todos" button
        const allBtn = document.createElement('button');
        allBtn.className = 'filter-btn active';
        allBtn.setAttribute('data-category', 'all');
        allBtn.textContent = 'Todos';
        container.appendChild(allBtn);

        // One button per visible category
        categoriesList.forEach(cat => {
            if (cat.visible !== false) {
                const btn = document.createElement('button');
                btn.className = 'filter-btn';
                btn.setAttribute('data-category', cat.slug);
                const icon = cat.slug === 'ofertas' ? '<i class="fas fa-percent"></i> ' : '';
                btn.innerHTML = icon + cat.name;
                container.appendChild(btn);
            }
        });

        // Attach click listeners
        const allBtns = container.querySelectorAll('.filter-btn');
        allBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                allBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                ProductManager.renderProducts(btn.getAttribute('data-category'));
            });
        });
    },

    renderFeatured() {
        const heroImage = document.getElementById('heroCardImage');
        const heroTitle = document.getElementById('heroCardTitle');
        const heroPrice = document.getElementById('heroCardPrice');
        const heroMeta = document.getElementById('heroCardMeta');
        const heroCategory = document.getElementById('heroCardCategory');
        const heroViewBtn = document.getElementById('heroViewBtn');
        const heroBuyBtn = document.getElementById('heroBuyBtn');

        if (!heroTitle || !heroImage) return;

        // Source of truth order: is_featured Supabase column → localStorage featuredProductId → first product
        const _fid = localStorage.getItem('featuredProductId');
        let featured = this.products.find(p => p.is_featured === true);
        if (!featured) featured = _fid ? this.products.find(p => String(p.id) === String(_fid)) : null;
        if (!featured) featured = this.products.find(p => p.isFeatured) || this.products[0];
        if (!featured) {
            heroTitle.textContent = 'Próximamente';
            heroPrice.textContent = '';
            heroMeta.textContent = 'No hay productos disponibles.';
            if (heroViewBtn) heroViewBtn.style.display = 'none';
            if (heroBuyBtn) heroBuyBtn.style.display = 'none';
            return;
        }

        // Update card basic info
        heroTitle.textContent = featured.name;
        heroMeta.textContent = featured.description || '';
        if (heroCategory) heroCategory.textContent = this.catName(featured.category) || 'Premium';

        // Price with offer support
        let priceHtml = '';
        let finalPrice = featured.price;
        if (featured.isOffer && featured.discountPercent > 0) {
            finalPrice = featured.price * (1 - featured.discountPercent / 100);
            priceHtml = `<span class="original">${formatPrice(featured.price)}</span>${formatPrice(finalPrice)}`;
        } else {
            priceHtml = formatPrice(featured.price);
        }
        heroPrice.innerHTML = priceHtml;

        // Setup carousel
        const gallery = Array.isArray(featured.gallery) && featured.gallery.length > 0 ? featured.gallery : (featured.image ? [featured.image] : []);
        const imgEl = document.getElementById('heroImageEl');
        const prevBtn = document.getElementById('heroPrev');
        const nextBtn = document.getElementById('heroNext');
        const indicators = document.getElementById('heroIndicators');

        // Clear previous listeners/interval if any
        if (!this.featuredState) this.featuredState = {};
        if (this.featuredState.interval) { clearInterval(this.featuredState.interval); this.featuredState.interval = null; }
        if (this.featuredState.prevHandler) { try { prevBtn.removeEventListener('click', this.featuredState.prevHandler); } catch(e){} }
        if (this.featuredState.nextHandler) { try { nextBtn.removeEventListener('click', this.featuredState.nextHandler); } catch(e){} }

        let current = 0;
        function show(i) {
            current = (i + gallery.length) % gallery.length;
            if (imgEl) imgEl.src = gallery[current] || '';
            // update indicators
            if (indicators) {
                indicators.innerHTML = '';
                gallery.forEach((g, idx) => {
                    const dot = document.createElement('div');
                    dot.className = 'dot' + (idx === current ? ' active' : '');
                    dot.addEventListener('click', () => show(idx));
                    indicators.appendChild(dot);
                });
            }
        }

        if (gallery.length === 0) {
            if (imgEl) imgEl.src = '';
        } else if (gallery.length === 1) {
            show(0);
        } else {
            show(0);
            const prevHandler = () => show(current - 1);
            const nextHandler = () => show(current + 1);
            prevBtn.addEventListener('click', prevHandler);
            nextBtn.addEventListener('click', nextHandler);
            // autoplay every 5s
            this.featuredState.prevHandler = prevHandler;
            this.featuredState.nextHandler = nextHandler;
            this.featuredState.interval = setInterval(() => show(current + 1), 5000);
        }

        if (heroViewBtn) {
            heroViewBtn.style.display = '';
            heroViewBtn.onclick = () => openProductModal(featured.id);
        }
        if (heroBuyBtn) {
            heroBuyBtn.style.display = '';
            heroBuyBtn.onclick = () => {
                addToCart(featured.id);
                heroBuyBtn.innerHTML = '<span><i class="fas fa-check"></i></span>';
                setTimeout(() => {
                    heroBuyBtn.innerHTML = '<span><i class="fas fa-cart-plus"></i></span>';
                }, 1500);
            };
        }
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
            filtered = this.products.filter(p => {
                const cats = Array.isArray(p.categories) && p.categories.length > 0
                    ? p.categories
                    : (p.category ? [p.category] : []);
                return cats.includes(category);
            });
        }

        if (filtered.length === 0) {
            container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--white-muted);">No se encontraron productos en esta categoría.</p>';
            return;
        }

        filtered.forEach(product => {
            const card = document.createElement('div');
            card.className = 'prod-card';
            card.setAttribute('data-product-id', product.id);
            
            // Calculate final price
            let finalPrice = product.price;
            let priceHtml = '';

            if (product.isOffer && product.discountPercent > 0) {
                finalPrice = product.price * (1 - product.discountPercent / 100);
                priceHtml = `
                    <span class="original-price">${formatPrice(product.price)}</span>
                    ${formatPrice(finalPrice)}
                `;
            } else {
                priceHtml = formatPrice(product.price);
            }

            // Badge logic
            let badgeHtml = '';
            if (product.isOffer && product.discountPercent > 0) {
                badgeHtml = `<div class="prod-badge badge-limited">-${product.discountPercent}%</div>`;
            } else if (product.isNew) {
                badgeHtml = `<div class="prod-badge badge-new">Nuevo</div>`;
            } else {
                badgeHtml = `<div class="prod-badge badge-top">${this.catName(product.category)}</div>`;
            }

            // Background gradient based on category
            let bgGradient = 'radial-gradient(ellipse at 50% 20%, rgba(45,107,71,0.2), #0a0a0a)';
            const allCatStr = (Array.isArray(product.categories) && product.categories.length > 0
                ? product.categories : [product.category || '']).join(' ').toLowerCase();
            if (allCatStr.includes('bateria')) {
                bgGradient = 'radial-gradient(ellipse at 50% 20%, rgba(100,80,180,0.2), #0a0a0a)';
            } else if (allCatStr.includes('importado')) {
                bgGradient = 'radial-gradient(ellipse at 50% 20%, rgba(60,60,80,0.3), #0a0a0a)';
            } else if (product.isOffer) {
                bgGradient = 'radial-gradient(ellipse at 50% 20%, rgba(201,169,110,0.2), #0a0a0a)';
            }

            const displayCat = Array.isArray(product.categories) && product.categories.length > 0
                ? this.catNames(product.categories)
                : this.catName(product.category || '');
            
            card.innerHTML = `
                <div class="prod-image">
                    <div class="prod-img-bg" style="background: ${bgGradient}"></div>
                    <div class="prod-spotlight"></div>
                    ${badgeHtml}
                    <img class="prod-emoji" src="${product.image}" alt="${product.name}" loading="lazy" onerror="this.src='favicon.svg'">
                </div>
                <div class="prod-info">
                    <p class="prod-category">${displayCat}</p>
                    <h3 class="prod-name">${product.name}</h3>
                    <p class="prod-origin">${product.description}</p>
                    <div class="prod-bottom">
                        <div class="prod-price">${priceHtml}</div>
                        ${product.stock > 0 
                            ? `<button class="add-to-cart" onclick="event.stopPropagation(); addToCart('${product.id}')" title="Añadir al carrito"><i class="fas fa-plus"></i></button>`
                            : `<button class="add-to-cart" style="opacity: 0.4; cursor: not-allowed;" disabled><i class="fas fa-times"></i></button>`
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
    const catSlugs = Array.isArray(product.categories) && product.categories.length > 0
        ? product.categories : (product.category ? [product.category] : []);
    document.getElementById('modalCategory').textContent = ProductManager.catNames(catSlugs) || product.category;
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
    const gallery = Array.isArray(product.gallery) && product.gallery.length > 0 
        ? product.gallery 
        : [product.image];
    const mainImg = document.getElementById('galleryMainImg');
    mainImg.src = gallery[0] || '';
    mainImg.alt = product.name;
    mainImg.onerror = () => { mainImg.src = 'favicon.svg'; };
    
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
    modal.classList.add('active');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeProductModal() {
    const modal = document.getElementById('productModal');
    const overlay = document.getElementById('productModalOverlay');
    
    modal.classList.remove('active');
    overlay.classList.remove('active');
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
        
        // Show toast notification
        if (window.showToast) {
            window.showToast(product.name);
        }
        
        // Visual feedback: pulse the cart badge
        const badge = document.getElementById('cartCount');
        if (badge) {
            badge.classList.add('bump');
            setTimeout(() => { badge.classList.remove('bump'); }, 300);
        }
        
        // Visual feedback on the add-to-cart button
        const card = document.querySelector(`[data-product-id="${id}"]`);
        if (card) {
            const btn = card.querySelector('.add-to-cart');
            if (btn) {
                btn.classList.add('added');
                setTimeout(() => btn.classList.remove('added'), 600);
            }
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

});
