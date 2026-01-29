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
      const products = await handleResult(client.from('Products').select('*'));
      // Ensure gallery is an array (Supabase JSONB returns it as parsed object already)
      return products.map(p => ({
        ...p,
        gallery: Array.isArray(p.gallery) ? p.gallery : (p.gallery ? [p.gallery] : [p.image])
      }));
    },
    async upsertProduct(product) {
      const payload = { 
        ...product, 
        id: String(product.id || Date.now())
      };
      
      // Only include gallery if it exists and has items
      if (product.gallery && Array.isArray(product.gallery) && product.gallery.length > 0) {
        payload.gallery = product.gallery;
      }
      
      try {
        await handleResult(client.from('Products').upsert(payload));
      } catch (error) {
        // If gallery column doesn't exist, retry without it
        if (error.code === 'PGRST204' && error.message.includes('gallery')) {
          console.warn('⚠️ Gallery column not found in database, saving without it');
          delete payload.gallery;
          await handleResult(client.from('Products').upsert(payload));
        } else {
          throw error;
        }
      }
    },
    async deleteProduct(id) {
      await handleResult(client.from('Products').delete().eq('id', String(id)));
    }
  };
})();
