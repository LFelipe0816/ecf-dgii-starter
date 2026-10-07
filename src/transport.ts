/**
 * Punto de extensión para el envío del e-CF firmado a la DGII.
 *
 * La autenticación contra los servicios de la DGII (semilla, token), el envío
 * y la consulta de estado NO están incluidos en este starter. Implementa esta
 * interfaz según la documentación oficial de la DGII.
 */
export interface DgiiSubmissionResult {
  trackId: string;
}

export interface DgiiTransport {
  submit(signedXml: string): Promise<DgiiSubmissionResult>;
  getStatus(trackId: string): Promise<{ estado: string; mensajes: string[] }>;
}

export class NotImplementedTransport implements DgiiTransport {
  async submit(_signedXml: string): Promise<DgiiSubmissionResult> {
    throw new Error('Envío a la DGII no implementado en este starter. Implementa DgiiTransport.');
  }
  async getStatus(_trackId: string): Promise<{ estado: string; mensajes: string[] }> {
    throw new Error('Consulta de estado no implementada en este starter. Implementa DgiiTransport.');
  }
}
