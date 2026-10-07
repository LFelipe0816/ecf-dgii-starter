import { create } from 'xmlbuilder2';
import type { CreateInvoiceInput } from './schemas';

type Item = CreateInvoiceInput['items'][number];

/** Umbral (RD$) por debajo del cual el tipo 32 se reporta como RFCE (resumen) y no como e-CF completo. */
export const UMBRAL_RFCE_DOP = 250_000;

const round2 = (n: number): number => Math.round(n * 100) / 100;
const money = (n: number): string => n.toFixed(2);

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** DD-MM-YYYY HH:mm:ss, formato de FechaHoraFirma. */
export function formatFechaHora(d: Date): string {
  return (
    `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

export interface Totales {
  montoGravadoI1: number;
  montoExento: number;
  totalITBIS1: number;
  montoTotal: number;
}

export function calcularTotales(items: Item[]): Totales {
  let gravado = 0;
  let exento = 0;
  for (const item of items) {
    const base = round2(item.cantidad * item.precioUnitario);
    if (item.tasaITBIS === 0) exento += base;
    else gravado += base;
  }
  const montoGravadoI1 = round2(gravado);
  const montoExento = round2(exento);
  const totalITBIS1 = round2(montoGravadoI1 * 0.18);
  return {
    montoGravadoI1,
    montoExento,
    totalITBIS1,
    montoTotal: round2(montoGravadoI1 + montoExento + totalITBIS1),
  };
}

function buildIdDoc(input: CreateInvoiceInput): Record<string, unknown> {
  const doc: Record<string, unknown> = { TipoeCF: input.tipo, eNCF: input.encf };
  // El tipo 32 no lleva FechaVencimientoSecuencia.
  if (input.tipo === '31') doc.FechaVencimientoSecuencia = input.fechaVencimientoSecuencia;
  doc.TipoIngresos = input.tipoIngresos;
  doc.TipoPago = input.tipoPago;
  return doc;
}

function buildEmisor(input: CreateInvoiceInput): Record<string, unknown> {
  const e = input.emisor;
  return {
    RNCEmisor: e.rnc,
    RazonSocialEmisor: e.razonSocial,
    DireccionEmisor: e.direccion,
    FechaEmision: e.fechaEmision,
  };
}

function buildComprador(input: CreateInvoiceInput): Record<string, unknown> | null {
  const c = input.comprador;
  if (!c) return null;
  const comprador: Record<string, unknown> = {};
  if (c.rnc) comprador.RNCComprador = c.rnc;
  comprador.RazonSocialComprador = c.razonSocial;
  return comprador;
}

function buildTotales(t: Totales): Record<string, unknown> {
  const totales: Record<string, unknown> = {};
  if (t.montoGravadoI1 > 0) {
    totales.MontoGravadoTotal = money(t.montoGravadoI1);
    totales.MontoGravadoI1 = money(t.montoGravadoI1);
  }
  if (t.montoExento > 0) totales.MontoExento = money(t.montoExento);
  if (t.montoGravadoI1 > 0) {
    totales.ITBIS1 = 18;
    totales.TotalITBIS = money(t.totalITBIS1);
    totales.TotalITBIS1 = money(t.totalITBIS1);
  }
  totales.MontoTotal = money(t.montoTotal);
  return totales;
}

function buildItem(item: Item, numeroLinea: number): Record<string, unknown> {
  // 1 = ITBIS 18%, 4 = Exento
  const indicadorFacturacion = item.tasaITBIS === 0 ? 4 : 1;
  const obj: Record<string, unknown> = {
    NumeroLinea: numeroLinea,
    IndicadorFacturacion: indicadorFacturacion,
    NombreItem: item.descripcion,
    IndicadorBienoServicio: item.bienOServicio,
    CantidadItem: money(item.cantidad),
  };
  if (item.unidadMedida) obj.UnidadMedida = item.unidadMedida;
  obj.PrecioUnitarioItem = money(item.precioUnitario);
  obj.MontoItem = money(round2(item.cantidad * item.precioUnitario));
  return obj;
}

export interface BuildResult {
  xml: string;
  totales: Totales;
  warnings: string[];
}

/**
 * Genera el XML del e-CF **sin firmar** a partir de una factura ya validada.
 * La firma digital y el envío a la DGII no forman parte de este starter
 * (ver `signer.ts` y `transport.ts`).
 */
export function buildEcfXml(input: CreateInvoiceInput, now: Date = new Date()): BuildResult {
  const totales = calcularTotales(input.items);
  const warnings: string[] = [];

  if (input.tipo === '32' && totales.montoTotal < UMBRAL_RFCE_DOP) {
    warnings.push(
      `Las facturas de consumo (tipo 32) menores a RD$${UMBRAL_RFCE_DOP.toLocaleString('en-US')} ` +
        'se reportan a la DGII como RFCE (resumen). Este starter solo genera el e-CF completo.',
    );
  }

  const comprador = buildComprador(input);

  const doc = {
    ECF: {
      Encabezado: {
        Version: '1.0',
        IdDoc: buildIdDoc(input),
        Emisor: buildEmisor(input),
        ...(comprador ? { Comprador: comprador } : {}),
        Totales: buildTotales(totales),
      },
      DetallesItems: {
        Item: input.items.map((item, i) => buildItem(item, i + 1)),
      },
      FechaHoraFirma: formatFechaHora(now),
    },
  };

  const xml = create({ version: '1.0', encoding: 'UTF-8' }, doc).end({ prettyPrint: false });
  return { xml, totales, warnings };
}
