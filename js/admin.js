const Admin = {
    products: [],

    async init() {
        // 1. Data Loading & Migration
        const storedProducts = localStorage.getItem('products');
        let shouldReload = false;

        if (storedProducts) {
            this.products = JSON.parse(storedProducts);
            // Migration Check: If we see old vapes category, force reload
            if (this.products.length > 0 && (this.products[0].category === 'vapes' || !this.products[0].category)) {
                shouldReload = true;
            }
        } else {
            shouldReload = true;
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
        this.renderDashboardStats();
        this.renderProductsTable();
        this.initChart();
        this.setupProductForm();
    },

    renderDashboardStats() {
        // Calculate Stats
        const total = this.products.length;
        const totalValue = this.products.reduce((acc, p) => acc + (p.price * p.stock), 0);
        const lowStockItems = this.products.filter(p => p.stock < 10);

        // Update Cards
        document.getElementById('totalProducts').innerText = total;
        document.getElementById('inventoryValue').innerText = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(totalValue);
        document.getElementById('lowStockCount').innerText = lowStockItems.length;

        // Render Low Stock Widget
        const lowStockList = document.getElementById('lowStockList');
        const noLowStockMsg = document.getElementById('noLowStockMsg');
        
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
        const tbody = document.getElementById('productsTable');
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
        const ctx = document.getElementById('salesChart').getContext('2d');
        // Dummy data for visual purposes
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'],
                datasets: [{
                    label: 'Ventas Semanales ($)',
                    data: [150, 230, 180, 320, 290, 450, 500],
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
                        grid: { borderDash: [5, 5] }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    },

    // CRUD & Helpers
    setupProductForm() {
        const form = document.getElementById('addProductForm');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProduct();
        });

        // Global functions for HTML access
        window.openProductModal = (id = null) => {
            const modal = document.getElementById('modalOverlay');
            const title = document.getElementById('modalTitle');
            const formObj = document.getElementById('addProductForm');
            
            modal.classList.remove('hidden');
            formObj.reset();

            if (id) {
                const p = this.products.find(x => x.id === id);
                if (p) {
                    title.innerText = 'Editar Producto';
                    document.getElementById('productId').value = p.id;
                    document.getElementById('pName').value = p.name;
                    document.getElementById('pPrice').value = p.price;
                    document.getElementById('pStock').value = p.stock;
                    document.getElementById('pCategory').value = p.category;
                    document.getElementById('pImage').value = p.image;
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
            link.setAttribute("download", "vape_inventory_" + new Date().toISOString().slice(0,10) + ".csv");
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
        const newProd = {
            id: id ? parseInt(id) : Date.now(),
            name: document.getElementById('pName').value,
            price: parseFloat(document.getElementById('pPrice').value),
            category: document.getElementById('pCategory').value,
            stock: parseInt(document.getElementById('pStock').value),
            image: document.getElementById('pImage').value || 'https://via.placeholder.com/150'
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
            // Destroy existing if any (naive approach, better to store instance)
            if (this.intChart) this.intChart.destroy();
            
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
});
