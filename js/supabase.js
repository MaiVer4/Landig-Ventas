// Supabase helper wrapper
(function() {
  if (window.supabaseHelpers) return; // prevent re-init

  const config = window.supabaseConfig;
  if (!config || !config.url || !config.anonKey) {
    console.warn('Supabase config no definido. Define window.supabaseConfig antes de cargar supabase.js');
    return;
  }

  const client = supabase.createClient(config.url, config.anonKey);

  // Helper: try to resolve storage paths to public URLs when possible
  function resolveImagePath(value) {
    if (!value) return value;
    // If already a full URL or data URI, return as-is
    if (/^(https?:)?\/\//i.test(value) || value.startsWith('data:')) return value;

    // Normalize path (remove leading slashes)
    const path = value.replace(/^\/+/, '');

    // Candidate buckets to try (common names). Supabase public URL format:
    // {SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}
    const buckets = ['public', 'products', 'images', 'product-images', 'prod'];
    const base = config.url.replace(/\/$/, '');

    for (const b of buckets) {
      try {
        const candidate = `${base}/storage/v1/object/public/${b}/${encodeURIComponent(path)}`;
        // We can't do a network HEAD here reliably, so return the first candidate.
        // This covers common bucket naming; if it's wrong the browser will 404
        // and the user can update the bucket name in the DB or provide full URLs.
        return candidate;
      } catch (e) {
        // ignore encoding errors and try next
      }
    }

    // Fallback: return the raw path
    return value;
  }

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
      return products.map(p => {
        const rawGallery = Array.isArray(p.gallery) ? p.gallery : (p.gallery ? [p.gallery] : (p.image ? [p.image] : []));
        const gallery = rawGallery.map(src => resolveImagePath(src)).filter(Boolean);
        return {
          ...p,
          gallery,
          // normalize image field to first gallery item if available
          image: (p.image && /^(https?:)?\/\//i.test(p.image)) ? p.image : (gallery[0] || p.image)
        };
      });
    },
    async patchProduct(id, fields) {
      await handleResult(
        client.from('Products').update(fields).eq('id', String(id))
      );
    },
    async upsertProduct(product) {
      // Map client-side field names → Supabase column names.
      // The retry handler below will strip unrecognised columns gracefully
      // if the columns haven't been added to the table yet.
      const { isFeatured, isVisible, categories, ...productData } = product;

      const payload = { 
        ...productData, 
        id: String(product.id || Date.now()),
        is_visible:  isVisible  !== false,       // true by default
        is_featured: isFeatured === true,         // false by default
        categories:  Array.isArray(categories) ? categories : []
      };
      
      // Only include gallery if it exists and has items
      if (!product.gallery || !Array.isArray(product.gallery) || product.gallery.length === 0) {
        delete payload.gallery;
      }
      
      try {
        await handleResult(client.from('Products').upsert(payload));
      } catch (error) {
        // If an unknown column causes the error, retry stripping gallery first,
        // then fall back to minimal guaranteed columns.
        const isColumnError = error.code === 'PGRST204' ||
          (error.message && (
            error.message.includes('gallery') ||
            error.message.includes('column') ||
            error.message.includes('does not exist')
          ));
        if (isColumnError) {
          console.warn('⚠️ Column mismatch on upsert, retrying without optional fields:', error.message);
          delete payload.gallery;
          try {
            await handleResult(client.from('Products').upsert(payload));
          } catch (retryError) {
            // Last resort: only send the core guaranteed columns
            console.warn('⚠️ Retrying with base columns only:', retryError.message);
            const basePayload = {
              id: payload.id,
              name: payload.name,
              description: payload.description || '',
              price: payload.price,
              category: payload.category,
              stock: payload.stock,
              image: payload.image || '',
            };
            await handleResult(client.from('Products').upsert(basePayload));
          }
        } else {
          throw error;
        }
      }
    },
    async deleteProduct(id) {
      await handleResult(client.from('Products').delete().eq('id', String(id)));
    },
    async fetchCategories() {
      try {
        return await handleResult(
          client.from('Categories').select('*').order('order', { ascending: true })
        );
      } catch (e) {
        console.warn('⚠️ Categories table not available:', e.message);
        return [];
      }
    },
    async upsertCategory(cat) {
      await handleResult(
        client.from('Categories').upsert({
          id: String(cat.id),
          name: cat.name,
          slug: cat.slug,
          order: typeof cat.order === 'number' ? cat.order : 0
        })
      );
    },
    async deleteCategory(id) {
      await handleResult(
        client.from('Categories').delete().eq('id', String(id))
      );
    }
  };
})();
