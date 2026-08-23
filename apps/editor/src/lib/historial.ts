export interface Comando {
  descripcion: string;
  do: () => void;
  undo: () => void;
}

interface PilaHoja {
  deshacer: Comando[];
  rehacer: Comando[];
}

export class Historial {
  private pilas = new Map<string, PilaHoja>();
  private activa = "";
  private readonly LIMITE = 100;

  /** Cambia la hoja activa para los próximos deshacer/rehacer/ejecutar */
  usar(hojaId: string): void {
    this.activa = hojaId;
    if (!this.pilas.has(hojaId)) {
      this.pilas.set(hojaId, { deshacer: [], rehacer: [] });
    }
  }

  private pila(id = this.activa): PilaHoja {
    let p = this.pilas.get(id);
    if (!p) {
      p = { deshacer: [], rehacer: [] };
      this.pilas.set(id, p);
    }
    return p;
  }

  /** Ejecuta un comando en la hoja indicada (default: activa) */
  ejecutar(cmd: Comando, hojaId?: string): void {
    const target = hojaId ?? this.activa;
    const p = this.pila(target);
    cmd.do();
    p.deshacer.push(cmd);
    if (p.deshacer.length > this.LIMITE) p.deshacer.shift();
    p.rehacer = [];
  }

  /** Deshace el último comando de la hoja ACTIVA */
  deshacer(): Comando | null {
    const p = this.pila();
    const cmd = p.deshacer.pop();
    if (!cmd) return null;
    cmd.undo();
    p.rehacer.push(cmd);
    return cmd;
  }

  /** Rehace el último deshecho de la hoja ACTIVA */
  rehacer(): Comando | null {
    const p = this.pila();
    const cmd = p.rehacer.pop();
    if (!cmd) return null;
    cmd.do();
    p.deshacer.push(cmd);
    return cmd;
  }

  /** Limpia la pila de una hoja (sin arg = todas) */
  limpiar(hojaId?: string): void {
    if (hojaId) {
      this.pilas.delete(hojaId);
    } else {
      this.pilas.clear();
    }
  }

  /** Elimina las pilas de una hoja al borrarla del proyecto */
  eliminarHoja(hojaId: string): void {
    this.pilas.delete(hojaId);
  }

  get puedeDeshacer(): boolean {
    return this.pila().deshacer.length > 0;
  }

  get puedeRehacer(): boolean {
    return this.pila().rehacer.length > 0;
  }
}
