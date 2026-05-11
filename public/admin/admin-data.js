// Admin API — todas las operaciones van a InsForge via Express
(function () {

  /* ── adaptadores: InsForge → formato interno del admin ── */

  function buildMetaMap() {
    const map = {};
    (window.IMPASTO_DATA?.pizzas || []).forEach(p => { map[p.nombre] = { ...p, type: 'pizza' }; });
    (window.IMPASTO_DATA?.empanadas || []).forEach(e => {
      map[e.nombre] = { ...e, type: 'empanada' };
      map['Empanada ' + e.nombre] = { ...e, type: 'empanada', nombre: 'Empanada ' + e.nombre };
    });
    (window.IMPASTO_DATA?.bebidas || []).forEach(b => { map[b.nombre] = { ...b, type: 'bebida' }; });
    return map;
  }

  function adaptProduct(p) {
    const meta = buildMetaMap()[p.nombre] || {};
    const type = meta.type || (p.precio === 0 ? 'empanada' : 'pizza');
    return {
      _dbId: p.id,
      id: p.id,
      nombre: p.nombre,
      precio: p.precio,
      active: p.disponible !== false,
      type,
      categoria: meta.categoria || 'clasica',
      desc: meta.desc || '',
      tags: meta.tags || [],
      popular: meta.popular || false,
      stock: 24,
    };
  }

  function adaptOrder(p) {
    const isDelivery = p.direccion && p.direccion !== 'Retiro en local';
    const items = Array.isArray(p.productos)
      ? p.productos.map(i => ({
          name: i.name || i.nombre || '?',
          qty: i.qty || i.cantidad || 1,
          price: i.price || i.precio || 0,
        }))
      : [];
    const num = String(p.numero_pedido || '').padStart(4, '0');
    return {
      _dbId: p.id,
      id: 'IM-' + num,
      cliente: p.nombre_cliente || '—',
      tel: p.telefono_cliente || '—',
      mode: isDelivery ? 'delivery' : 'takeaway',
      dir: isDelivery ? (p.direccion || '') : '',
      zona: '',
      items,
      subtotal: p.total_con_descuento || p.total || 0,
      shipping: 0,
      total: p.total || 0,
      pago: 'n/d',
      estado: p.status || 'nuevo',
      fecha: p.created_at || new Date().toISOString(),
      notas: '',
    };
  }

  function adaptCustomer(c) {
    return {
      _dbId: c.id,
      id: c.id,
      nombre: c.nombre || '—',
      tel: c.telefono || '—',
      email: c.email || '',
      dir: c.direccion || '',
      zona: '',
      pedidos: c.cant_compras || 0,
      total: 0,
      fav: c.detalles || '—',
      ultimo: c.updated_at || c.created_at || new Date().toISOString(),
    };
  }

  /* ── testimonios: sin tabla InsForge, persisten en localStorage ── */
  const TESTI_KEY = 'impasto_testimonials_v2';

  function defaultTestimonials() {
    const h = (hrs) => new Date(Date.now() - hrs * 3600000).toISOString();
    return [
      { id: 't01', nombre: 'María L.', texto: 'La mejor fugazzetta de Neuquén, masa perfecta y sabor único.', rating: 5, estado: 'aprobado', fecha: h(48) },
      { id: 't02', nombre: 'Joaquín P.', texto: 'Las empanadas de carne cortada a cuchillo son de otro nivel. Recomendado 100%.', rating: 5, estado: 'aprobado', fecha: h(72) },
      { id: 't03', nombre: 'Carolina S.', texto: 'Pedí la Patagónica y la Tartufo, las dos espectaculares. Llegó calentita.', rating: 5, estado: 'aprobado', fecha: h(96) },
      { id: 't04', nombre: 'Valentina R.', texto: 'Excelente atención y la pizza llegó rapidísimo. La Diavola es adictiva.', rating: 5, estado: 'pendiente', fecha: h(2) },
      { id: 't05', nombre: 'Lucas F.', texto: 'La masa estuvo un poco cruda esta vez pero el sabor sigue siendo bueno.', rating: 3, estado: 'pendiente', fecha: h(4) },
    ];
  }

  function loadTestimonials() {
    try {
      const raw = localStorage.getItem(TESTI_KEY);
      return raw ? JSON.parse(raw) : defaultTestimonials();
    } catch { return defaultTestimonials(); }
  }

  function saveTestimonials(list) {
    localStorage.setItem(TESTI_KEY, JSON.stringify(list));
  }

  /* ── API pública ── */
  window.ADMIN_API = {

    async loadAll() {
      const [prodRes, pedRes, cliRes] = await Promise.all([
        fetch('/api/admin/productos').then(r => r.json()).catch(() => ({ data: [] })),
        fetch('/api/admin/pedidos').then(r => r.json()).catch(() => ({ data: [] })),
        fetch('/api/admin/clientes').then(r => r.json()).catch(() => ({ data: [] })),
      ]);
      return {
        products: (prodRes.data || []).map(adaptProduct),
        orders: (pedRes.data || []).map(adaptOrder),
        customers: (cliRes.data || []).map(adaptCustomer),
        testimonials: loadTestimonials(),
      };
    },

    async updateProduct(dbId, patch) {
      const body = {};
      if (patch.nombre !== undefined) body.nombre = patch.nombre;
      if (patch.precio !== undefined) body.precio = parseInt(patch.precio);
      if (patch.active !== undefined) body.disponible = patch.active;
      const r = await fetch(`/api/admin/productos/${dbId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return r.json();
    },

    async createProduct(p) {
      const r = await fetch('/api/admin/productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: p.nombre, precio: parseInt(p.precio || 0), disponible: true }),
      });
      return r.json();
    },

    async deleteProduct(dbId) {
      const r = await fetch(`/api/admin/productos/${dbId}`, { method: 'DELETE' });
      return r.json();
    },

    async updateOrderStatus(dbId, status) {
      const r = await fetch(`/api/admin/pedidos/${dbId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      return r.json();
    },

    saveTestimonials,
    loadTestimonials,
  };
})();
