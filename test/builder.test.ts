import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildEcfXml, calcularTotales } from '../src/builder';
import { createInvoiceSchema } from '../src/schemas';
import { buildServer } from '../src/server';

const load = (name: string) =>
  JSON.parse(readFileSync(join(__dirname, '..', 'examples', name), 'utf8'));

const FIXED_NOW = new Date(2026, 9, 7, 9, 30, 0);

describe('calcularTotales', () => {
  it('separa gravado y exento y aplica 18% de ITBIS', () => {
    const t = calcularTotales([
      { descripcion: 'a', cantidad: 10, precioUnitario: 1500, tasaITBIS: 18, bienOServicio: 2 },
      { descripcion: 'b', cantidad: 2, precioUnitario: 500, tasaITBIS: 0, bienOServicio: 1 },
    ]);
    expect(t).toEqual({ montoGravadoI1: 15000, montoExento: 1000, totalITBIS1: 2700, montoTotal: 18700 });
  });
});

describe('schema', () => {
  it('acepta los ejemplos', () => {
    expect(createInvoiceSchema.safeParse(load('factura-31.json')).success).toBe(true);
    expect(createInvoiceSchema.safeParse(load('factura-32.json')).success).toBe(true);
  });

  it('el tipo 31 exige RNC del comprador y fecha de vencimiento', () => {
    const bad = load('factura-31.json');
    delete bad.comprador.rnc;
    delete bad.fechaVencimientoSecuencia;
    const r = createInvoiceSchema.safeParse(bad);
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('comprador.rnc');
      expect(paths).toContain('fechaVencimientoSecuencia');
    }
  });
});

describe('buildEcfXml', () => {
  it('genera el XML del tipo 31 con la estructura esperada', () => {
    const input = createInvoiceSchema.parse(load('factura-31.json'));
    const { xml, warnings } = buildEcfXml(input, FIXED_NOW);
    expect(warnings).toEqual([]);
    expect(xml).toContain('<TipoeCF>31</TipoeCF>');
    expect(xml).toContain('<FechaVencimientoSecuencia>31-12-2027</FechaVencimientoSecuencia>');
    expect(xml).toContain('<MontoTotal>18700.00</MontoTotal>');
    expect(xml).toContain('<FechaHoraFirma>07-10-2026 09:30:00</FechaHoraFirma>');
  });

  it('el tipo 32 no lleva FechaVencimientoSecuencia', () => {
    const input = createInvoiceSchema.parse(load('factura-32.json'));
    const { xml } = buildEcfXml(input, FIXED_NOW);
    expect(xml).not.toContain('FechaVencimientoSecuencia');
  });

  it('avisa cuando un tipo 32 queda bajo el umbral RFCE', () => {
    const raw = load('factura-32.json');
    raw.items[0].precioUnitario = 100;
    const { warnings } = buildEcfXml(createInvoiceSchema.parse(raw), FIXED_NOW);
    expect(warnings).toHaveLength(1);
  });
});

describe('POST /api/v1/ecf/preview', () => {
  it('devuelve el XML sin firmar', async () => {
    const app = await buildServer();
    const res = await app.inject({ method: 'POST', url: '/api/v1/ecf/preview', payload: load('factura-31.json') });
    expect(res.statusCode).toBe(200);
    expect(res.json().xml).toContain('<ECF>');
    await app.close();
  });

  it('responde 422 con los errores de validación', async () => {
    const app = await buildServer();
    const res = await app.inject({ method: 'POST', url: '/api/v1/ecf/preview', payload: { tipo: '31' } });
    expect(res.statusCode).toBe(422);
    expect(res.json().issues.length).toBeGreaterThan(0);
    await app.close();
  });
});
