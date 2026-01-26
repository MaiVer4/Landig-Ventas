// Supabase helper wrapper
(function() {
  if (window.supabaseHelpers) return; // prevent re-init

  const config = window.supabaseConfig;
  if (!config || !config.url || !config.anonKey) {
    console.warn('Supabase config no definido. Define window.supabaseConfig antes de cargar supabase.js');
    return;
  }

  const client = supabase.createClient(config.url, config.anonKey);

  async function handleResult(promise) {
    const { data, error } = await promise;
    if (error) throw error;
    return data || [];
  }

  window.supabaseHelpers = {
    async fetchOrders() {
      return handleResult(client
        .from('Orders')
        .select('*')
        .order('date', { ascending: false })
      );
    },
    async addOrder(order) {
      const payload = { ...order, id: String(order.id || Date.now()) };
      await handleResult(client.from('Orders').upsert(payload));
    },
    async upsertOrder(order) {
      const payload = { ...order, id: String(order.id || Date.now()) };
      await handleResult(client.from('Orders').upsert(payload));
    },
    async deleteAllOrders() {
      await handleResult(client.from('Orders').delete().neq('id', ''));
    },
    async fetchProducts() {
      return handleResult(client.from('Products').select('*'));
    },
    async upsertProduct(product) {
      const payload = { ...product, id: String(product.id || Date.now()) };
      await handleResult(client.from('Products').upsert(payload));
    },
    async deleteProduct(id) {
      await handleResult(client.from('Products').delete().eq('id', String(id)));
    }
  };
})();
