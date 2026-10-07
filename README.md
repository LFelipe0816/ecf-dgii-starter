# ecf-dgii-starter

Starter de referencia, en TypeScript, para **generar comprobantes fiscales electrónicos (e-CF) de la DGII** (República Dominicana): valida la factura con Zod y produce el XML **sin firmar**.

> **Alcance, dicho con claridad.** Este proyecto es un punto de partida educativo. **No** firma el XML, **no** se comunica con la DGII y **no** cubre todos los tipos de e-CF. No sirve, tal como está, para emitir comprobantes en producción.

## Qué incluye

| Incluido | No incluido |
|---|---|
| Validación de la factura (Zod) para los tipos **31** (Crédito Fiscal) y **32** (Consumo) | Firma digital XMLDSig con certificado `.p12` |
| Cálculo de totales (ITBIS 18% y exento) | Autenticación y envío a la DGII, consulta de estado |
| Generación del XML del e-CF sin firmar | Otros tipos (33, 34, 41, 43–47), notas, anulaciones |
| API HTTP de vista previa (`POST /api/v1/ecf/preview`) | Formato RFCE (resumen) para tipo 32 bajo RD$250,000 |
| Interfaces `EcfSigner` y `DgiiTransport` como puntos de extensión | Persistencia, colas, multi-tenant, reportes 606/607 |
| Página demo estática (`web/index.html`) | Descuentos, recargos, impuestos adicionales, moneda extranjera |

Los XML generados para los ejemplos de `examples/` fueron validados contra los esquemas XSD publicados por la DGII (con un elemento de firma de relleno, porque el XSD exige la firma).

## Requisitos

- Node.js 20 o superior

## Uso

```bash
npm install
npm test
npm run dev          # http://127.0.0.1:3000
```

Vista previa de una factura:

```bash
curl -s http://127.0.0.1:3000/api/v1/ecf/preview \
  -H 'content-type: application/json' \
  -d @examples/factura-31.json
```

Respuesta:

```json
{
  "xml": "<?xml version=\"1.0\" encoding=\"UTF-8\"?><ECF>...</ECF>",
  "totales": { "montoGravadoI1": 15000, "montoExento": 1000, "totalITBIS1": 2700, "montoTotal": 18700 },
  "warnings": []
}
```

Si la factura no es válida, responde `422` con la lista de errores por campo.

También puedes abrir `web/index.html` en el navegador (con el servidor corriendo) para probarlo con un formulario.

## Como librería

```ts
import { createInvoiceSchema, buildEcfXml } from './src';

const input = createInvoiceSchema.parse(payload);
const { xml, totales, warnings } = buildEcfXml(input);
```

## Puntos de extensión

- `src/signer.ts`: implementa `EcfSigner` con tu lógica de firma y manejo seguro del certificado.
- `src/transport.ts`: implementa `DgiiTransport` según la documentación oficial de la DGII.

Las implementaciones por defecto lanzan un error explícito para que no se envíe nunca un XML sin firmar por accidente.

## Datos de ejemplo

Los RNC, razones sociales y direcciones de `examples/` son ficticios.

## Aviso

Esto no es asesoría fiscal ni un producto certificado por la DGII. Consulta siempre la documentación y los esquemas oficiales vigentes.

## Licencia

MIT. Ver [LICENSE](./LICENSE).
