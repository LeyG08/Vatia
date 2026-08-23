export interface Comando {
  descripcion: string;
  do: () => void;
  undo: () => void;
}

const LIMITE = 100;

export class Historial {
  private deshacerPila: Comando[] = [];
  private rehacerPila: Comando[] = [];

  ejecutar(cmd: Comando): void {
    cmd.do();
    this.deshacerPila.push(cmd);
    if (this.deshacerPila.length > LIMITE) this.deshacerPila.shift();
    this.rehacerPila = [];
  }

  deshacer(): Comando | null {
    const cmd = this.deshacerPila.pop();
    if (!cmd) return null;
    cmd.undo();
    this.rehacerPila.push(cmd);
    return cmd;
  }

  rehacer(): Comando | null {
    const cmd = this.rehacerPila.pop();
    if (!cmd) return null;
    cmd.do();
    this.deshacerPila.push(cmd);
    return cmd;
  }

  limpiar(): void {
    this.deshacerPila = [];
    this.rehacerPila = [];
  }

  get puedeDeshacer(): boolean {
    return this.deshacerPila.length > 0;
  }

  get puedeRehacer(): boolean {
    return this.rehacerPila.length > 0;
  }
}
