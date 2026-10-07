import type { CatalogData } from '../types';
import type { BusinessConfig } from './business';
import { ARGUMENTOS_MARCA } from './marca';

export const mencionaEmpanadas = (texto: string) => /empanadas?/i.test(texto);

/** Sigue la baja de carta; un faltante temporal sigue mostrando el producto agotado. */
export function cartaVisible(data: CatalogData) {
  const hayEmpanadas = data.empanadas.length > 0;
  const secciones = [
    ...(data.pizzas.length ? ['pizzas'] : []),
    ...(hayEmpanadas ? ['empanadas'] : []),
    ...(data.bebidas.length ? ['bebidas'] : []),
    'nosotros', 'opiniones', 'preguntas',
  ];
  return {
    hayEmpanadas,
    indice: (id: string) => String(secciones.indexOf(id) + 1).padStart(2, '0'),
    promos: data.promos.filter(p => hayEmpanadas || !mencionaEmpanadas(`${p.titulo} ${p.desc} ${p.badge}`)),
    reviews: data.reviews.filter(r => hayEmpanadas || !mencionaEmpanadas(`${r.producto ?? ''} ${r.texto}`)),
  };
}

export function argumentosDeCarta(hayEmpanadas: boolean) {
  return ARGUMENTOS_MARCA.filter(a => hayEmpanadas || !['empanadas-peso', 'repulgue'].includes(a.id));
}

export function negocioDeCarta(business: BusinessConfig, hayEmpanadas: boolean): BusinessConfig {
  return hayEmpanadas ? business : {
    ...business,
    name: business.name.replace(/\s*(?:y|&|[-–—·,])?\s*empanadas?\b/gi, '').trim(),
  };
}
