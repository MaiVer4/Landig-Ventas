// Firebase helper wrapper (compat SDK)
(function() {
  if (window.firebaseApp) return; // prevent re-init

  const config = window.firebaseConfig;
  if (!config || !config.apiKey) {
    console.warn('Firebase config no definido. Define window.firebaseConfig antes de cargar firebase.js');
    return;
  }

  try {
    const app = firebase.initializeApp(config);
    window.firebaseApp = app;
    const db = firebase.firestore();
    window.firebaseDB = db;

    window.firebaseHelpers = {
      async addOrder(order) {
        if (!db) throw new Error('Firestore no inicializado');
        const id = String(order.id || Date.now());
        await db.collection('orders').doc(id).set({ ...order, id });
        return id;
      },
      async upsertOrder(order) {
        if (!db) throw new Error('Firestore no inicializado');
        const id = String(order.id);
        await db.collection('orders').doc(id).set({ ...order, id });
        return id;
      },
      async fetchOrders() {
        if (!db) throw new Error('Firestore no inicializado');
        const snap = await db.collection('orders').orderBy('date', 'desc').get();
        return snap.docs.map(d => d.data());
      },
      async deleteAllOrders() {
        if (!db) throw new Error('Firestore no inicializado');
        const snap = await db.collection('orders').get();
        const batch = db.batch();
        snap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }
    ,
      async fetchProducts() {
        if (!db) throw new Error('Firestore no inicializado');
        const snap = await db.collection('products').get();
        return snap.docs.map(d => d.data());
      },
      async upsertProduct(product) {
        if (!db) throw new Error('Firestore no inicializado');
        const id = String(product.id || Date.now());
        await db.collection('products').doc(id).set({ ...product, id });
        return id;
      },
      async deleteProduct(id) {
        if (!db) throw new Error('Firestore no inicializado');
        await db.collection('products').doc(String(id)).delete();
      }
    };
  } catch (e) {
    console.error('Error inicializando Firebase', e);
  }
})();
