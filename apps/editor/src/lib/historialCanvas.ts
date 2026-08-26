export interface ComandoCanvas {
  descripcion: string;
  do: () => void;
  undo: () => void;
}

/**
 * Historial de Undo/Redo para el editor de geometría de símbolos.
 * Simplificado respecto a historial.ts: una sola pila (sin multi-hoja),
 * se resetea al cambiar de símbolo y se vacía tras guardar.
 */
export class HistorialCanvas {
  private deshacer: ComandoCanvas[] = [];
  private rehacer: ComandoCanvas[] = [];
  private readonly LIMITE = 100;

  ejecutar(cmd: ComandoCanvas): void {
    cmd.do();
    this.deshacer.push(cmd);
    if (this.deshacer.length > this.LIMITE) this.deshacer.shift();
    this.rehacer = [];
  }

  deshacerFn(): ComandoCanvas | null {
    const cmd = this.deshacer.pop();
    if (!cmd) return null;
    cmd.undo();
    this.rehacer.push(cmd);
    return cmd;
  }

  rehacerFn(): ComandoCanvas | null {
    const cmd = this.rehacer.pop();
    if (!cmd) return null;
    cmd.do();
    this.deshacer.push(cmd);
    return cmd;
  }

  limpiar(): void {
    this.deshacer = [];
    this.rehacer = [];
  }

  get puedeDeshacer(): boolean {
    return this.deshacer.length > 0;
  }

  get puedeRehacer(): boolean {
    return this.rehacer.length > 0;
  }
}

export const historialCanvas = new HistorialCanvas();
