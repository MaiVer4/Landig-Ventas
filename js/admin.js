const Admin = {
    products: [],
    categories: [],
    orders: [], // Store order history
    salesChart: null,
    currentTimeframe: 'daily',

    async init() {
        // 1. Data Loading & Migration
        const storedProducts = localStorage.getItem('products');
        const storedCategories = localStorage.getItem('categories');
        const storedOrders = localStorage.getItem('orders');

        let shouldReload = false;

        if (storedProducts) {
            this.products = JSON.parse(storedProducts);
            // Migration Check: ONLY if we see old vapes category (legacy data)
            if (this.products.length > 0 && this.products[0].category === 'vapes') {
                shouldReload = true;
            }
        } else {
            shouldReload = true;
        }

        // Load Categories
        if (storedCategories) {
            this.categories = JSON.parse(storedCategories);
            // Update legacy categories to have visibility flag if missing
            this.categories.forEach(c => { if(typeof c.visible === 'undefined') c.visible = true; });
        } else {
            // Default categories
            this.categories = [
                { id: 1, name: 'Tecnología', slug: 'tecnologia', visible: true },
                { id: 2, name: 'Moda', slug: 'moda', visible: true },
                { id: 3, name: 'Hogar', slug: 'hogar', visible: true },
                { id: 4, name: 'Deportes', slug: 'deportes', visible: true },
                { id: 99, name: 'Ofertas', slug: 'ofertas', visible: true }
            ];
            this.saveCategories();
        }

        // Load Orders (Real Data - Starts Empty)
        if (storedOrders) {
            try {
                this.orders = JSON.parse(storedOrders);
                if (!Array.isArray(this.orders)) this.orders = [];
                console.log('📦 Orders loaded on init:', this.orders.length);
            } catch (e) {
                console.error('❌ Error parsing orders on init', e);
                this.orders = [];
            }
        } else {
            console.log('ℹ️ No orders found, starting fresh');
            this.orders = [];
        }

        if (shouldReload) {
            try {
                const response = await fetch('data/products.json');
                this.products = await response.json();
                this.saveData();
                console.log('Database migrated/initialized');
            } catch (e) {
                console.error("Error init products", e);
                // Fallback empty if file fails
                this.products = [];
            }
        }

        this.setupStorageListeners();
        this.setupAuth();
        // If already logged in, init dashboard immediately
        if (localStorage.getItem('adminLoggedIn') === 'true') {
            this.initDashboard();
        }
    },

    setupAuth() {
        const loginOverlay = document.getElementById('loginOverlay');
        const adminPanel = document.getElementById('adminPanel');
        const loginForm = document.getElementById('loginForm');

        if (localStorage.getItem('adminLoggedIn') === 'true') {
            loginOverlay.classList.add('hidden');
            adminPanel.classList.remove('hidden');
            // Don't call initDashboard here, it's called from init()
        }

        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const user = document.getElementById('username').value;
            const pass = document.getElementById('password').value;

            if (user === 'admin' && pass === 'admin123') {
                localStorage.setItem('adminLoggedIn', 'true');
                loginOverlay.classList.add('hidden');
                adminPanel.classList.remove('hidden');
                this.initDashboard();
            } else {
                alert('Credenciales incorrectas');
            }
        });

        window.logout = () => {
			if(confirm('¿Cerrar sesión?')) {
				localStorage.removeItem('adminLoggedIn');
				location.reload();
			}
        };
    },

    initDashboard() {
        console.log('🚀 Inicializando dashboard...');
        
        // Force reload orders from localStorage
        const storedOrders = localStorage.getItem('orders');
        if (storedOrders) {
            try {
                this.orders = JSON.parse(storedOrders);
                console.log('📦 Pedidos cargados en init:', this.orders.length);
            } catch (e) {
                console.error('❌ Error cargando pedidos en init', e);
                this.orders = [];
            }
        } else {
            this.orders = [];
        }
        
        this.renderDashboardStats();
        this.renderProductsTable();
        this.initChart();
        this.renderOrders();
        this.setupProductForm();
        this.setupGlobalHelpers();
    },

    renderDashboardStats() {
        console.log('📊 Rendering dashboard stats...');
        console.log('📦 Products count:', this.products.length);
        
        // Calculate Stats
        const total = this.products.length;
        const totalValue = this.products.reduce((acc, p) => acc + (p.price * p.stock), 0);
        const lowStockItems = this.products.filter(p => p.stock < 10);

        console.log('💰 Total inventory value:', totalValue);
        console.log('⚠️ Low stock items:', lowStockItems.length);

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
        
        if (!lowStockList) {
            console.warn('⚠️ lowStockList element not found');
            return;
        }
        
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
                            <img src="${p.image}" class="w-8 h-8 rounded object-cover border border-slate-200">
                            <span class="text-sm font-medium text-slate-700 truncate max-w-[120px]">${p.name}</span>
                        </div>
                    </td>
                    <td class="py-3 px-3">
                        <span class="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-1 rounded-full">${p.stock} un.</span>
                    </td>
                    <td class="py-3 px-3">
                         <button onclick="Admin.quickAddStock(${p.id})" class="text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-2 py-1 rounded border border-indigo-200 transition-colors">
                            +10
                        </button>
                    </td>
                `;
                lowStockList.appendChild(tr);
            });
        }
    },

    renderProductsTable() {
        console.log('📋 Rendering products table...');
        const tbody = document.getElementById('productsTable');
        
        if (!tbody) {
            console.error('❌ productsTable element not found');
            return;
        }
        
        console.log('📦 Rendering', this.products.length, 'products');
        
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

            return `
            <tr>
                <td>
                    <img src="${p.image}" class="w-10 h-10 rounded-lg object-cover shadow-sm border border-slate-200">
                </td>
                <td class="font-medium text-slate-700">${p.name}</td>
                <td>
                    <span class="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded-md uppercase">${p.category}</span>
                </td>
                <td class="text-slate-600 font-medium">$${p.price}</td>
                <td>
                    <span class="status-badge ${statusClass}">${statusText} (${p.stock})</span>
                </td>
                <td>
                    <div class="flex">
                        <button onclick="openProductModal(${p.id})" class="action-btn btn-edit" title="Editar">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button onclick="deleteProduct(${p.id})" class="action-btn btn-delete" title="Eliminar">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
            `;
        }).join('');
    },

    initChart() {
        console.log('📈 Initializing sales chart...');
        const canvas = document.getElementById('salesChart');
        
        if (!canvas) {
            console.error('❌ salesChart canvas not found');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        
        // Destroy existing chart if any
        if (this.salesChart) {
            console.log('🔄 Destroying existing chart');
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
    },

    // Category Management
    renderCategories() {
        console.log('🏷️ Rendering categories...');
        const tbody = document.getElementById('categoriesList');
        
        if(!tbody) {
            console.warn('⚠️ categoriesList element not found');
            return;
        }
        
        console.log('📋 Rendering', this.categories.length, 'categories');

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
        console.log('💾 Saving orders...', this.orders.length, 'orders');
        localStorage.setItem('orders', JSON.stringify(this.orders));

        if (!silent) {
            if (this.salesChart) {
                console.log('📊 Updating chart after order save');
                this.updateChart(this.currentTimeframe || 'daily');
            } else {
                console.warn('⚠️ Chart not available for update');
            }
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
            // Products/categories sync could be added here if needed
        });
    },

    // Order Management
    renderOrders() {
        console.log('🔄 renderOrders() llamado');
        
        const tbody = document.getElementById('ordersTableBody');
        const emptyMsg = document.getElementById('noOrdersMsg');
        
        if (!tbody) {
            console.error('❌ Table body for orders not found');
            return;
        }

        // Force reload from localStorage ALWAYS
        const storedOrders = localStorage.getItem('orders');
        console.log('📦 Datos de localStorage (orders):', storedOrders);
        
        if (storedOrders) {
             try {
                this.orders = JSON.parse(storedOrders);
                console.log('✅ Pedidos parseados:', this.orders);
                if (!Array.isArray(this.orders)) {
                    console.warn('⚠️ orders no es un array, reseteando');
                    this.orders = [];
                } else {
                    // Validate and fix order data format
                    let needsMigration = false;
                    this.orders = this.orders.filter(o => {
                        // Check if items is not an array (old format)
                        if (!Array.isArray(o.items)) {
                            console.warn('⚠️ Pedido con formato inválido detectado:', o.id, '- items no es un array');
                            needsMigration = true;
                            return false; // Remove invalid orders
                        }
                        return true; // Keep valid orders
                    });
                    
                    if (needsMigration) {
                        console.log('🔄 Migrando datos de pedidos, eliminados pedidos con formato inválido');
                        console.log('📊 Pedidos válidos restantes:', this.orders.length);
                        localStorage.setItem('orders', JSON.stringify(this.orders));
                    }
                }
             } catch(e) {
                 console.error('❌ Error parsing orders', e);
                 this.orders = [];
             }
        } else {
             console.log('ℹ️ No hay pedidos en localStorage');
             this.orders = [];
        }

        console.log('📊 Total de pedidos a renderizar:', this.orders.length);

        // Sort by last activity (paidAt/cancelledAt/date)
        const sortedOrders = [...this.orders].sort((a,b) => {
            const dateB = new Date(b.paidAt || b.cancelledAt || b.date);
            const dateA = new Date(a.paidAt || a.cancelledAt || a.date);
            return dateB - dateA;
        });

        if (sortedOrders.length === 0) {
            console.log('ℹ️ No hay pedidos para mostrar');
            tbody.innerHTML = '';
            if (emptyMsg) emptyMsg.classList.remove('hidden');
            return;
        }
        
        console.log('✅ Renderizando', sortedOrders.length, 'pedidos');
        if (emptyMsg) emptyMsg.classList.add('hidden');

        tbody.innerHTML = sortedOrders.map(o => {
            let statusBadge = '';
            let actions = '';

            if (o.status === 'pending_whatsapp') {
                statusBadge = '<span class="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-bold border border-yellow-200 inline-flex items-center gap-1"><i class="fa-brands fa-whatsapp"></i>Pendiente WhatsApp</span>';
                actions = `
                    <button onclick="Admin.updateOrderStatus(${o.id}, 'paid')" class="bg-emerald-100 text-emerald-600 hover:bg-emerald-200 p-2 rounded mr-1 transition-colors" title="Marcar como Pagado">
                        <i class="fa-solid fa-check"></i>
                    </button>
                    <button onclick="Admin.updateOrderStatus(${o.id}, 'cancelled')" class="bg-red-100 text-red-600 hover:bg-red-200 p-2 rounded transition-colors" title="Cancelar Pedido">
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

    updateOrderStatus(orderId, newStatus) {
        console.log('🔄 Actualizando pedido #' + orderId + ' a estado:', newStatus);
        
        // Force reload orders from localStorage first
        const storedOrders = localStorage.getItem('orders');
        if (storedOrders) {
            try {
                this.orders = JSON.parse(storedOrders);
                console.log('✅ Orders reloaded:', this.orders.length);
            } catch (e) {
                console.error('❌ Error reloading orders', e);
                alert('Error al cargar pedidos');
                return;
            }
        }

        const orderIndex = this.orders.findIndex(o => o.id === orderId);
        if (orderIndex === -1) {
            console.error('❌ Pedido no encontrado:', orderId);
            alert('Error: Pedido no encontrado');
            return;
        }

        const order = this.orders[orderIndex];
        console.log('📦 Pedido encontrado:', order);
        
        // Validate items exist
        if (!Array.isArray(order.items) || order.items.length === 0) {
            console.error('❌ Pedido sin items válidos');
            alert('Error: El pedido no tiene items válidos');
            return;
        }

        if (newStatus === 'paid' && order.status !== 'paid') {
            console.log('💰 Procesando pago...');
            // Deduct Stock
            let stockError = false;
            let errorMessage = '';
            
            // Check stock first
            order.items.forEach(item => {
                const product = this.products.find(p => p.id === item.id);
                if (!product) {
                    stockError = true;
                    errorMessage = `Producto "${item.name}" no encontrado en inventario`;
                    console.error('❌', errorMessage);
                } else if (product.stock < item.quantity) {
                    stockError = true;
                    errorMessage = `No hay suficiente stock para "${item.name}". Disponible: ${product.stock}, Requerido: ${item.quantity}`;
                    console.error('❌', errorMessage);
                }
            });

            if (stockError) {
                alert('Error de inventario: ' + errorMessage);
                return;
            }

            // Apply deduction
            order.items.forEach(item => {
                const product = this.products.find(p => p.id === item.id);
                if (product) {
                    const oldStock = product.stock;
                    product.stock -= item.quantity;
                    console.log(`📊 ${product.name}: ${oldStock} → ${product.stock}`);
                }
            });

            order.status = 'paid';
            order.paidAt = new Date().toISOString();
            console.log('✅ Status changed to paid, timestamp:', order.paidAt);
            this.saveData(); // Save Product Stock changes
            console.log('💾 Products saved');
            
        } else if (newStatus === 'cancelled') {
            console.log('❌ Cancelando pedido...');
            order.status = 'cancelled';
            order.cancelledAt = new Date().toISOString();
            console.log('✅ Status changed to cancelled, timestamp:', order.cancelledAt);
        }

        // Update Order
        this.orders[orderIndex] = order;
        console.log('💾 Guardando cambios del pedido...');
        this.saveOrders(); // Save Order changes
        console.log('✅ Pedido actualizado exitosamente en localStorage');
        
        // Refresh UI
        this.renderOrders(); // Refresh table
        this.renderDashboardStats(); // Refresh Total Value/Stock stats
        console.log('🔄 UI refreshed');
        
        // Show success message
        const statusText = newStatus === 'paid' ? 'PAGADO' : 'CANCELADO';
        alert(`Pedido #${orderId.toString().slice(-6)} marcado como ${statusText}`);
    },

    // Analytics
    updateChart(timeframe, btnElement) {
        console.log('📊 Updating chart for timeframe:', timeframe);
        this.currentTimeframe = timeframe;
        
        if (!this.salesChart) {
            console.warn('⚠️ Chart not initialized yet');
            return;
        }

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
        const self = this; // Store reference to Admin object
        
        window.clearAllOrders = function() {
            console.log('🗑️ clearAllOrders called - showing modal');
            const modal = document.getElementById('confirmDeleteModal');
            if (modal) {
                modal.classList.remove('hidden');
                console.log('💬 Modal displayed');
            } else {
                console.error('❌ Modal not found');
            }
        };
        
        window.executeDeleteAllOrders = function() {
            console.log('✅ Executing delete all orders...');
            const modal = document.getElementById('confirmDeleteModal');
            if (modal) modal.classList.add('hidden');
            
            localStorage.removeItem('orders');
            console.log('💾 Removed from localStorage');
            self.orders = [];
            console.log('📦 Cleared admin orders array');
            self.renderOrders();
            console.log('🔄 Rendered empty orders table');
            if (self.salesChart) {
                self.updateChart(self.currentTimeframe || 'daily');
                console.log('📊 Updated chart');
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
                const p = this.products.find(x => x.id === id);
                if (p) {
                    title.innerText = 'Editar Producto';
                    document.getElementById('productId').value = p.id;
                    document.getElementById('pName').value = p.name;
                    document.getElementById('pDesc').value = p.description || '';
                    document.getElementById('pPrice').value = p.price;
                    document.getElementById('pStock').value = p.stock;
                    document.getElementById('pCategory').value = p.category;
                    document.getElementById('pImage').value = p.image;
                    
                    // Offer fields
                    const isOffer = p.isOffer || false;
                    document.getElementById('pIsOffer').checked = isOffer;
                    if(isOffer) {
                        document.getElementById('discountContainer').classList.remove('hidden');
                        document.getElementById('pDiscount').value = p.discountPercent || 0;
                    }
                }
            } else {
                title.innerText = 'Nuevo Producto';
                document.getElementById('productId').value = '';
            }
        };

        window.closeProductModal = () => {
            document.getElementById('modalOverlay').classList.add('hidden');
        };

        window.deleteProduct = (id) => {
            if (confirm('¿Estás seguro de eliminar este producto?')) {
                this.products = this.products.filter(p => p.id !== id);
                this.saveData();
                this.renderAll();
            }
        };

        window.exportToCSV = () => {
            if (this.products.length === 0) {
                alert("No hay datos para exportar");
                return;
            }

            // CSV Header
            let csvContent = "data:text/csv;charset=utf-8,";
            csvContent += "ID,Nombre,Categoria,Precio,Stock,Imagen\n";

            // CSV Rows
            this.products.forEach(p => {
                const row = [
                    p.id,
                    `"${p.name.replace(/"/g, '""')}"`, // Escape quotes
                    p.category,
                    p.price,
                    p.stock,
                    p.image
                ].join(",");
                csvContent += row + "\n";
            });

            // Download Trigger
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "novamarket_inventory_" + new Date().toISOString().slice(0,10) + ".csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };
    },

    quickAddStock(id) {
        const p = this.products.find(x => x.id === id);
        if (p) {
            p.stock += 10;
            this.saveData();
            this.renderAll();
        }
    },

    saveProduct() {
        const id = document.getElementById('productId').value;
        const isOffer = document.getElementById('pIsOffer').checked;

        const newProd = {
            id: id ? parseInt(id) : Date.now(),
            name: document.getElementById('pName').value,
            description: document.getElementById('pDesc').value,
            price: parseFloat(document.getElementById('pPrice').value),
            category: document.getElementById('pCategory').value,
            stock: parseInt(document.getElementById('pStock').value),
            image: document.getElementById('pImage').value || 'https://via.placeholder.com/150',
            isOffer: isOffer,
            discountPercent: isOffer ? parseInt(document.getElementById('pDiscount').value) : 0
        };

        if (id) {
            const index = this.products.findIndex(p => p.id == id);
            if (index !== -1) this.products[index] = newProd;
        } else {
            this.products.push(newProd);
        }

        this.saveData();
        window.closeProductModal();
        this.renderAll();
    },

    saveData() {
        localStorage.setItem('products', JSON.stringify(this.products));
    },

    renderAll() {
        this.renderDashboardStats();
        this.renderProductsTable();
        // If Intelligence tab is active, we might want to refresh it too, but for now it's on-demand
    },

    renderIntelligence() {
        console.log('🧠 Rendering intelligence section...');
        
        if (this.products.length === 0) {
            console.warn('⚠️ No products available for intelligence analysis');
        }
        
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
            console.log('📊 Creating category distribution chart...');
            // Destroy existing if any
            if (this.intChart) {
                console.log('🔄 Destroying existing intelligence chart');
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
    },

    // Export products.json for GitHub deployment
    exportProductsJSON() {
        const dataStr = JSON.stringify(this.products, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'products.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert('✅ Archivo products.json descargado.\n\nPara actualizar en GitHub Pages:\n1. Reemplaza el archivo data/products.json con este\n2. Haz commit y push a tu repositorio\n3. Espera unos minutos a que GitHub Pages se actualice');
    }
};

// Global export function
window.exportProducts = () => Admin.exportProductsJSON();

// Start
document.addEventListener('DOMContentLoaded', () => {
    Admin.init();
    // Expose Admin for inline HTML calls (like quickAddStock)
    window.Admin = Admin;
});
