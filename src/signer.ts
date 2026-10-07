/**
 * Punto de extensión para la firma digital del e-CF.
 *
 * La DGII exige firmar el XML con un certificado digital (.p12) usando XMLDSig.
 * Esa parte NO está incluida en este starter: implementa esta interfaz con tu
 * propia lógica de firma y manejo seguro del certificado.
 */
export interface EcfSigner {
  /** Recibe el XML sin firmar y devuelve el XML firmado. */
  sign(xml: string): Promise<string>;
}

/** Implementación por defecto: falla de forma explícita para evitar enviar XML sin firmar por error. */
export class NotImplementedSigner implements EcfSigner {
  async sign(_xml: string): Promise<string> {
    throw new Error(
      'Firma digital no implementada en este starter. Implementa la interfaz EcfSigner.',
    );
  }
}
