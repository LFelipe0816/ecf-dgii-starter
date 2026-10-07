import { z } from 'zod';

/** Tipos de e-CF soportados por este starter. */
export const TIPOS_SOPORTADOS = ['31', '32'] as const;
export type TipoEcf = (typeof TIPOS_SOPORTADOS)[number];

const fechaDDMMYYYY = z
  .string()
  .regex(/^\d{2}-\d{2}-\d{4}$/, 'Formato de fecha inválido. Use DD-MM-YYYY');

const rnc = z.string().regex(/^\d{9}$|^\d{11}$/, 'El RNC debe tener 9 u 11 dígitos');

const itemSchema = z.object({
  descripcion: z.string().min(1).max(80),
  cantidad: z.number().positive(),
  unidadMedida: z.string().optional(),
  precioUnitario: z.number().nonnegative(),
  /** 18 = ITBIS general, 0 = exento. Otras tasas no están soportadas en el starter. */
  tasaITBIS: z.union([z.literal(0), z.literal(18)]).default(18),
  /** 1 = Bien, 2 = Servicio */
  bienOServicio: z.union([z.literal(1), z.literal(2)]).default(1),
});

export const createInvoiceSchema = z
  .object({
    tipo: z.enum(TIPOS_SOPORTADOS),
    /** eNCF: letra E + 12 dígitos. En un sistema real lo asigna tu secuencia autorizada. */
    encf: z.string().regex(/^E\d{12}$/, 'El eNCF debe ser E seguido de 12 dígitos'),
    /** Requerida para tipo 31. No aplica al tipo 32. */
    fechaVencimientoSecuencia: fechaDDMMYYYY.optional(),
    /** 01 = Operaciones que no son ingresos... ver catálogo de la DGII. */
    tipoIngresos: z.string().regex(/^0[1-6]$/).default('01'),
    /** 1 = Contado, 2 = Crédito, 3 = Gratuito */
    tipoPago: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
    emisor: z.object({
      rnc,
      razonSocial: z.string().min(1).max(150),
      direccion: z.string().min(1).max(100),
      fechaEmision: fechaDDMMYYYY,
    }),
    comprador: z
      .object({
        rnc: rnc.optional(),
        razonSocial: z.string().min(1).max(150),
      })
      .optional(),
    items: z.array(itemSchema).min(1).max(1000),
  })
  .superRefine((data, ctx) => {
    if (data.tipo === '31') {
      if (!data.fechaVencimientoSecuencia) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'El tipo 31 requiere fechaVencimientoSecuencia',
          path: ['fechaVencimientoSecuencia'],
        });
      }
      if (!data.comprador?.rnc) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'El tipo 31 requiere el RNC del comprador',
          path: ['comprador', 'rnc'],
        });
      }
    }
  });

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type CreateInvoiceRaw = z.input<typeof createInvoiceSchema>;
