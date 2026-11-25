import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  HelpCircle,
  RotateCcw,
  ShieldAlert,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { SanitaryAudio } from '../game/audio';
import { createProceduralTextures } from '../game/textures';
import { buildSanitaryRoom, HALF_L, HALF_W } from '../game/room';
import { buildSanitaryStations } from '../game/stations';
import { NonConformity, OperatorState, StationId, TargetInfo } from '../game/types';

const INITIAL_OPERATOR_STATE: OperatorState = {
  adornosRetirados: false,
  episVestidos: false,
  maosLavadas: false,
  maosSecas: false,
  alcoolAplicado: false,
  botasHigienizadas: false,
  portaAberta: false,
};

interface ToastFeedback {
  id: number;
  kind: 'info' | 'success' | 'warning';
  title: string;
  message: string;
}

function detectSoftwareGl(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

// Pre-allocated math scratch objects for zero GC inside render loop
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _move = new THREE.Vector3();
const _rayOrigin = new THREE.Vector2(0, 0);

export const SanitaryBarrierGame: React.FC = () => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // React UI state
  const [operator, setOperator] = useState<OperatorState>(INITIAL_OPERATOR_STATE);
  const [score, setScore] = useState<number>(100);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [nonConformities, setNonConformities] = useState<NonConformity[]>([]);
  const [targetInfo, setTargetInfo] = useState<TargetInfo | null>(null);
  const [toast, setToast] = useState<ToastFeedback | null>(null);
  const [auditOpen, setAuditOpen] = useState<boolean>(false);
  const [helpOpen, setHelpOpen] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(false);
  const [pointerLocked, setPointerLocked] = useState<boolean>(false);
  const [webglError, setWebglError] = useState<string | null>(null);

  // Mutable refs for 60fps loop access without re-mounting WebGL
  const operatorRef = useRef<OperatorState>({ ...INITIAL_OPERATOR_STATE });
  const scoreRef = useRef<number>(100);
  const elapsedRef = useRef<number>(0);
  const ncCodesRef = useRef<Set<string>>(new Set());
  const auditOpenRef = useRef<boolean>(false);
  const audioRef = useRef<SanitaryAudio | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const triggerStationAnimRef = useRef<(id: StationId) => void>(() => {});
  const resetPlayerPosRef = useRef<() => void>(() => {});

  const showToast = useCallback((kind: ToastFeedback['kind'], title: string, message: string) => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ id: Date.now(), kind, title, message });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 5800);
  }, []);

  const recordNonConformity = useCallback(
    (code: string, title: string, description: string, penalty: number) => {
      if (ncCodesRef.current.has(code)) {
        // Already logged this specific deviation in this shift
        audioRef.current?.playNonConformity();
        showToast('warning', `Não Conformidade (${code})`, description);
        return;
      }
      ncCodesRef.current.add(code);
      const nextScore = Math.max(0, scoreRef.current - penalty);
      scoreRef.current = nextScore;
      setScore(nextScore);

      const entry: NonConformity = {
        id: `${code}-${Date.now()}`,
        code,
        title,
        description,
        penalty,
        timestampSeconds: Math.floor(elapsedRef.current),
      };
      setNonConformities((prev) => [...prev, entry]);
      audioRef.current?.playNonConformity();
      showToast('warning', `${title} (−${penalty}%)`, description);
    },
    [showToast],
  );

  const finalizeAudit = useCallback(() => {
    if (auditOpenRef.current) return;
    auditOpenRef.current = true;
    setAuditOpen(true);

    if (document.pointerLockElement) {
      try {
        document.exitPointerLock();
      } catch {
        // Ignore
      }
    }

    const st = operatorRef.current;
    const pendingEntries: Array<{ code: string; title: string; desc: string; penalty: number }> = [];

    if (!st.adornosRetirados) {
      pendingEntries.push({
        code: 'PEND-ADORNOS',
        title: 'Adornos não retirados antes do acesso',
        desc: 'O operador cruzou para a área limpa mantendo relógio, aliança ou celular, gerando risco físico e microbiológico.',
        penalty: 20,
      });
    }
    if (!st.episVestidos) {
      pendingEntries.push({
        code: 'PEND-EPIS',
        title: 'Paramentação incompleta (EPIs ausentes)',
        desc: 'Acesso à produção sem touca, máscara, avental impermeável e botas brancas de PVC.',
        penalty: 20,
      });
    }
    if (!st.maosLavadas) {
      pendingEntries.push({
        code: 'PEND-LAVAGEM',
        title: 'Mãos não lavadas no lavatório',
        desc: 'O operador não executou a lavagem mecânica das mãos com água e sabonete antisséptico.',
        penalty: 20,
      });
    }
    if (!st.maosSecas) {
      pendingEntries.push({
        code: 'PEND-SECAGEM',
        title: 'Mãos não secas com papel toalha',
        desc: 'Secagem das mãos com papel toalha descartável não foi realizada antes da entrada.',
        penalty: 15,
      });
    }
    if (!st.alcoolAplicado) {
      pendingEntries.push({
        code: 'PEND-ALCOOL',
        title: 'Antissepsia com álcool em gel 70% omitida',
        desc: 'O operador deixou de aplicar álcool em gel 70% após a lavagem e secagem das mãos.',
        penalty: 20,
      });
    }
    if (!st.botasHigienizadas) {
      pendingEntries.push({
        code: 'PEND-BOTAS',
        title: 'Botas não higienizadas no lava-botas e pedilúvio',
        desc: 'O operador acessou a produção sem acionar o lava-botas automatizado e sanitizar os solados no pedilúvio.',
        penalty: 20,
      });
    }

    if (pendingEntries.length > 0) {
      let currentScore = scoreRef.current;
      const added: NonConformity[] = [];
      pendingEntries.forEach((p) => {
        if (!ncCodesRef.current.has(p.code)) {
          ncCodesRef.current.add(p.code);
          currentScore = Math.max(0, currentScore - p.penalty);
          added.push({
            id: `${p.code}-${Date.now()}`,
            code: p.code,
            title: p.title,
            description: p.desc,
            penalty: p.penalty,
            timestampSeconds: Math.floor(elapsedRef.current),
          });
        }
      });
      scoreRef.current = currentScore;
      setScore(currentScore);
      if (added.length > 0) {
        setNonConformities((prev) => [...prev, ...added]);
      }
      audioRef.current?.playNonConformity();
    } else if (ncCodesRef.current.size === 0) {
      audioRef.current?.playSuccessChime();
    } else {
      audioRef.current?.playClick(460);
    }
  }, []);

  const handleStationInteract = useCallback(
    (id: StationId) => {
      if (auditOpenRef.current) return;
      audioRef.current?.unlock();
      const st = operatorRef.current;

      switch (id) {
        case 'adornos': {
          if (st.adornosRetirados) {
            showToast('info', 'Adornos já guardados', 'Relógio, aliança e celular já estão armazenados.');
            audioRef.current?.playClick(500);
            return;
          }
          const next = { ...st, adornosRetirados: true };
          operatorRef.current = next;
          setOperator(next);
          audioRef.current?.playClick(620);
          showToast(
            'success',
            'Adornos retirados',
            'Relógio, aliança e celular guardados corretamente no compartimento.',
          );
          break;
        }

        case 'epis': {
          if (st.episVestidos) {
            showToast('info', 'EPIs já vestidos', 'Touca, máscara, avental e botas de PVC já equipados.');
            audioRef.current?.playClick(500);
            return;
          }
          const next = { ...st, episVestidos: true };
          operatorRef.current = next;
          setOperator(next);
          audioRef.current?.playEquipPpe();
          if (!st.adornosRetirados) {
            recordNonConformity(
              'NC-EPI-ADORNOS',
              'EPIs vestidos antes de retirar adornos',
              'Você vestiu os EPIs com adornos (relógio, aliança ou celular). Adornos devem ser removidos antes da paramentação para evitar contaminação física e microbiológica.',
              15,
            );
          } else {
            showToast(
              'success',
              'EPIs vestidos',
              'Touca descartável, máscara facial, avental impermeável e botas brancas de PVC equipados.',
            );
          }
          break;
        }

        case 'lavatorio': {
          triggerStationAnimRef.current('lavatorio');
          audioRef.current?.playWaterWash();
          const next = { ...st, maosLavadas: true };
          operatorRef.current = next;
          setOperator(next);
          showToast(
            'success',
            'Mãos lavadas com sabonete antisséptico',
            'Lavagem mecânica realizada. Seque completamente as mãos no dispenser de papel toalha ao lado.',
          );
          break;
        }

        case 'papel': {
          triggerStationAnimRef.current('papel');
          audioRef.current?.playPaperTowel();
          if (!st.maosLavadas) {
            recordNonConformity(
              'NC-PAPEL-SEM-LAVAR',
              'Secagem sem lavagem prévia das mãos',
              'Você utilizou o papel toalha sem antes lavar as mãos com água e sabonete antisséptico.',
              10,
            );
            return;
          }
          const next = { ...st, maosSecas: true };
          operatorRef.current = next;
          setOperator(next);
          showToast(
            'success',
            'Mãos secas com papel toalha',
            'Secagem concluída. Agora você pode aplicar o álcool em gel 70% para antissepsia.',
          );
          break;
        }

        case 'alcool': {
          triggerStationAnimRef.current('alcool');
          audioRef.current?.playAlcoholPump();
          const next = { ...st, alcoolAplicado: true };
          operatorRef.current = next;
          setOperator(next);

          if (!st.maosLavadas) {
            recordNonConformity(
              'NC-ALCOOL-ANTES-LAVAR',
              'Álcool em gel 70% antes da lavagem das mãos',
              'O álcool em gel 70% não substitui a lavagem mecânica com água e sabonete antisséptico e perde eficácia na presença de matéria orgânica e sujidade.',
              25,
            );
          } else if (!st.maosSecas) {
            recordNonConformity(
              'NC-ALCOOL-MAOS-MOLHADAS',
              'Álcool em gel 70% com as mãos molhadas',
              'Aplicar álcool em gel 70% sem secar as mãos com papel toalha dilui o princípio ativo abaixo da concentração eficaz, comprometendo a antissepsia.',
              15,
            );
          } else {
            showToast(
              'success',
              'Álcool em gel 70% aplicado',
              'Antissepsia das mãos realizada corretamente após lavagem e secagem.',
            );
          }
          break;
        }

        case 'lavabotas': {
          triggerStationAnimRef.current('lavabotas');
          audioRef.current?.playBootWasher();
          const next = { ...st, botasHigienizadas: true };
          operatorRef.current = next;
          setOperator(next);

          if (!st.episVestidos) {
            recordNonConformity(
              'NC-LAVABOTAS-SEM-EPI',
              'Lava-botas acionado sem botas de PVC e EPIs',
              'O lava-botas e pedilúvio foram acionados sem o operador estar paramentado com botas brancas de PVC e EPIs adequados.',
              15,
            );
          } else {
            showToast(
              'success',
              'Botas higienizadas no pedilúvio',
              'Escovas giratórias e solução sanitizante aplicadas nos solados e canos das botas.',
            );
          }
          break;
        }

        case 'quadro': {
          audioRef.current?.playClick(580);
          showToast(
            'info',
            'Quadro POP-01 — Ordem de Boas Práticas',
            '1) Retirar adornos · 2) Vestir EPIs · 3) Lavar e secar as mãos · 4) Álcool em gel 70% · 5) Lava-botas e pedilúvio.',
          );
          break;
        }

        case 'porta': {
          if (!st.portaAberta) {
            const next = { ...st, portaAberta: true };
            operatorRef.current = next;
            setOperator(next);
            audioRef.current?.playDoorSwing();
            showToast(
              'info',
              'Porta dupla aberta',
              'Caminhe através da porta para ingressar na Área de Produção de Embutidos e concluir a auditoria.',
            );
          } else {
            finalizeAudit();
          }
          break;
        }
      }
    },
    [finalizeAudit, recordNonConformity, showToast],
  );

  const handleRestartShift = useCallback(() => {
    operatorRef.current = { ...INITIAL_OPERATOR_STATE };
    scoreRef.current = 100;
    elapsedRef.current = 0;
    ncCodesRef.current.clear();
    auditOpenRef.current = false;

    setOperator({ ...INITIAL_OPERATOR_STATE });
    setScore(100);
    setElapsedSec(0);
    setNonConformities([]);
    setAuditOpen(false);
    setToast(null);
    resetPlayerPosRef.current();
    audioRef.current?.playClick(540);
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      if (audioRef.current) audioRef.current.muted = next;
      return next;
    });
  }, []);

  // Initialize Three.js Scene Once
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const audio = new SanitaryAudio();
    audioRef.current = audio;

    const isSoftwareGl = detectSoftwareGl();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError('Não foi possível inicializar o contexto WebGL 3D neste navegador.');
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe6eaec);
    scene.fog = new THREE.FogExp2(0xe6eaec, 0.016);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      64,
      (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight),
      0.08,
      40,
    );
    camera.rotation.order = 'YXZ';

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const textures = createProceduralTextures(maxAniso);

    const steelMat = new THREE.MeshPhysicalMaterial({
      color: 0xd8dee4,
      map: textures.steelAlbedo,
      roughnessMap: textures.steelRoughness,
      metalness: 0.9,
      roughness: 0.25,
      anisotropy: 0.75,
    });

    const room = buildSanitaryRoom(textures, steelMat, isSoftwareGl);
    scene.add(room.group);

    const stations = buildSanitaryStations(textures, steelMat);
    scene.add(stations.group);

    triggerStationAnimRef.current = stations.triggerActionAnimation;

    const allInteractables: THREE.Object3D[] = [...stations.interactables, room.boardProxy];

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Player First-Person State
    const playerPos = new THREE.Vector3(0, 1.64, 4.15);
    const playerVel = new THREE.Vector3(0, 0, 0);
    let yaw = 0; // 0 looks straight down -Z toward double doors
    let pitch = -0.04;
    let walkPhase = 0;

    resetPlayerPosRef.current = () => {
      playerPos.set(0, 1.64, 4.15);
      playerVel.set(0, 0, 0);
      yaw = 0;
      pitch = -0.04;
    };

    const keys = new Set<string>();
    const raycaster = new THREE.Raycaster();
    raycaster.far = 3.35;

    let currentHoveredId: StationId | null = null;
    let pointerLockBlocked = false;
    let isDragging = false;
    let dragMoved = false;
    let lastPtrX = 0;
    let lastPtrY = 0;
    let downX = 0;
    let downY = 0;

    const getTargetMeta = (id: StationId): TargetInfo => {
      const st = operatorRef.current;
      switch (id) {
        case 'adornos':
          return {
            id,
            title: 'Bancada e Armário de Adornos',
            actionLabel: st.adornosRetirados
              ? 'Adornos já guardados'
              : 'Clique ou [E] para retirar relógio, aliança e celular',
            completed: st.adornosRetirados,
          };
        case 'epis':
          return {
            id,
            title: 'Armário de EPIs',
            actionLabel: st.episVestidos
              ? 'EPIs já vestidos'
              : 'Clique ou [E] para vestir touca, máscara, avental e botas',
            completed: st.episVestidos,
          };
        case 'lavatorio':
          return {
            id,
            title: 'Lavatório Automático e Sabonete',
            actionLabel: st.maosLavadas
              ? 'Clique ou [E] para lavar as mãos novamente'
              : 'Clique ou [E] para acionar sensor e lavar as mãos',
            completed: st.maosLavadas,
          };
        case 'papel':
          return {
            id,
            title: 'Dispenser de Papel Toalha',
            actionLabel: st.maosSecas
              ? 'Clique ou [E] para secar as mãos novamente'
              : 'Clique ou [E] para puxar papel toalha e secar as mãos',
            completed: st.maosSecas,
          };
        case 'alcool':
          return {
            id,
            title: 'Dispenser de Álcool em Gel 70%',
            actionLabel: st.alcoolAplicado
              ? 'Clique ou [E] para aplicar álcool em gel 70% novamente'
              : 'Clique ou [E] para aplicar álcool em gel 70%',
            completed: st.alcoolAplicado,
          };
        case 'lavabotas':
          return {
            id,
            title: 'Pedilúvio e Lava-Botas Automatizado',
            actionLabel: st.botasHigienizadas
              ? 'Clique ou [E] para acionar lava-botas novamente'
              : 'Clique ou [E] para acionar escovas e higienizar as botas',
            completed: st.botasHigienizadas,
          };
        case 'quadro':
          return {
            id,
            title: 'Quadro de Boas Práticas (BPF)',
            actionLabel: 'Clique ou [E] para consultar resumo do POP-01',
          };
        case 'porta':
          return {
            id,
            title: 'Porta Dupla — Produção de Embutidos',
            actionLabel: st.portaAberta
              ? 'Cruze a porta para concluir a auditoria'
              : 'Clique ou [E] para abrir a porta da produção',
            completed: st.portaAberta,
          };
      }
    };

    const canvasEl = renderer.domElement;

    const onKeyDown = (e: KeyboardEvent) => {
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)
      ) {
        e.preventDefault();
      }
      keys.add(e.code);
      if ((e.code === 'KeyE' || e.code === 'Enter') && currentHoveredId && !auditOpenRef.current) {
        handleStationInteract(currentHoveredId);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.code);
    };

    const onPointerLockChange = () => {
      const locked = document.pointerLockElement === canvasEl;
      setPointerLocked(locked);
    };

    const onPointerLockError = () => {
      pointerLockBlocked = true;
      setPointerLocked(false);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (auditOpenRef.current) return;
      audio.unlock();
      if (e.button !== 0) return;
      isDragging = true;
      dragMoved = false;
      lastPtrX = e.clientX;
      lastPtrY = e.clientY;
      downX = e.clientX;
      downY = e.clientY;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (auditOpenRef.current) return;
      const sensitivity = 0.0022;
      if (document.pointerLockElement === canvasEl) {
        yaw -= e.movementX * sensitivity;
        pitch = THREE.MathUtils.clamp(
          pitch - e.movementY * sensitivity,
          -Math.PI * 0.43,
          Math.PI * 0.43,
        );
      } else if (isDragging) {
        const dx = e.clientX - lastPtrX;
        const dy = e.clientY - lastPtrY;
        lastPtrX = e.clientX;
        lastPtrY = e.clientY;
        if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) {
          dragMoved = true;
        }
        yaw -= dx * sensitivity * 1.35;
        pitch = THREE.MathUtils.clamp(
          pitch - dy * sensitivity * 1.35,
          -Math.PI * 0.43,
          Math.PI * 0.43,
        );
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const wasClick = !dragMoved;
      isDragging = false;
      if (auditOpenRef.current) return;

      if (document.pointerLockElement === canvasEl) {
        if (currentHoveredId) {
          handleStationInteract(currentHoveredId);
        }
      } else if (wasClick) {
        if (currentHoveredId) {
          handleStationInteract(currentHoveredId);
        } else if (!pointerLockBlocked && canvasEl.requestPointerLock) {
          try {
            const res = canvasEl.requestPointerLock() as unknown as Promise<void> | undefined;
            if (res && typeof res.catch === 'function') {
              res.catch(() => {
                pointerLockBlocked = true;
              });
            }
          } catch {
            pointerLockBlocked = true;
          }
        }
      }
    };

    const onBlur = () => {
      keys.clear();
      isDragging = false;
    };

    const onContextLost = (e: Event) => {
      e.preventDefault();
    };

    const onResize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('resize', onResize);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    document.addEventListener('pointerlockerror', onPointerLockError);
    canvasEl.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    canvasEl.addEventListener('webglcontextlost', onContextLost);

    // Circle-vs-AABB horizontal collision resolver
    const playerRadius = 0.31;
    const resolveCollisions = (x: number, z: number): [number, number] => {
      let rx = x;
      let rz = z;
      const doorOpen = operatorRef.current.portaAberta;
      const minZRoom = doorOpen ? -HALF_L - 0.6 : -HALF_L + playerRadius + 0.08;
      rx = THREE.MathUtils.clamp(rx, -HALF_W + playerRadius + 0.06, HALF_W - playerRadius - 0.06);
      rz = THREE.MathUtils.clamp(rz, minZRoom, HALF_L - playerRadius - 0.08);

      // Keep doorway side walls solid even when door is open
      if (rz < -HALF_L + playerRadius + 0.08 && Math.abs(rx) > 0.62) {
        rz = -HALF_L + playerRadius + 0.08;
      }

      for (let i = 0; i < stations.colliders.length; i++) {
        const box = stations.colliders[i];
        const closestX = THREE.MathUtils.clamp(rx, box.minX, box.maxX);
        const closestZ = THREE.MathUtils.clamp(rz, box.minZ, box.maxZ);
        const dx = rx - closestX;
        const dz = rz - closestZ;
        const distSq = dx * dx + dz * dz;
        if (distSq < playerRadius * playerRadius) {
          const dist = Math.sqrt(distSq);
          if (dist > 0.0001) {
            const overlap = playerRadius - dist;
            rx += (dx / dist) * overlap;
            rz += (dz / dist) * overlap;
          } else {
            rx += playerRadius;
          }
        }
      }
      return [rx, rz];
    };

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let frameId = 0;
    let disposed = false;
    let lastTime = performance.now();
    let totalElapsed = 0;
    let lastHudSec = -1;
    let lastHoverReport: string | null = null;
    let rayAccum = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) return;
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    }

    function tick() {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min(0.08, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      totalElapsed += dt;

      if (!auditOpenRef.current) {
        elapsedRef.current += dt;
        const wholeSec = Math.floor(elapsedRef.current);
        if (wholeSec !== lastHudSec) {
          lastHudSec = wholeSec;
          setElapsedSec(wholeSec);
        }

        // Compute horizontal camera axes from yaw
        _forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
        _right.set(Math.cos(yaw), 0, -Math.sin(yaw));
        _move.set(0, 0, 0);

        if (keys.has('KeyW') || keys.has('ArrowUp')) _move.add(_forward);
        if (keys.has('KeyS') || keys.has('ArrowDown')) _move.sub(_forward);
        if (keys.has('KeyD') || keys.has('ArrowRight')) _move.add(_right);
        if (keys.has('KeyA') || keys.has('ArrowLeft')) _move.sub(_right);

        if (_move.lengthSq() > 0) {
          _move.normalize();
        }

        const moveSpeed = 2.85;
        playerVel.x = THREE.MathUtils.damp(playerVel.x, _move.x * moveSpeed, 12, dt);
        playerVel.z = THREE.MathUtils.damp(playerVel.z, _move.z * moveSpeed, 12, dt);

        const nextX = playerPos.x + playerVel.x * dt;
        const nextZ = playerPos.z + playerVel.z * dt;
        const [resolvedX, resolvedZ] = resolveCollisions(nextX, nextZ);
        playerPos.x = resolvedX;
        playerPos.z = resolvedZ;

        const speedMag = Math.hypot(playerVel.x, playerVel.z);
        if (speedMag > 0.15 && !reducedMotion) {
          walkPhase += dt * speedMag * 3.1;
          playerPos.y = 1.64 + Math.sin(walkPhase) * 0.014;
        } else {
          playerPos.y = THREE.MathUtils.damp(playerPos.y, 1.64, 10, dt);
        }

        // Trigger Audit Report automatically when crossing through the open production double door
        if (operatorRef.current.portaAberta && playerPos.z <= -HALF_L + 0.15) {
          finalizeAudit();
        }
      }

      camera.position.copy(playerPos);
      camera.rotation.y = yaw;
      camera.rotation.x = pitch;

      // Update station animations (damped door hinges, water stream, spinning brushes)
      stations.updateAnimations(dt, totalElapsed, operatorRef.current);

      // Center-reticle raycast (throttled ~20Hz for smooth performance)
      rayAccum += dt;
      if (rayAccum >= 0.05) {
        rayAccum = 0;
        if (auditOpenRef.current) {
          if (lastHoverReport !== null) {
            lastHoverReport = null;
            currentHoveredId = null;
            setTargetInfo(null);
          }
        } else {
          raycaster.setFromCamera(_rayOrigin, camera);
          const hits = raycaster.intersectObjects(allInteractables, false);
          const hitId = hits.length > 0 ? (hits[0].object.userData.stationId as StationId) : null;
          currentHoveredId = hitId;
          const meta = hitId ? getTargetMeta(hitId) : null;
          const signature = meta ? `${meta.id}:${meta.completed ? '1' : '0'}` : null;
          if (signature !== lastHoverReport) {
            lastHoverReport = signature;
            setTargetInfo(meta);
          }
        }
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    if (isSoftwareGl) {
      renderer.render(scene, camera);
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }

      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      document.removeEventListener('pointerlockerror', onPointerLockError);
      canvasEl.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      canvasEl.removeEventListener('webglcontextlost', onContextLost);

      room.dispose();
      stations.dispose();
      steelMat.dispose();
      textures.dispose();
      envTarget.dispose();
      audio.dispose();
      renderer.dispose();
      if (canvasEl.parentNode === container) {
        container.removeChild(canvasEl);
      }
    };
  }, [finalizeAudit, handleStationInteract]);

  const statusChips: Array<{ key: keyof OperatorState; label: string }> = [
    { key: 'adornosRetirados', label: 'Adornos' },
    { key: 'episVestidos', label: 'EPIs' },
    { key: 'maosLavadas', label: 'Lavar mãos' },
    { key: 'maosSecas', label: 'Secar mãos' },
    { key: 'alcoolAplicado', label: 'Álcool 70%' },
    { key: 'botasHigienizadas', label: 'Lava-botas' },
  ];

  const allCompleted =
    operator.adornosRetirados &&
    operator.episVestidos &&
    operator.maosLavadas &&
    operator.maosSecas &&
    operator.alcoolAplicado &&
    operator.botasHigienizadas;

  const isFullyCompliant = allCompleted && nonConformities.length === 0;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-200">
      {/* Dedicated WebGL Mount Container */}
      <div
        ref={mountRef}
        className="w-full h-full cursor-crosshair"
        aria-label="Cenário 3D da Barreira Sanitária POP-01"
      />

      {webglError && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-100 p-6">
          <div className="max-w-md rounded-xl border border-slate-300 bg-white p-6 text-slate-900 shadow-sm">
            <h2 className="text-lg font-semibold">Contexto 3D indisponível</h2>
            <p className="mt-2 text-sm text-slate-600">{webglError}</p>
          </div>
        </div>
      )}

      {/* Top HUD Bar (Compact, Clean Industrial Palette, Zero backdrop-filter) */}
      <header className="pointer-events-none absolute top-4 left-4 right-4 z-20 flex flex-wrap items-start justify-between gap-3">
        <div
          className="pointer-events-auto flex flex-wrap items-center gap-4 rounded-xl border border-slate-300/90 px-4 py-2.5 shadow-sm"
          style={{ backgroundColor: 'rgba(248, 250, 252, 0.93)' }}
        >
          <div>
            <div className="text-sm font-bold tracking-tight text-slate-900 whitespace-nowrap">
              Barreira Sanitária POP-01
            </div>
            <div className="text-xs text-slate-500 whitespace-nowrap">
              Indústria de Embutidos · Acesso Livre
            </div>
          </div>

          <div className="h-7 w-px bg-slate-200 hidden sm:block" aria-hidden="true" />

          <div className="flex items-center gap-5 text-xs">
            <div>
              <span className="text-slate-500 block">Conformidade</span>
              <span
                className={`font-mono-tabular text-sm font-semibold ${
                  score >= 85
                    ? 'text-emerald-700'
                    : score >= 60
                      ? 'text-amber-700'
                      : 'text-red-700'
                }`}
              >
                {score}%
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Tempo</span>
              <span className="font-mono-tabular text-sm font-semibold text-slate-900">
                {formatClock(elapsedSec)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Não conformidades</span>
              <span
                className={`font-mono-tabular text-sm font-semibold ${
                  nonConformities.length === 0 ? 'text-slate-900' : 'text-red-700'
                }`}
              >
                {nonConformities.length}
              </span>
            </div>
          </div>
        </div>

        {/* Top-Right Compact Controls */}
        <div
          className="pointer-events-auto flex items-center gap-1.5 rounded-xl border border-slate-300/90 p-1.5 shadow-sm"
          style={{ backgroundColor: 'rgba(248, 250, 252, 0.93)' }}
        >
          <button
            type="button"
            onClick={toggleMute}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200/70 transition-colors whitespace-nowrap"
            title={muted ? 'Ativar áudio' : 'Silenciar áudio'}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            <span className="hidden md:inline">{muted ? 'Mudo' : 'Áudio'}</span>
          </button>

          <button
            type="button"
            onClick={() => setHelpOpen((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              helpOpen
                ? 'bg-slate-800 text-white'
                : 'text-slate-700 hover:bg-slate-200/70'
            }`}
          >
            <HelpCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Controles</span>
          </button>

          <button
            type="button"
            onClick={handleRestartShift}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reiniciar</span>
          </button>
        </div>
      </header>

      {/* Non-Conformity / Action Toast Notification */}
      {toast && !auditOpen && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-auto absolute top-22 left-1/2 -translate-x-1/2 z-30 w-[min(560px,92vw)] rounded-xl border px-4 py-3 shadow-md"
          style={{
            backgroundColor:
              toast.kind === 'warning'
                ? 'rgba(254, 242, 242, 0.96)'
                : toast.kind === 'success'
                  ? 'rgba(236, 253, 245, 0.96)'
                  : 'rgba(248, 250, 252, 0.96)',
            borderColor:
              toast.kind === 'warning'
                ? '#fca5a5'
                : toast.kind === 'success'
                  ? '#6ee7b7'
                  : '#cbd5e1',
          }}
        >
          <div className="flex items-start gap-3">
            {toast.kind === 'warning' ? (
              <ShieldAlert className="h-5 w-5 shrink-0 text-red-700 mt-0.5" />
            ) : toast.kind === 'success' ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700 mt-0.5" />
            ) : (
              <ClipboardCheck className="h-5 w-5 shrink-0 text-sky-700 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <div
                className={`text-sm font-semibold ${
                  toast.kind === 'warning'
                    ? 'text-red-900'
                    : toast.kind === 'success'
                      ? 'text-emerald-950'
                      : 'text-slate-900'
                }`}
              >
                {toast.title}
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-700">{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="rounded-md p-1 text-slate-500 hover:bg-black/5 hover:text-slate-800"
              aria-label="Fechar aviso"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Help / Controls Popover */}
      {helpOpen && !auditOpen && (
        <div
          className="pointer-events-auto absolute top-20 right-4 z-30 w-80 rounded-xl border border-slate-300 p-4 shadow-md"
          style={{ backgroundColor: 'rgba(248, 250, 252, 0.96)' }}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Controles de Navegação</h3>
            <button
              type="button"
              onClick={() => setHelpOpen(false)}
              className="rounded p-1 text-slate-500 hover:bg-slate-200/60"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <dl className="mt-3 space-y-2 text-xs text-slate-700">
            <div className="flex justify-between gap-3">
              <dt className="font-semibold text-slate-900">WASD / Setas</dt>
              <dd className="text-right">Caminhar pela sala</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="font-semibold text-slate-900">Mouse / Arrastar</dt>
              <dd className="text-right">Olhar ao redor</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="font-semibold text-slate-900">Clique na mira / [E]</dt>
              <dd className="text-right">Interagir com equipamento</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="font-semibold text-slate-900">Esc</dt>
              <dd className="text-right">Liberar cursor travado</dd>
            </div>
          </dl>
          <p className="mt-3 border-t border-slate-200 pt-2.5 text-[11px] leading-relaxed text-slate-600">
            Você tem liberdade total para escolher a ordem das ações e testar o impacto sanitário de cada decisão.
          </p>
        </div>
      )}

      {/* Center Reticle & Equipment Context Legend */}
      {!auditOpen && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="relative flex flex-col items-center">
            <div
              className={`h-4 w-4 rounded-full border-2 transition-transform duration-150 ${
                targetInfo
                  ? 'scale-125 border-sky-600 bg-sky-500/20'
                  : 'border-slate-700/75 bg-white/30'
              }`}
            />
            {targetInfo && (
              <div
                className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-center shadow-sm"
                style={{ backgroundColor: 'rgba(248, 250, 252, 0.94)' }}
              >
                <div className="text-xs font-semibold text-slate-900 whitespace-nowrap">
                  {targetInfo.title}
                </div>
                <div className="text-[11px] text-slate-600 whitespace-nowrap">
                  {targetInfo.actionLabel}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Compact Operator Status Strip */}
      {!auditOpen && (
        <footer className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-20 max-w-[95vw]">
          <div
            className="pointer-events-auto flex flex-wrap items-center justify-center gap-1.5 rounded-xl border border-slate-300/90 px-3 py-2 shadow-sm"
            style={{ backgroundColor: 'rgba(248, 250, 252, 0.93)' }}
          >
            {statusChips.map((chip) => {
              const done = operator[chip.key];
              return (
                <div
                  key={chip.key}
                  className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
                    done
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {done ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                  ) : (
                    <span
                      className="h-2.5 w-2.5 rounded-full border border-slate-400 shrink-0"
                      aria-hidden="true"
                    />
                  )}
                  <span>{chip.label}</span>
                </div>
              );
            })}
            <span className="hidden lg:inline-block pl-2 text-[11px] text-slate-500 whitespace-nowrap">
              {pointerLocked
                ? 'WASD/Setas · Clique para interagir · Esc libera cursor'
                : 'WASD/Setas · Arraste para olhar · Clique ou [E] na mira'}
            </span>
          </div>
        </footer>
      )}

      {/* Relatório de Auditoria (Audit Report Modal on Door Entry) */}
      {auditOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.62)' }}
        >
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-300 bg-white p-6 text-slate-900 shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <p className="text-xs font-semibold text-slate-500">
                  Auditoria Sanitária · POP-01 · Área de Embutidos
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  {isFullyCompliant
                    ? 'Acesso Liberado em Conformidade'
                    : 'Acesso Registrado com Não Conformidades'}
                </h2>
              </div>
              <div
                className={`rounded-lg border px-3 py-1.5 text-right ${
                  isFullyCompliant
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : 'border-red-300 bg-red-50 text-red-800'
                }`}
              >
                <div className="text-[11px] font-medium">Nota Final</div>
                <div className="font-mono-tabular text-lg font-bold">{score}%</div>
              </div>
            </div>

            {/* Summary Metrics */}
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs text-slate-500">Tempo de Barreira</div>
                <div className="mt-0.5 font-mono-tabular text-base font-semibold text-slate-900">
                  {formatClock(elapsedSec)}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs text-slate-500">Etapas Concluídas</div>
                <div className="mt-0.5 font-mono-tabular text-base font-semibold text-slate-900">
                  {statusChips.filter((c) => operator[c.key]).length} / {statusChips.length}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs text-slate-500">Não Conformidades</div>
                <div
                  className={`mt-0.5 font-mono-tabular text-base font-semibold ${
                    nonConformities.length === 0 ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  {nonConformities.length}
                </div>
              </div>
            </div>

            {/* Checklist */}
            <div className="mt-5">
              <h3 className="text-xs font-semibold text-slate-500">
                Verificação de Etapas do Operador
              </h3>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {statusChips.map((chip) => {
                  const ok = operator[chip.key];
                  return (
                    <div
                      key={chip.key}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${
                        ok
                          ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
                          : 'border-red-200 bg-red-50/70 text-red-900'
                      }`}
                    >
                      {ok ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-700 shrink-0" />
                      )}
                      <span>{chip.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Non-Conformity Technical Log */}
            <div className="mt-5">
              <h3 className="text-xs font-semibold text-slate-500">
                Registro Técnico de Desvios
              </h3>
              {nonConformities.length === 0 ? (
                <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                  Nenhuma não conformidade registrada. Todas as etapas de retirada de adornos,
                  paramentação, lavagem/secagem das mãos, antissepsia com álcool em gel 70% e
                  higienização de botas foram executadas na sequência sanitária correta.
                </div>
              ) : (
                <ul className="mt-2 space-y-2.5">
                  {nonConformities.map((nc) => (
                    <li
                      key={nc.id}
                      className="rounded-lg border border-red-200 bg-red-50/60 p-3.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-red-950">{nc.title}</span>
                        <span className="font-mono-tabular font-semibold text-red-700 shrink-0">
                          −{nc.penalty}% · {formatClock(nc.timestampSeconds)}
                        </span>
                      </div>
                      <p className="mt-1 leading-relaxed text-slate-700">{nc.description}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Action Footer */}
            <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={handleRestartShift}
                className="flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Reiniciar Turno</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
