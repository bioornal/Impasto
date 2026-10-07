import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUSINESS } from '../lib/business';
import { jsonLdSitio } from '../lib/seo';
import { promptVendedor } from '../lib/chat-prompt';
import { estadoTienda } from '../lib/hours';
import type { CatalogData } from '../types';

const catalogo: CatalogData = {
  pizzas: [{ id: 'p', nombre: 'Muzza', categoria: 'clasica', precio: 10000, desc: '', tags: [], disponible: true }],
  empanadas: [], bebidas: [{ id: 'b', nombre: 'Agua', precio: 1000, disponible: true }],
  empanadaBoxPrices: { 6: 6000, 12: 12000, 24: 24000 },
  promos: [{ id: 'e', titulo: 'Docena de empanadas', desc: 'Al horno', badge: 'Promo' }], reviews: [],
};

test('quitar y reingresar empanadas actualiza lo anunciado por buscadores y chatbot', () => {
  const business = { ...BUSINESS, name: 'Impasto - Pizzeria y Empanadas' };
  for (const visible of [false, true, false, true]) {
    const data = { ...catalogo, empanadas: visible ? [{ id: 'e', nombre: 'Carne', precio: 1000, desc: '', tags: [], disponible: false }] : [] };
    const seo = JSON.stringify(jsonLdSitio(business, data));
    const prompt = promptVendedor(data, business, estadoTienda(business));
    for (const texto of [seo, prompt]) {
      assert.equal(/empanadas?/i.test(texto), visible, texto.match(/.{0,60}empanadas?.{0,60}/ig)?.join("\n"));
      assert.equal(/160 g/.test(texto), visible);
    }
  }
});

import { cartaVisible } from '../lib/carta-visible';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Hero } from '../components/sections/Hero';
import { Ticker } from '../components/layout/Header';
import { Faq } from '../components/sections/Faq';
(globalThis as unknown as { React: typeof React }).React = React;

test('la portada, franja y preguntas ocultan y restauran las referencias', () => {
  for (const hayEmpanadas of [false, true, false]) {
    const html = renderToStaticMarkup(React.createElement(React.Fragment, null,
      React.createElement(Hero, { onCta() {}, onHalf() {}, varieties: 1, hayEmpanadas }),
      React.createElement(Ticker, { desde: null, hayEmpanadas }),
      React.createElement(Faq, { business: BUSINESS, hayEmpanadas, indice: '05' }),
    ));
    assert.equal(/empanadas?/i.test(html), hayEmpanadas);
    assert.equal(/160 g/.test(html), hayEmpanadas);
    assert.match(html, /05 — Preguntas/);
  }
});

test('los índices siguen las secciones presentes al quitar y reponer categorías', () => {
  for (const empanadas of [[], [{ id: 'e' }], []]) {
    const data = { ...catalogo, empanadas } as CatalogData;
    const visible = cartaVisible(data);
    const ids = ['pizzas', ...(empanadas.length ? ['empanadas'] : []), 'bebidas', 'nosotros', 'opiniones', 'preguntas'];
    assert.deepEqual(ids.map(visible.indice), empanadas.length ? ['01','02','03','04','05','06'] : ['01','02','03','04','05']);
  }
  const visible = cartaVisible({ ...catalogo, pizzas: [], bebidas: [] });
  assert.deepEqual(['nosotros','opiniones','preguntas'].map(visible.indice), ['01','02','03']);
});

import { Shell } from '../components/Shell';

test('Impasto renderiza toda la página sin referencias ni huecos y las restaura al reingresar', () => {
  for (const visible of [false, true, false]) {
    const data: CatalogData = { ...catalogo,
      empanadas: visible ? [{ id: 'e', nombre: 'Carne', precio: 1000, desc: '', tags: [], disponible: true }] : [],
      reviews: [{ nombre: 'Ana', texto: 'Excelentes empanadas', producto: 'Empanadas', rating: 5 }],
    };
    const html = renderToStaticMarkup(React.createElement(Shell, {
      data, business: { ...BUSINESS, name: 'Impasto - Pizzeria y Empanadas' },
      estadoInicial: estadoTienda(BUSINESS), chatDisponible: false,
    }));
    assert.equal(/empanadas?/i.test(html), visible);
    const indices = [...html.matchAll(/class="sec-index(?: gold)?">(\d\d)/g)].map(m => m[1]);
    assert.deepEqual(indices, visible ? ['01','02','03','04','05','06'] : ['01','02','03','04','05']);
  }
});

import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

test('imagen compartida, manifiesto, metadatos y resumen para asistentes siguen la carta', async () => {
  const require = createRequire(import.meta.url);
  for (const visible of [false, true]) {
    const data = { ...catalogo, empanadas: visible ? [{ id: 'e', nombre: 'Carne', tags: [], disponible: true }] : [] };
    for (const archivo of ['app/opengraph-image.tsx', 'app/manifest.ts', 'app/page.tsx', 'app/llms.txt/route.ts']) {
      const compiled = ts.transpileModule(readFileSync(archivo, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
      }).outputText;
      const exports: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
      runInNewContext(compiled, { exports, React, Response, process, require: (name: string) => {
        if (name === '@/lib/catalog') return { getCatalogData: async () => data };
        if (name === '@/lib/business-server') return { getBusinessConfig: async () => BUSINESS };
        if (name === 'next/og') return { ImageResponse: class { html: string; constructor(element: React.ReactNode) { this.html = renderToStaticMarkup(element); } } };
        if (name === 'react') return { ...React, cache: (fn: unknown) => fn };
        return require(name);
      } });
      const result = await (archivo.includes('page.tsx') ? exports.generateMetadata() : archivo.includes('route.ts') ? exports.GET() : exports.default());
      const texto = result instanceof Response ? await result.text() : JSON.stringify(result);
      assert.equal(/empanadas?/i.test(texto), visible, archivo);
    }
  }
});
