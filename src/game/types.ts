export type StationId =
  | 'adornos'
  | 'epis'
  | 'lavatorio'
  | 'papel'
  | 'alcool'
  | 'lavabotas'
  | 'porta'
  | 'quadro';

export interface OperatorState {
  adornosRetirados: boolean;
  episVestidos: boolean;
  maosLavadas: boolean;
  maosSecas: boolean;
  alcoolAplicado: boolean;
  botasHigienizadas: boolean;
  portaAberta: boolean;
}

export interface NonConformity {
  id: string;
  code: string;
  title: string;
  description: string;
  penalty: number;
  timestampSeconds: number;
}

export interface TargetInfo {
  id: StationId;
  title: string;
  actionLabel: string;
  completed?: boolean;
}

export interface ColliderBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}
