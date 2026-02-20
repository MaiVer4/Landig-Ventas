const Admin = {
    products: [],
    categories: [],
    orders: [],
    salesChart: null,
    currentTimeframe: 'daily',
    pendingDeleteProductId: null,

    async init() {
        // Load categories first (needed before loadProducts and auth)
        const storedCategories = localStorage.getItem('categories');
        if (storedCategories) {
            try {
                this.categories = JSON.parse(storedCategories);
                this.categories.forEach(c => { if (typeof c.visible === 'undefined') c.visible = true; });
            } catch (e) {
                console.error('❌ Error parsing categories', e);
            }
        }
        if (!this.categories.length) {
            this.categories = [
                { id: 1, name: 'Destilados THC', slug: 'destilados-thc', visible: true },
                { id: 2, name: 'Baterías para Destilados', slug: 'baterias-para-destilados', visible: true },
                { id: 3, name: 'Destilados Importados', slug: 'destilados-importados', visible: true },
                { id: 4, name: 'Destilados Nacionales', slug: 'destilados-nacionales', visible: true },
                { id: 99, name: 'Ofertas', slug: 'ofertas', visible: true }
            ];
            this.saveCategories();
        }

        // loadProducts() handles Supabase → localStorage fallback internally
        await this.loadProducts();

        this.setupStorageListeners();
        this.setupAuth();
        if (localStorage.getItem('adminLoggedIn') === 'true') {
            await this.initDashboard();
        }
    },

    async loadOrders() {
        if (window.supabaseHelpers && window.supabaseHelpers.fetchOrders) {
            try {
                this.orders = await window.supabaseHelpers.fetchOrders();
                localStorage.setItem('orders', JSON.stringify(this.orders));
                return;
            } catch (e) {
                console.error('❌ Error obteniendo pedidos desde Supabase', e);
            }
        }

        const storedOrders = localStorage.getItem('orders');
        if (storedOrders) {
            try {
                this.orders = JSON.parse(storedOrders);
                if (!Array.isArray(this.orders)) this.orders = [];
            } catch (e) {
                console.error('❌ Error leyendo pedidos locales', e);
                this.orders = [];
            }
        } else {
            this.orders = [];
        }
    },

    async loadProducts() {
        // Try Supabase first
        if (window.supabaseHelpers && window.supabaseHelpers.fetchProducts) {
            try {
                this.products = await window.supabaseHelpers.fetchProducts();
            } catch (e) {
                console.error('❌ Error obteniendo productos desde Supabase, usando respaldo local', e);
                this.products = null; // Signal to use fallback
            }
        }

        // LocalStorage fallback if Supabase failed
        if (!this.products) {
            const storedProducts = localStorage.getItem('products');
            if (storedProducts) {
                try {
                    this.products = JSON.parse(storedProducts);
                    if (!Array.isArray(this.products)) this.products = [];
                } catch (e) {
                    console.error('❌ Error leyendo productos locales', e);
                    this.products = [];
                }
            } else {
                this.products = [];
            }
        }

        // Restore isFeatured flag from persisted featuredProductId
        const persistedFeaturedId = localStorage.getItem('featuredProductId');
        if (persistedFeaturedId) {
            this.products.forEach(p => {
                p.isFeatured = String(p.id) === String(persistedFeaturedId);
            });
        }

        // Restore isVisible from persisted hiddenProducts list.
        // isVisible is NOT a Supabase column, so we keep it in a separate key
        // that survives every Supabase reload.
        const hiddenIds = JSON.parse(localStorage.getItem('hiddenProducts') || '[]');
        this.products.forEach(p => {
            p.isVisible = !hiddenIds.includes(String(p.id));
        });
        
        // Save normalized products to localStorage
        localStorage.setItem('products', JSON.stringify(this.products));
    },

    async syncOrderRemote(order) {
        if (window.supabaseHelpers && window.supabaseHelpers.upsertOrder) {
            try {
                await window.supabaseHelpers.upsertOrder(order);
            } catch (e) {
                console.error('❌ No se pudo sincronizar el pedido en Supabase', e);
            }
        }
    },

    setupAuth() {
        const loginOverlay = document.getElementById('loginOverlay');
        const adminPanel = document.getElementById('adminPanel');
        const loginForm = document.getElementById('loginForm');

        if (!loginOverlay || !adminPanel || !loginForm) {
            console.error('❌ Elementos de login no encontrados');
            return;
        }

        if (localStorage.getItem('adminLoggedIn') === 'true') {
            loginOverlay.classList.add('hidden');
            adminPanel.classList.remove('hidden');
            // Don't call initDashboard here, it's called from init()
        }

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = (document.getElementById('username').value || '').trim().toLowerCase();
            const pass = (document.getElementById('password').value || '').trim();

            if (user === 'admin' && pass === 'admin123') {
                localStorage.setItem('adminLoggedIn', 'true');
                loginOverlay.classList.add('hidden');
                adminPanel.classList.remove('hidden');
                await this.initDashboard();
            } else {
                alert('Credenciales incorrectas');
            }
        });
    },

    logout() {
        if (confirm('¿Cerrar sesión?')) {
            localStorage.removeItem('adminLoggedIn');
            location.reload();
        }
    },

    async initDashboard() {
        await this.loadOrders();
        
        this.renderDashboardStats();
        this.renderProductsTable();
        this.initChart();
        this.renderOrders();
        this.setupProductForm();
        this.setupGlobalHelpers();
    },

    renderDashboardStats() {
        // Calculate Stats
        const total = this.products.length;
        const totalValue = this.products.reduce((acc, p) => acc + (p.price * p.stock), 0);
        const lowStockItems = this.products.filter(p => p.stock < 10);

        // Update Cards
        const totalProductsEl = document.getElementById('totalProducts');
        const inventoryValueEl = document.getElementById('inventoryValue');
        const lowStockCountEl = document.getElementById('lowStockCount');
        
        if (totalProductsEl) totalProductsEl.innerText = total;
        if (inventoryValueEl) inventoryValueEl.innerText = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(totalValue);
        if (lowStockCountEl) lowStockCountEl.innerText = lowStockItems.length;

        // Render Low Stock Widget
        const lowStockList = document.getElementById('lowStockList');
        const noLowStockMsg = document.getElementById('noLowStockMsg');
        if (!lowStockList) return;
        
        lowStockList.innerHTML = '';
        if (lowStockItems.length === 0) {
            noLowStockMsg.classList.remove('hidden');
        } else {
            noLowStockMsg.classList.add('hidden');
            lowStockItems.forEach(p => {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-slate-50 border-b border-slate-100 last:border-0';
                tr.innerHTML = `
                    <td class="py-3 px-3">
                        <div class="flex items-center gap-3">
                            <img src="${p.image}" class="w-8 h-8 rounded object-cover border border-slate-200" loading="lazy" onerror="this.src='favicon.svg'">
                            <span class="text-sm font-medium text-slate-700 truncate max-w-[120px]">${p.name}</span>
                        </div>
                    </td>
                    <td class="py-3 px-3">
                        <span class="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-1 rounded-full">${p.stock} un.</span>
                    </td>
                    <td class="py-3 px-3">
                         <button onclick="Admin.quickAddStock('${p.id}')" class="text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-2 py-1 rounded border border-indigo-200 transition-colors">
                            +10
                        </button>
                    </td>
                `;
                lowStockList.appendChild(tr);
            });
        }
    },

    renderProductsTable() {
        const tbody = document.getElementById('productsTable');
        if (!tbody) return;

        if (this.products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #94a3b8;">No hay productos. Añade uno nuevo para comenzar.</td></tr>';
            return;
        }
        
        tbody.innerHTML = this.products.map(p => {
            let statusClass = 'status-ok';
            let statusText = 'En Stock';
            
            if (p.stock === 0) {
                statusClass = 'status-out';
                statusText = 'Agotado';
            } else if (p.stock < 10) {
                statusClass = 'status-low';
                statusText = 'Bajo Stock';
            }

            const isVisible = p.isVisible !== false; // default true if undefined

            return `
            <tr class="${isVisible ? '' : 'opacity-50'}">
                <td>
                    <img src="${p.image}" class="w-10 h-10 rounded-lg object-cover shadow-sm border border-slate-200">
                </td>
                <td class="font-medium text-slate-700">
                    ${p.name}
                    ${!isVisible ? '<span class="ml-1 text-xs font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">Oculto</span>' : ''}
                </td>
                <td>
                    <span class="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded-md uppercase">${p.category}</span>
                </td>
                <td class="text-slate-600 font-medium">$${p.price}</td>
                <td>
                    <span class="status-badge ${statusClass}">${statusText} (${p.stock})</span>
                </td>
                <td>
                    <div class="flex">
                        <button onclick="openProductModal('${p.id}')" class="action-btn btn-edit" title="Editar">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                                <button onclick="Admin.toggleVisible('${p.id}')" class="action-btn" title="${isVisible ? 'Ocultar producto' : 'Mostrar producto'}" style="color:${isVisible ? '#10b981' : '#94a3b8'}">
                                    <i class="fa-solid ${isVisible ? 'fa-eye' : 'fa-eye-slash'}"></i>
                                </button>
                                <button onclick="Admin.toggleFeatured('${p.id}')" class="action-btn btn-feature" title="Destacar/No destacar">
                                    <i class="${p.isFeatured ? 'fa-solid fa-star text-yellow-400' : 'fa-regular fa-star text-slate-300'}"></i>
                                </button>
                                <button onclick="deleteProduct('${p.id}')" class="action-btn btn-delete" title="Eliminar">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                    </div>
                </td>
            </tr>
            `;
        }).join('');
    },

            toggleFeatured(id) {
                const p = this.products.find(x => String(x.id) === String(id));
                if (!p) return;
                // Toggle
                const newVal = !p.isFeatured;
                // If setting to true, unset others
                if (newVal) {
                    this.products.forEach(prod => { if (String(prod.id) !== String(id)) prod.isFeatured = false; });
                }
                p.isFeatured = newVal;
                this.saveData(p.id);
                this.renderAll();
            },

            toggleVisible(id) {
                const p = this.products.find(x => String(x.id) === String(id));
                if (!p) return;
                // Toggle: hidden → visible, visible → hidden
                p.isVisible = p.isVisible === false ? true : false;
                // Persist hidden IDs in a dedicated key so the value survives Supabase reloads
                // (isVisible is not stored in the Supabase Products table)
                let hiddenIds = JSON.parse(localStorage.getItem('hiddenProducts') || '[]');
                if (!p.isVisible) {
                    if (!hiddenIds.includes(String(id))) hiddenIds.push(String(id));
                } else {
                    hiddenIds = hiddenIds.filter(x => x !== String(id));
                }
                localStorage.setItem('hiddenProducts', JSON.stringify(hiddenIds));
                this.saveData(p.id);
                this.renderAll();
            },

    initChart() {
        const canvas = document.getElementById('salesChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // Destroy existing chart if any
        if (this.salesChart) {
            this.salesChart.destroy();
        }
        
        // Initial Draw
        this.salesChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Ventas',
                    data: [],
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#6366f1',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { borderDash: [5, 5] },
                        ticks: {
                            callback: function(value) {
                                return new Intl.NumberFormat('es-CO', { notation: "compact", compactDisplay: "short", currency: 'COP', style: 'currency' }).format(value);
                            }
                        }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
        
        // Load default view (Daily per user request)
        const dailyBtn = document.querySelector('#chartTimeframeBtns button[data-timeframe="daily"]');
        this.updateChart('daily', dailyBtn);
    },

    // CRUD & Helpers
    setupProductForm() {
        const form = document.getElementById('addProductForm');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProduct();
        });

        // Offer Toggle Logic
        const offerCheck = document.getElementById('pIsOffer');
        const discountContainer = document.getElementById('discountContainer');
        if(offerCheck) {
            offerCheck.addEventListener('change', (e) => {
                if(e.target.checked) {
                    discountContainer.classList.remove('hidden');
                } else {
                    discountContainer.classList.add('hidden');
                }
            });
        }

        // Visible Toggle Badge
        const visibleCheck = document.getElementById('pIsVisible');
        const visibleBadge = document.getElementById('pIsVisibleBadge');
        if (visibleCheck && visibleBadge) {
            visibleCheck.addEventListener('change', (e) => {
                if (e.target.checked) {
                    visibleBadge.textContent = 'Visible';
                    visibleBadge.className = 'text-xs font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700';
                } else {
                    visibleBadge.textContent = 'Oculto';
                    visibleBadge.className = 'text-xs font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-500';
                }
            });
        }
    },

    // Category Management
    renderCategories() {
        const tbody = document.getElementById('categoriesList');
        if (!tbody) return;

        tbody.innerHTML = this.categories.map(c => `
            <tr>
                <td class="font-medium text-slate-700">#${c.id}</td>
                <td>${c.name}</td>
                <td class="text-center">
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" onchange="Admin.toggleCategory(${c.id})" class="sr-only peer" ${c.visible ? 'checked' : ''}>
                        <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                </td>
                <td class="text-right">
                    ${c.slug !== 'ofertas' ? `
                    <button onclick="Admin.deleteCategory(${c.id})" class="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded transition-colors">
                        <i class="fa-solid fa-trash"></i>
                    </button>` : '<span class="text-xs text-slate-400 italic">Sistema</span>'}
                </td>
            </tr>
        `).join('');
    },

    toggleCategory(id) {
        const cat = this.categories.find(c => c.id === id);
        if(cat) {
            cat.visible = !cat.visible;
            this.saveCategories();
        }
    },

    addCategory(e) {
        e.preventDefault();
        const nameInput = document.getElementById('catName');
        const name = nameInput.value.trim();
        
        if (!name) return;

        // Simple slugify
        const slug = name.toLowerCase()
            .replace(/[^\w\s-]/g, '') // remove non-word chars
            .replace(/[\s_-]+/g, '-') // collapse whitespace
            .replace(/^-+|-+$/g, ''); // trim

        const newCat = {
            id: Date.now(),
            name: name,
            slug: slug,
            visible: true
        };

        this.categories.push(newCat);
        this.saveCategories();
        this.renderCategories();
        
        nameInput.value = '';
        alert('Categoría agregada correctamente');
    },

    deleteCategory(id) {
        if (!confirm('¿Eliminar categoría? Los productos asociados podrían quedar sin categoría.')) return;
        this.categories = this.categories.filter(c => c.id !== id);
        this.saveCategories();
        this.renderCategories();
    },

    saveCategories() {
        localStorage.setItem('categories', JSON.stringify(this.categories));
    },

    saveOrders(silent = false) {
        localStorage.setItem('orders', JSON.stringify(this.orders));
        if (!silent && this.salesChart) {
            this.updateChart(this.currentTimeframe || 'daily');
        }
    },

    setupStorageListeners() {
        window.addEventListener('storage', (event) => {
            if (event.key === 'orders') {
                try {
                    this.orders = event.newValue ? JSON.parse(event.newValue) : [];
                    this.renderOrders();
                    if (this.salesChart) {
                        this.updateChart(this.currentTimeframe || 'daily');
                    }
                } catch (e) {
                    console.error('Error sincronizando pedidos', e);
                }
            }
            
            // Sync products and featured state from other tabs
            if (event.key === 'products' || event.key === 'featuredProductId') {
                try {
                    const storedProducts = localStorage.getItem('products');
                    if (storedProducts) {
                        this.products = JSON.parse(storedProducts);
                    }
                    // Restore isFeatured from featuredProductId
                    const fid = localStorage.getItem('featuredProductId');
                    if (fid) {
                        this.products.forEach(p => {
                            p.isFeatured = String(p.id) === String(fid);
                        });
                    }
                    this.renderAll();
                } catch (e) {
                    console.error('Error sincronizando productos', e);
                }
            }
        });
    },

    // Order Management
    renderOrders() {
        const tbody = document.getElementById('ordersTableBody');
        const emptyMsg = document.getElementById('noOrdersMsg');
        if (!tbody) return;

        // Validate data format
        this.orders = Array.isArray(this.orders) ? this.orders : [];
        this.orders = this.orders.filter(o => Array.isArray(o.items));

        // Sort by last activity (paidAt/cancelledAt/date)
        const sortedOrders = [...this.orders].sort((a,b) => {
            const dateB = new Date(b.paidAt || b.cancelledAt || b.date);
            const dateA = new Date(a.paidAt || a.cancelledAt || a.date);
            return dateB - dateA;
        });

        if (sortedOrders.length === 0) {
            tbody.innerHTML = '';
            if (emptyMsg) emptyMsg.classList.remove('hidden');
            return;
        }
        if (emptyMsg) emptyMsg.classList.add('hidden');

        tbody.innerHTML = sortedOrders.map(o => {
            let statusBadge = '';
            let actions = '';

            if (o.status === 'pending_whatsapp') {
                statusBadge = '<span class="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-bold border border-yellow-200 inline-flex items-center gap-1"><i class="fa-brands fa-whatsapp"></i>Pendiente WhatsApp</span>';
                actions = `
                    <button onclick="Admin.updateOrderStatus('${o.id}', 'paid')" class="bg-emerald-100 text-emerald-600 hover:bg-emerald-200 p-2 rounded mr-1 transition-colors" title="Marcar como Pagado">
                        <i class="fa-solid fa-check"></i>
                    </button>
                    <button onclick="Admin.updateOrderStatus('${o.id}', 'cancelled')" class="bg-red-100 text-red-600 hover:bg-red-200 p-2 rounded transition-colors" title="Cancelar Pedido">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                `;
            } else if (o.status === 'paid') {
                statusBadge = '<span class="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-bold border border-emerald-200 inline-flex items-center gap-1"><i class="fa-solid fa-circle-check"></i>Pagado</span>';
                actions = '<span class="text-xs text-slate-400">Completado</span>';
            } else if (o.status === 'cancelled') {
                statusBadge = '<span class="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold border border-red-200 inline-flex items-center gap-1"><i class="fa-solid fa-ban"></i>Cancelado</span>';
                actions = '<span class="text-xs text-slate-400">Archivado</span>';
            }

            const displayDate = new Date(o.paidAt || o.date);
            const dateStr = displayDate.toLocaleString('es-CO');
            
            // Validate items is an array
            let itemsSummary = '';
            if (Array.isArray(o.items) && o.items.length > 0) {
                itemsSummary = o.items.map(i => `<div class="text-xs text-slate-600">${i.name} <b>x${i.quantity}</b></div>`).join('');
            } else {
                console.warn('⚠️ Pedido sin items válidos:', o.id);
                itemsSummary = '<div class="text-xs text-slate-400 italic">Sin detalles de items</div>';
            }
            
            const price = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(o.total);

            return `
                <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0" data-order-id="${o.id}">
                    <td class="py-3 px-4 font-mono text-xs text-slate-500">#${o.id.toString().slice(-6)}</td>
                    <td class="py-3 px-4 text-xs text-slate-600">${dateStr}</td>
                    <td class="py-3 px-4">${itemsSummary}</td>
                    <td class="py-3 px-4 font-bold text-slate-700">${price}</td>
                    <td class="py-3 px-4 text-center">${statusBadge}</td>
                    <td class="py-3 px-4 text-center">${actions}</td>
                </tr>
            `;
        }).join('');
    },

    async updateOrderStatus(orderId, newStatus) {
        // Reload orders from localStorage to avoid stale state
        const storedOrders = localStorage.getItem('orders');
        if (storedOrders) {
            try {
                this.orders = JSON.parse(storedOrders);
            } catch (e) {
                console.error('❌ Error reloading orders', e);
                alert('Error al cargar pedidos');
                return;
            }
        }

        const orderIndex = this.orders.findIndex(o => String(o.id) === String(orderId));
        if (orderIndex === -1) {
            alert('Error: Pedido no encontrado');
            return;
        }

        const order = this.orders[orderIndex];

        if (!Array.isArray(order.items) || order.items.length === 0) {
            alert('Error: El pedido no tiene items válidos');
            return;
        }

        if (newStatus === 'paid' && order.status !== 'paid') {
            // Deduct Stock
            let stockError = false;
            let errorMessage = '';

            order.items.forEach(item => {
                const product = this.products.find(p => String(p.id) === String(item.id));
                if (!product) {
                    stockError = true;
                    errorMessage = `Producto "${item.name}" no encontrado en inventario`;
                } else if (product.stock < item.quantity) {
                    stockError = true;
                    errorMessage = `No hay suficiente stock para "${item.name}". Disponible: ${product.stock}, Requerido: ${item.quantity}`;
                }
            });

            if (stockError) {
                alert('Error de inventario: ' + errorMessage);
                return;
            }

            order.items.forEach(item => {
                const product = this.products.find(p => String(p.id) === String(item.id));
                if (product) product.stock -= item.quantity;
            });

            order.status = 'paid';
            order.paidAt = new Date().toISOString();
            this.saveData();

        } else if (newStatus === 'cancelled') {
            order.status = 'cancelled';
            order.cancelledAt = new Date().toISOString();
        }

        this.orders[orderIndex] = order;
        this.saveOrders();
        await this.syncOrderRemote(order);

        this.renderOrders();
        this.renderDashboardStats();

        const statusText = newStatus === 'paid' ? 'PAGADO' : 'CANCELADO';
        alert(`Pedido #${orderId.toString().slice(-6)} marcado como ${statusText}`);
    },

    // Analytics
    updateChart(timeframe, btnElement) {
        this.currentTimeframe = timeframe;
        if (!this.salesChart) return;

        const buttons = document.querySelectorAll('#chartTimeframeBtns button');
        if (buttons.length) {
            buttons.forEach(btn => {
                btn.classList.remove('bg-indigo-600', 'text-white');
                btn.classList.add('bg-white', 'text-slate-600', 'hover:bg-slate-50');
            });

            if (!btnElement) {
                btnElement = document.querySelector(`#chartTimeframeBtns button[data-timeframe="${timeframe}"]`);
            }

            if (btnElement) {
                btnElement.classList.remove('bg-white', 'text-slate-600', 'hover:bg-slate-50');
                btnElement.classList.add('bg-indigo-600', 'text-white');
            }
        }

        let labels = [];
        let dataMap = [];
        let label = '';
        const now = new Date();
        const paidOrders = this.orders.filter(order => order.status === 'paid');

        switch(timeframe) {
            case 'daily':
                // Shows paid orders grouped by 4-hour blocks of the current day
                label = 'Ventas de Hoy';
                const slots = [
                    { label: '00-04', start: 0, end: 4 },
                    { label: '04-08', start: 4, end: 8 },
                    { label: '08-12', start: 8, end: 12 },
                    { label: '12-16', start: 12, end: 16 },
                    { label: '16-20', start: 16, end: 20 },
                    { label: '20-24', start: 20, end: 24 }
                ];

                labels = slots.map(slot => slot.label);
                dataMap = slots.map(slot => {
                    return paidOrders.reduce((acc, order) => {
                        const d = new Date(order.paidAt || order.date);
                        if (d.toDateString() !== now.toDateString()) return acc;
                        const hour = d.getHours();
                        if (hour >= slot.start && hour < slot.end) {
                            return acc + order.total;
                        }
                        return acc;
                    }, 0);
                });
                break;

            case 'weekly':
                label = 'Ventas Últimos 7 Días';
                labels = [];
                dataMap = [];
                for (let i = 6; i >= 0; i--) {
                    const d = new Date(now);
                    d.setDate(d.getDate() - i);
                    const dayName = d.toLocaleDateString('es-ES', { weekday: 'short' });
                    labels.push(dayName);
                    
                    const dayTotal = paidOrders.reduce((acc, order) => {
                        const od = new Date(order.paidAt || order.date);
                        return od.toDateString() === d.toDateString() ? acc + order.total : acc;
                    }, 0);
                    dataMap.push(dayTotal);
                }
                break;

            case 'monthly':
                label = 'Ventas del Mes (Semanas)';
                labels = ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'];
                dataMap = [0, 0, 0, 0];
                const currentMonth = now.getMonth();
                const currentYear = now.getFullYear();
                
                paidOrders.forEach(order => {
                    const d = new Date(order.paidAt || order.date);
                    if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                        const day = d.getDate(); // 1-31
                        const week = Math.min(Math.floor((day - 1) / 7), 3); // 0-3
                        dataMap[week] += order.total;
                    }
                });
                break;

            case 'yearly':
                label = 'Ventas del Año';
                labels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                dataMap = new Array(12).fill(0);
                
                paidOrders.forEach(order => {
                    const d = new Date(order.paidAt || order.date);
                    if (d.getFullYear() === now.getFullYear()) {
                        dataMap[d.getMonth()] += order.total;
                    }
                });
                break;
        }

        if (this.salesChart) {
            this.salesChart.data.labels = labels;
            this.salesChart.data.datasets[0].label = label;
            this.salesChart.data.datasets[0].data = dataMap;
            this.salesChart.update();
        }
    },

    setupGlobalHelpers() {
    // Global functions for HTML access
        const self = this;
        
        window.clearAllOrders = function() {
            const modal = document.getElementById('confirmDeleteModal');
            if (modal) {
                modal.classList.remove('hidden');
                document.body.classList.add('modal-open');
            }
        };
        
        window.executeDeleteAllOrders = function() {
            const modal = document.getElementById('confirmDeleteModal');
            if (modal) {
                modal.classList.add('hidden');
                document.body.classList.remove('modal-open');
            }
            
            localStorage.removeItem('orders');
            self.orders = [];
            if (window.supabaseHelpers && window.supabaseHelpers.deleteAllOrders) {
                window.supabaseHelpers.deleteAllOrders().catch(err => console.error('❌ Error borrando pedidos en Supabase', err));
            }
            self.renderOrders();
            if (self.salesChart) {
                self.updateChart(self.currentTimeframe || 'daily');
            }
            alert('Todos los pedidos han sido eliminados correctamente');
        };
        
        window.openProductModal = (id = null) => {
            const modal = document.getElementById('modalOverlay');
            const title = document.getElementById('modalTitle');
            const formObj = document.getElementById('addProductForm');

            // Populate Categories dynamically
            const catSelect = document.getElementById('pCategory');
            if (catSelect && this.categories) {
                catSelect.innerHTML = this.categories.map(c => 
                    `<option value="${c.slug}">${c.name}</option>`
                ).join('');
                
                // Add fallback option if empty?
                if (this.categories.length === 0) {
                     catSelect.innerHTML = '<option value="general">General</option>';
                }
            }
            
            modal.classList.remove('hidden');
            formObj.reset();
            
            // Reset offer ui
            document.getElementById('discountContainer').classList.add('hidden');

            if (id) {
                const p = this.products.find(x => String(x.id) === String(id));
                if (p) {
                    title.innerText = 'Editar Producto';
                    document.getElementById('productId').value = p.id;
                    document.getElementById('pName').value = p.name;
                    document.getElementById('pDesc').value = p.description || '';
                    document.getElementById('pPrice').value = p.price;
                    document.getElementById('pStock').value = p.stock;
                    document.getElementById('pCategory').value = p.category;
                    
                    // Handle multiple images
                    const gallery = p.gallery || [p.image];
                    document.getElementById('pImage1').value = gallery[0] || p.image || '';
                    document.getElementById('pImage2').value = gallery[1] || '';
                    document.getElementById('pImage3').value = gallery[2] || '';
                    document.getElementById('pImage4').value = gallery[3] || '';
                    
                    // Offer fields
                    const isOffer = p.isOffer || false;
                    document.getElementById('pIsOffer').checked = isOffer;
                    if(isOffer) {
                        document.getElementById('discountContainer').classList.remove('hidden');
                        document.getElementById('pDiscount').value = p.discountPercent || 0;
                    }
                    // Featured
                    const isFeatured = p.isFeatured || false;
                    const featuredEl = document.getElementById('pIsFeatured');
                    if (featuredEl) featuredEl.checked = isFeatured;
                    // Visible
                    const isVisible = p.isVisible !== false;
                    const visibleEl = document.getElementById('pIsVisible');
                    const visibleBadge = document.getElementById('pIsVisibleBadge');
                    if (visibleEl) visibleEl.checked = isVisible;
                    if (visibleBadge) {
                        visibleBadge.textContent = isVisible ? 'Visible' : 'Oculto';
                        visibleBadge.className = isVisible
                            ? 'text-xs font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700'
                            : 'text-xs font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-500';
                    }
                }
            } else {
                title.innerText = 'Nuevo Producto';
                document.getElementById('productId').value = '';
                // Reset visibility badge to default (visible) for new products
                const newBadge = document.getElementById('pIsVisibleBadge');
                if (newBadge) {
                    newBadge.textContent = 'Visible';
                    newBadge.className = 'text-xs font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700';
                }
            }
        };

        window.closeProductModal = () => {
            document.getElementById('modalOverlay').classList.add('hidden');
        };

        window.deleteProduct = (id) => {
            const modal = document.getElementById('productDeleteModal');
            const nameEl = document.getElementById('productDeleteName');
            const prod = this.products.find(p => String(p.id) === String(id));
            this.pendingDeleteProductId = id;
            if (nameEl && prod) nameEl.textContent = prod.name;
            if (modal) {
                modal.classList.remove('hidden');
                document.body.classList.add('modal-open');
            }
        };

        window.cancelDeleteProduct = () => {
            const modal = document.getElementById('productDeleteModal');
            this.pendingDeleteProductId = null;
            if (modal) {
                modal.classList.add('hidden');
                document.body.classList.remove('modal-open');
            }
        };

        window.confirmDeleteProduct = () => {
            const id = this.pendingDeleteProductId;
            if (!id) { window.cancelDeleteProduct(); return; }
            this.products = this.products.filter(p => String(p.id) !== String(id));
            this.saveData();
            if (window.supabaseHelpers && window.supabaseHelpers.deleteProduct) {
                window.supabaseHelpers.deleteProduct(id).catch(err => console.error('❌ Error eliminando producto en Supabase', err));
            }
            this.renderAll();
            document.body.classList.remove('modal-open');
            window.cancelDeleteProduct();
        };

        window.exportToCSV = () => {
            if (this.products.length === 0) {
                alert("No hay datos para exportar");
                return;
            }

            // BOM for Excel UTF-8 compatibility
            let csvContent = "\uFEFF";
            
            // Professional Header with metadata
            csvContent += "LUXURY DESTILADOS - REPORTE DE INVENTARIO\n";
            csvContent += `Fecha de generación:,${new Date().toLocaleString('es-CO')}\n`;
            csvContent += `Total productos:,${this.products.length}\n`;
            csvContent += `Valor total inventario:,${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(this.products.reduce((acc, p) => acc + (p.price * p.stock), 0))}\n`;
            csvContent += "\n";
            
            // CSV Column Headers
            csvContent += "ID,Nombre,Descripción,Categoría,Precio Unitario,Stock,Valor Stock,Estado,Es Oferta,% Descuento,Precio Final,Destacado,Imagen Principal,Galería\n";

            // CSV Rows with full data
            this.products.forEach(p => {
                const stockValue = p.price * p.stock;
                const status = p.stock === 0 ? 'Agotado' : p.stock < 10 ? 'Bajo Stock' : 'Disponible';
                const finalPrice = p.isOffer && p.discountPercent ? Math.round(p.price * (1 - p.discountPercent / 100)) : p.price;
                const galleryUrls = (p.gallery || []).join(' | ');
                
                const row = [
                    p.id,
                    `"${(p.name || '').replace(/"/g, '""')}"`,
                    `"${(p.description || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
                    p.category || '',
                    p.price,
                    p.stock,
                    stockValue,
                    status,
                    p.isOffer ? 'Sí' : 'No',
                    p.discountPercent || 0,
                    finalPrice,
                    p.isFeatured ? 'Sí' : 'No',
                    p.image || '',
                    `"${galleryUrls}"`
                ].join(",");
                csvContent += row + "\n";
            });
            
            // Summary section
            csvContent += "\n";
            csvContent += "RESUMEN POR CATEGORÍA\n";
            csvContent += "Categoría,Productos,Valor\n";
            const byCategory = {};
            this.products.forEach(p => {
                if (!byCategory[p.category]) byCategory[p.category] = { count: 0, value: 0 };
                byCategory[p.category].count++;
                byCategory[p.category].value += p.price * p.stock;
            });
            Object.entries(byCategory).forEach(([cat, data]) => {
                csvContent += `${cat},${data.count},${data.value}\n`;
            });

            // Download as Blob for proper encoding
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `luxury_destilados_inventario_${new Date().toISOString().slice(0,10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        };
        
        window.exportToPDF = () => {
            if (this.products.length === 0) {
                alert("No hay productos para exportar");
                return;
            }
            
            // Create print-optimized HTML
            const totalValue = this.products.reduce((acc, p) => acc + (p.price * p.stock), 0);
            const dateStr = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
            
            const productRows = this.products.map(p => {
                const status = p.stock === 0 ? '🔴 Agotado' : p.stock < 10 ? '🟡 Bajo' : '🟢 OK';
                const finalPrice = p.isOffer && p.discountPercent ? Math.round(p.price * (1 - p.discountPercent / 100)) : p.price;
                const priceDisplay = p.isOffer ? `<s style="color:#999;">$${p.price.toLocaleString('es-CO')}</s> <strong style="color:#dc2626;">$${finalPrice.toLocaleString('es-CO')}</strong>` : `$${p.price.toLocaleString('es-CO')}`;
                
                return `
                    <tr>
                        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">
                            <img src="${p.image || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22%3E%3Crect fill=%22%23f1f5f9%22 width=%22100%25%22 height=%22100%25%22/%3E%3C/svg%3E'}" 
                                 style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; border: 1px solid #e2e8f0;" 
                                 onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22%3E%3Crect fill=%22%23f1f5f9%22 width=%22100%25%22 height=%22100%25%22/%3E%3C/svg%3E'">
                        </td>
                        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">
                            <strong style="color: #1e293b; font-size: 14px;">${p.name}</strong>
                            ${p.isFeatured ? '<span style="background: #fbbf24; color: #78350f; font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-left: 8px;">⭐ DESTACADO</span>' : ''}
                            ${p.isOffer ? '<span style="background: #dc2626; color: white; font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-left: 4px;">-' + p.discountPercent + '%</span>' : ''}
                            <br><span style="color: #64748b; font-size: 12px;">${(p.description || '').substring(0, 80)}${(p.description || '').length > 80 ? '...' : ''}</span>
                        </td>
                        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">
                            <span style="background: #f1f5f9; color: #475569; font-size: 11px; padding: 4px 8px; border-radius: 4px; text-transform: uppercase;">${p.category}</span>
                        </td>
                        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 14px;">
                            ${priceDisplay}
                        </td>
                        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">
                            <span style="font-weight: 600;">${p.stock}</span>
                            <br><span style="font-size: 11px;">${status}</span>
                        </td>
                        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: #059669;">
                            $${(p.price * p.stock).toLocaleString('es-CO')}
                        </td>
                    </tr>
                `;
            }).join('');
            
            // Category summary
            const byCategory = {};
            this.products.forEach(p => {
                if (!byCategory[p.category]) byCategory[p.category] = { count: 0, value: 0 };
                byCategory[p.category].count++;
                byCategory[p.category].value += p.price * p.stock;
            });
            const categorySummary = Object.entries(byCategory).map(([cat, data]) => `
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9;">
                    <span style="text-transform: capitalize;">${cat}</span>
                    <span><strong>${data.count}</strong> productos · <strong>$${data.value.toLocaleString('es-CO')}</strong></span>
                </div>
            `).join('');
            
            const lowStockItems = this.products.filter(p => p.stock < 10 && p.stock > 0);
            const outOfStock = this.products.filter(p => p.stock === 0);
            
            const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Catálogo Luxury Destilados - ${dateStr}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Inter', -apple-system, sans-serif; color: #1e293b; line-height: 1.5; }
                    @media print {
                        body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                        .no-print { display: none !important; }
                        @page { margin: 1cm; size: A4 landscape; }
                    }
                </style>
            </head>
            <body style="padding: 20px;">
                <!-- Header -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #6366f1;">
                    <div>
                        <h1 style="font-size: 28px; font-weight: 700; color: #1e293b;">🥃 LUXURY DESTILADOS</h1>
                        <p style="color: #64748b; font-size: 14px;">Catálogo de Inventario</p>
                    </div>
                    <div style="text-align: right;">
                        <p style="font-size: 13px; color: #64748b;">Generado el</p>
                        <p style="font-size: 16px; font-weight: 600;">${dateStr}</p>
                    </div>
                </div>
                
                <!-- Stats Cards -->
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 30px;">
                    <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 20px; border-radius: 12px;">
                        <p style="font-size: 12px; opacity: 0.9;">TOTAL PRODUCTOS</p>
                        <p style="font-size: 32px; font-weight: 700;">${this.products.length}</p>
                    </div>
                    <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: white; padding: 20px; border-radius: 12px;">
                        <p style="font-size: 12px; opacity: 0.9;">VALOR INVENTARIO</p>
                        <p style="font-size: 24px; font-weight: 700;">$${totalValue.toLocaleString('es-CO')}</p>
                    </div>
                    <div style="background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%); color: #78350f; padding: 20px; border-radius: 12px;">
                        <p style="font-size: 12px; opacity: 0.8;">BAJO STOCK</p>
                        <p style="font-size: 32px; font-weight: 700;">${lowStockItems.length}</p>
                    </div>
                    <div style="background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); color: white; padding: 20px; border-radius: 12px;">
                        <p style="font-size: 12px; opacity: 0.9;">AGOTADOS</p>
                        <p style="font-size: 32px; font-weight: 700;">${outOfStock.length}</p>
                    </div>
                </div>
                
                <!-- Products Table -->
                <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <thead>
                        <tr style="background: #f8fafc;">
                            <th style="padding: 14px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Imagen</th>
                            <th style="padding: 14px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Producto</th>
                            <th style="padding: 14px 12px; text-align: center; font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Categoría</th>
                            <th style="padding: 14px 12px; text-align: right; font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Precio</th>
                            <th style="padding: 14px 12px; text-align: center; font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Stock</th>
                            <th style="padding: 14px 12px; text-align: right; font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Valor</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${productRows}
                    </tbody>
                    <tfoot>
                        <tr style="background: #f8fafc;">
                            <td colspan="5" style="padding: 14px 12px; text-align: right; font-weight: 600; font-size: 14px;">VALOR TOTAL DEL INVENTARIO:</td>
                            <td style="padding: 14px 12px; text-align: right; font-weight: 700; font-size: 18px; color: #059669;">$${totalValue.toLocaleString('es-CO')}</td>
                        </tr>
                    </tfoot>
                </table>
                
                <!-- Category Summary -->
                <div style="margin-top: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div style="background: #f8fafc; padding: 20px; border-radius: 12px;">
                        <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 12px; color: #475569;">📊 Resumen por Categoría</h3>
                        ${categorySummary}
                    </div>
                    ${lowStockItems.length > 0 ? `
                    <div style="background: #fef3c7; padding: 20px; border-radius: 12px;">
                        <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 12px; color: #92400e;">⚠️ Productos con Bajo Stock</h3>
                        ${lowStockItems.map(p => `<div style="padding: 6px 0; border-bottom: 1px solid #fcd34d;"><strong>${p.name}</strong> - Solo ${p.stock} unidades</div>`).join('')}
                    </div>
                    ` : `
                    <div style="background: #d1fae5; padding: 20px; border-radius: 12px;">
                        <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 12px; color: #065f46;">✅ Estado del Inventario</h3>
                        <p style="color: #047857;">Todos los productos tienen stock suficiente.</p>
                    </div>
                    `}
                </div>
                
                <!-- Footer -->
                <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 12px;">
                    <p>Luxury Destilados © ${new Date().getFullYear()} · Documento generado automáticamente</p>
                    <p style="margin-top: 4px;">Este catálogo es para uso interno y control de inventario</p>
                </div>
                
                <!-- Print Button (hidden on print) -->
                <div class="no-print" style="position: fixed; bottom: 20px; right: 20px; display: flex; gap: 10px;">
                    <button onclick="window.print()" style="background: #6366f1; color: white; border: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 14px; box-shadow: 0 4px 12px rgba(99,102,241,0.4);">
                        🖨️ Imprimir / Guardar PDF
                    </button>
                    <button onclick="window.close()" style="background: #64748b; color: white; border: none; padding: 14px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 14px;">
                        ✕ Cerrar
                    </button>
                </div>
            </body>
            </html>
            `;
            
            // Open in new window for print
            const printWindow = window.open('', '_blank', 'width=1200,height=800');
            printWindow.document.write(html);
            printWindow.document.close();
        };
    },

    quickAddStock(id) {
        const p = this.products.find(x => String(x.id) === String(id));
        if (p) {
            p.stock += 10;
            this.saveData(p.id);
            this.renderAll();
        }
    },

    async saveProduct() {
        try {
            const id = String(document.getElementById('productId').value || '');
            const isOffer = document.getElementById('pIsOffer').checked;

            // Collect all image URLs and filter out empty ones
            const img1 = document.getElementById('pImage1');
            const img2 = document.getElementById('pImage2');
            const img3 = document.getElementById('pImage3');
            const img4 = document.getElementById('pImage4');

            if (!img1 || !img2 || !img3 || !img4) {
                console.error('❌ Image input fields not found');
                alert('Error: No se encontraron los campos de imagen');
                return;
            }

            const images = [
                img1.value.trim(),
                img2.value.trim(),
                img3.value.trim(),
                img4.value.trim()
            ].filter(url => url !== '');
            
            // Ensure at least one image (use placeholder if none provided)
            const gallery = images.length > 0 ? images : ['https://via.placeholder.com/400'];
            const mainImage = gallery[0];

            const newProd = {
                id: id ? id : String(Date.now()),
                name: document.getElementById('pName').value,
                description: document.getElementById('pDesc').value,
                price: parseFloat(document.getElementById('pPrice').value),
                category: document.getElementById('pCategory').value,
                stock: parseInt(document.getElementById('pStock').value),
                image: mainImage,
                gallery: gallery,
                isFeatured: document.getElementById('pIsFeatured') ? document.getElementById('pIsFeatured').checked : false,
                isVisible: document.getElementById('pIsVisible') ? document.getElementById('pIsVisible').checked : true,
                isOffer: isOffer,
                discountPercent: isOffer ? parseInt(document.getElementById('pDiscount').value || 0) : 0
            };
            // If marking this product as featured, unset featured on others
            if (newProd.isFeatured) {
                this.products.forEach(prod => { if (String(prod.id) !== String(newProd.id)) prod.isFeatured = false; });
            }

            if (id) {
                const index = this.products.findIndex(p => String(p.id) === String(id));
                if (index !== -1) this.products[index] = newProd;
            } else {
                this.products.push(newProd);
            }

            // Save to localStorage only (Supabase sync handled below with proper await + feedback)
            this.saveData(newProd.id, true);
            window.closeProductModal();
            this.renderAll();

            // Sync ONLY the changed product to Supabase and notify result
            if (window.supabaseHelpers && window.supabaseHelpers.upsertProduct) {
                try {
                    await window.supabaseHelpers.upsertProduct(newProd);
                    console.log('✅ Producto sincronizado con Supabase:', newProd.id);
                } catch (syncErr) {
                    console.error('❌ Error al sincronizar con Supabase:', syncErr);
                    alert('⚠️ El producto se guardó localmente pero no pudo sincronizarse con Supabase.\nError: ' + (syncErr.message || syncErr));
                }
            }
        } catch (error) {
            console.error('❌ Error saving product:', error);
            alert('Error al guardar producto: ' + error.message);
        }
    },

    saveData(productIdToSync = null, skipSupabaseSync = false) {
        localStorage.setItem('products', JSON.stringify(this.products));
        
        // Persist featuredProductId separately for cross-tab and reload persistence
        const featuredProduct = this.products.find(p => p.isFeatured);
        if (featuredProduct) {
            localStorage.setItem('featuredProductId', String(featuredProduct.id));
        } else {
            localStorage.removeItem('featuredProductId');
        }
        
        // Sync to Supabase — only upsert the specific product that changed (or all if no ID given)
        // skipSupabaseSync=true when the caller handles the upsert itself (e.g. saveProduct with await)
        if (!skipSupabaseSync && window.supabaseHelpers && window.supabaseHelpers.upsertProduct) {
            const toSync = productIdToSync
                ? this.products.filter(p => String(p.id) === String(productIdToSync))
                : this.products;
            toSync.forEach(p => {
                window.supabaseHelpers.upsertProduct(p).catch(err => console.error('❌ Error sincronizando producto', p.id, err));
            });
        }
        
        // Trigger frontend featured refresh if page open
        if (window.ProductManager && typeof window.ProductManager.renderFeatured === 'function') {
            try { window.ProductManager.renderFeatured(); } catch(e) { /* ignore */ }
        }
    },

    renderAll() {
        this.renderDashboardStats();
        this.renderProductsTable();
        // If Intelligence tab is active, we might want to refresh it too, but for now it's on-demand
    },

    renderIntelligence() {
        // 1. Prepare Data for Chart (Value per Category)
        const categories = {};
        this.products.forEach(p => {
            if (!categories[p.category]) categories[p.category] = 0;
            categories[p.category] += (p.price * p.stock);
        });

        const labels = Object.keys(categories).map(c => c.charAt(0).toUpperCase() + c.slice(1));
        const data = Object.values(categories);

        // Render Chart
        const ctx = document.getElementById('categoryChart');
        if (ctx) {
            // Destroy existing if any
            if (this.intChart) {
                this.intChart.destroy();
            }
            
            this.intChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: [
                            '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'
                        ],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'right' }
                    }
                }
            });
        }

        // 2. Generate Insights
        const insightsList = document.getElementById('aiInsightsList');
        if (insightsList) {
            insightsList.innerHTML = '';
            
            // Logic for insights
            const totalValue = this.products.reduce((acc, p) => acc + (p.price * p.stock), 0);
            const mostExpensive = this.products.reduce((prev, current) => (prev.price > current.price) ? prev : current, this.products[0] || {});
            
            const insights = [
                {
                    icon: 'fa-arrow-trend-up',
                    color: 'text-emerald-500',
                    bg: 'bg-emerald-50',
                    title: 'Oportunidad de Crecimiento',
                    desc: `La categoría <b>${labels[0] || 'General'}</b> representa el mayor volumen de valor. Considera expandir el catálogo aquí.`
                },
                {
                    icon: 'fa-triangle-exclamation',
                    color: 'text-orange-500',
                    bg: 'bg-orange-50',
                    title: 'Optimización de Stock',
                    desc: `Tienes <b>${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(totalValue)}</b> inmovilizados en inventario. Revisa productos con baja rotación.`
                },
                {
                    icon: 'fa-gem',
                    color: 'text-purple-500',
                    bg: 'bg-purple-50',
                    title: 'Producto Premium',
                    desc: `Tu producto de mayor valor es <b>${mostExpensive.name}</b>. Asegúrate de destacarlo en la landing page.`
                }
            ];

            insights.forEach(item => {
                const div = document.createElement('div');
                div.className = 'flex items-start gap-4 p-4 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100';
                div.innerHTML = `
                    <div class="w-10 h-10 rounded-full ${item.bg} flex items-center justify-center flex-shrink-0">
                        <i class="fa-solid ${item.icon} ${item.color}"></i>
                    </div>
                    <div>
                        <h4 class="font-bold text-slate-700 text-sm">${item.title}</h4>
                        <p class="text-xs text-slate-500 mt-1 leading-relaxed">${item.desc}</p>
                    </div>
                `;
                insightsList.appendChild(div);
            });
        }

        // 3. Update Text Metrics
        const healthScoreEl = document.getElementById('healthScore');
        if(healthScoreEl) {
             // Fake calculation: more products = better health (up to 100)
             const score = Math.min(Math.round(this.products.length * 1.5 + 50), 98);
             healthScoreEl.innerText = score + '%';
        }
    }
};

// Start
document.addEventListener('DOMContentLoaded', () => {
    Admin.init();
    // Expose Admin for inline HTML calls (like quickAddStock)
    window.Admin = Admin;
    window.logout = () => Admin.logout();
});
