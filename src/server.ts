import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { buildEcfXml } from './builder';
import { createInvoiceSchema } from './schemas';

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });

  await app.register(helmet);
  await app.register(cors, { origin: true });

  app.get('/health', async () => ({ status: 'ok' }));

  /**
   * Valida la factura y devuelve el XML del e-CF SIN firmar, más los totales calculados.
   * No persiste nada y no se comunica con la DGII.
   */
  app.post('/api/v1/ecf/preview', async (request, reply) => {
    const parsed = createInvoiceSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send({
        error: 'Validación fallida',
        issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    const { xml, totales, warnings } = buildEcfXml(parsed.data);
    return { xml, totales, warnings };
  });

  return app;
}

async function main(): Promise<void> {
  const app = await buildServer();
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '127.0.0.1';
  await app.listen({ port, host });
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
