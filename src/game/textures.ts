import * as THREE from 'three';

export interface ProceduralTextureSet {
  wallAlbedo: THREE.CanvasTexture;
  wallRoughness: THREE.CanvasTexture;
  wallBump: THREE.CanvasTexture;
  floorAlbedo: THREE.CanvasTexture;
  floorRoughness: THREE.CanvasTexture;
  floorBump: THREE.CanvasTexture;
  steelAlbedo: THREE.CanvasTexture;
  steelRoughness: THREE.CanvasTexture;
  bpfBoard: THREE.CanvasTexture;
  doorSign: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  stationSigns: Record<string, THREE.CanvasTexture>;
  dispose: () => void;
}

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function createLabelTexture(
  title: string,
  subtitle: string,
  accentColor: string,
  maxAniso: number,
  width = 512,
  height = 192,
): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(width, height);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, width, height);

  // Clean stainless border frame
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, width - 12, height - 12);

  // Top accent bar
  ctx.fillStyle = accentColor;
  ctx.fillRect(14, 14, width - 28, 14);

  // Title
  ctx.fillStyle = '#0f172a';
  ctx.font = '700 34px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, width / 2, height * 0.46);

  // Subtitle
  ctx.fillStyle = '#475569';
  ctx.font = '500 22px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(subtitle, width / 2, height * 0.74);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  const aniso = Math.max(1, maxAnisotropy);
  const allTextures: THREE.Texture[] = [];

  // 1. Insulated Sandwich Panel Walls (NO tiles, NO grout — satin ice-white/cream with discrete vertical seams)
  const [wallColCan, wallColCtx] = makeCanvas(512, 512);
  wallColCtx.fillStyle = '#eff1ed';
  wallColCtx.fillRect(0, 0, 512, 512);
  // Subtle micro-lacquer variation
  for (let i = 0; i < 1800; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 236 + Math.floor(Math.random() * 8);
    wallColCtx.fillStyle = `rgb(${v},${v + 1},${v - 2})`;
    wallColCtx.fillRect(x, y, 2, 2);
  }
  // Discrete vertical panel joint (1 joint per repeat tile)
  wallColCtx.fillStyle = 'rgba(148, 158, 165, 0.35)';
  wallColCtx.fillRect(0, 0, 3, 512);
  wallColCtx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  wallColCtx.fillRect(3, 0, 2, 512);

  const wallAlbedo = new THREE.CanvasTexture(wallColCan);
  wallAlbedo.colorSpace = THREE.SRGBColorSpace;
  wallAlbedo.wrapS = THREE.RepeatWrapping;
  wallAlbedo.wrapT = THREE.ClampToEdgeWrapping;
  wallAlbedo.anisotropy = aniso;
  allTextures.push(wallAlbedo);

  const [wallRoughCan, wallRoughCtx] = makeCanvas(512, 512);
  wallRoughCtx.fillStyle = 'rgb(112,112,112)'; // ~0.44 satin finish
  wallRoughCtx.fillRect(0, 0, 512, 512);
  wallRoughCtx.fillStyle = 'rgb(190,190,190)';
  wallRoughCtx.fillRect(0, 0, 4, 512);
  const wallRoughness = new THREE.CanvasTexture(wallRoughCan);
  wallRoughness.wrapS = THREE.RepeatWrapping;
  wallRoughness.wrapT = THREE.ClampToEdgeWrapping;
  wallRoughness.anisotropy = aniso;
  allTextures.push(wallRoughness);

  const [wallBumpCan, wallBumpCtx] = makeCanvas(512, 512);
  wallBumpCtx.fillStyle = 'rgb(138,138,138)';
  wallBumpCtx.fillRect(0, 0, 512, 512);
  // Subtle recessed vertical seam
  wallBumpCtx.fillStyle = 'rgb(65,65,65)';
  wallBumpCtx.fillRect(0, 0, 3, 512);
  const wallBump = new THREE.CanvasTexture(wallBumpCan);
  wallBump.wrapS = THREE.RepeatWrapping;
  wallBump.wrapT = THREE.ClampToEdgeWrapping;
  wallBump.anisotropy = aniso;
  allTextures.push(wallBump);

  // 2. Monolithic Light-Gray Anti-Slip Epoxy Resin Floor (zero grout, subtle mineral quartz fleck)
  const [floorColCan, floorColCtx] = makeCanvas(512, 512);
  floorColCtx.fillStyle = '#c4c9cc';
  floorColCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 6500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const sz = Math.random() > 0.85 ? 2 : 1;
    const tone = Math.random();
    if (tone < 0.35) floorColCtx.fillStyle = 'rgba(155, 162, 168, 0.42)';
    else if (tone < 0.75) floorColCtx.fillStyle = 'rgba(218, 223, 226, 0.45)';
    else floorColCtx.fillStyle = 'rgba(130, 138, 144, 0.25)';
    floorColCtx.fillRect(x, y, sz, sz);
  }
  const floorAlbedo = new THREE.CanvasTexture(floorColCan);
  floorAlbedo.colorSpace = THREE.SRGBColorSpace;
  floorAlbedo.wrapS = THREE.RepeatWrapping;
  floorAlbedo.wrapT = THREE.RepeatWrapping;
  floorAlbedo.repeat.set(5, 9);
  floorAlbedo.anisotropy = aniso;
  allTextures.push(floorAlbedo);

  const [floorRoughCan, floorRoughCtx] = makeCanvas(512, 512);
  floorRoughCtx.fillStyle = 'rgb(120,120,120)'; // satin-matte ~0.47
  floorRoughCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const g = 98 + Math.floor(Math.random() * 56);
    floorRoughCtx.fillStyle = `rgb(${g},${g},${g})`;
    floorRoughCtx.fillRect(x, y, 2, 2);
  }
  const floorRoughness = new THREE.CanvasTexture(floorRoughCan);
  floorRoughness.wrapS = THREE.RepeatWrapping;
  floorRoughness.wrapT = THREE.RepeatWrapping;
  floorRoughness.repeat.set(5, 9);
  floorRoughness.anisotropy = aniso;
  allTextures.push(floorRoughness);

  const [floorBumpCan, floorBumpCtx] = makeCanvas(512, 512);
  floorBumpCtx.fillStyle = 'rgb(128,128,128)';
  floorBumpCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 7000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 112 + Math.floor(Math.random() * 34);
    floorBumpCtx.fillStyle = `rgb(${v},${v},${v})`;
    floorBumpCtx.fillRect(x, y, 2, 2);
  }
  const floorBump = new THREE.CanvasTexture(floorBumpCan);
  floorBump.wrapS = THREE.RepeatWrapping;
  floorBump.wrapT = THREE.RepeatWrapping;
  floorBump.repeat.set(5, 9);
  floorBump.anisotropy = aniso;
  allTextures.push(floorBump);

  // 3. Brushed Stainless Steel Texture (fine directional grain)
  const [steelColCan, steelColCtx] = makeCanvas(512, 512);
  steelColCtx.fillStyle = '#cdd3d8';
  steelColCtx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 1) {
    const lum = 196 + Math.floor((Math.random() - 0.5) * 18);
    steelColCtx.fillStyle = `rgb(${lum},${lum + 3},${lum + 6})`;
    steelColCtx.fillRect(0, y, 512, 1);
  }
  for (let i = 0; i < 450; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const w = 40 + Math.random() * 180;
    const alpha = 0.05 + Math.random() * 0.08;
    steelColCtx.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(110,120,130,${alpha})`;
    steelColCtx.fillRect(x, y, w, 1);
  }
  const steelAlbedo = new THREE.CanvasTexture(steelColCan);
  steelAlbedo.colorSpace = THREE.SRGBColorSpace;
  steelAlbedo.wrapS = THREE.RepeatWrapping;
  steelAlbedo.wrapT = THREE.RepeatWrapping;
  steelAlbedo.anisotropy = aniso;
  allTextures.push(steelAlbedo);

  const [steelRoughCan, steelRoughCtx] = makeCanvas(512, 512);
  steelRoughCtx.fillStyle = 'rgb(74,74,74)';
  steelRoughCtx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y++) {
    const g = 60 + Math.floor(Math.random() * 34);
    steelRoughCtx.fillStyle = `rgb(${g},${g},${g})`;
    steelRoughCtx.fillRect(0, y, 512, 1);
  }
  const steelRoughness = new THREE.CanvasTexture(steelRoughCan);
  steelRoughness.wrapS = THREE.RepeatWrapping;
  steelRoughness.wrapT = THREE.RepeatWrapping;
  steelRoughness.anisotropy = aniso;
  allTextures.push(steelRoughness);

  // 4. Quadro Informativo de Boas Práticas de Fabricação (BPF / POP-01)
  const [bpfCan, bpfCtx] = makeCanvas(1024, 720);
  bpfCtx.fillStyle = '#ffffff';
  bpfCtx.fillRect(0, 0, 1024, 720);

  // Header band
  bpfCtx.fillStyle = '#0f2942';
  bpfCtx.fillRect(0, 0, 1024, 112);
  bpfCtx.fillStyle = '#0284c7';
  bpfCtx.fillRect(0, 112, 1024, 8);

  bpfCtx.fillStyle = '#ffffff';
  bpfCtx.font = '700 34px "Plus Jakarta Sans", system-ui, sans-serif';
  bpfCtx.textAlign = 'left';
  bpfCtx.fillText('BOAS PRÁTICAS DE FABRICAÇÃO (BPF)', 44, 52);
  bpfCtx.fillStyle = '#bae6fd';
  bpfCtx.font = '500 22px "Plus Jakarta Sans", system-ui, sans-serif';
  bpfCtx.fillText('POP-01 · PROCEDIMENTO OPERACIONAL PADRÃO — BARREIRA SANITÁRIA', 44, 88);

  const steps = [
    {
      num: '01',
      title: 'Retirada de Adornos',
      desc: 'Remova relógio, aliança, anéis, brincos e celular antes de vestir os EPIs.',
      color: '#0369a1',
    },
    {
      num: '02',
      title: 'Paramentação Completa (EPIs)',
      desc: 'Vista touca descartável cobrindo os cabelos, máscara facial, avental branco e botas de PVC.',
      color: '#0369a1',
    },
    {
      num: '03',
      title: 'Lavagem e Secagem das Mãos',
      desc: 'Lave mãos e antebraços com água e sabonete antisséptico; seque completamente com papel toalha.',
      color: '#0f766e',
    },
    {
      num: '04',
      title: 'Antissepsia com Álcool em Gel 70%',
      desc: 'Aplique álcool em gel 70% somente após lavar e secar as mãos (umidade ou sujidade reduzem a eficácia).',
      color: '#0f766e',
    },
    {
      num: '05',
      title: 'Higienização no Lava-Botas e Pedilúvio',
      desc: 'Acione as escovas giratórias e passe pelo pedilúvio sanitizante antes de cruzar a porta da produção.',
      color: '#047857',
    },
  ];

  steps.forEach((step, idx) => {
    const y = 152 + idx * 96;
    bpfCtx.fillStyle = '#f8fafc';
    bpfCtx.fillRect(40, y, 944, 80);
    bpfCtx.strokeStyle = '#cbd5e1';
    bpfCtx.lineWidth = 2;
    bpfCtx.strokeRect(40, y, 944, 80);

    // Step number block
    bpfCtx.fillStyle = step.color;
    bpfCtx.fillRect(40, y, 76, 80);
    bpfCtx.fillStyle = '#ffffff';
    bpfCtx.font = '700 28px "IBM Plex Mono", monospace';
    bpfCtx.textAlign = 'center';
    bpfCtx.fillText(step.num, 78, y + 50);

    // Text
    bpfCtx.textAlign = 'left';
    bpfCtx.fillStyle = '#0f172a';
    bpfCtx.font = '700 23px "Plus Jakarta Sans", system-ui, sans-serif';
    bpfCtx.fillText(step.title, 136, y + 32);
    bpfCtx.fillStyle = '#334155';
    bpfCtx.font = '400 18px "Plus Jakarta Sans", system-ui, sans-serif';
    bpfCtx.fillText(step.desc, 136, y + 60);
  });

  // Footer warning bar
  bpfCtx.fillStyle = '#fef3c7';
  bpfCtx.fillRect(40, 644, 944, 48);
  bpfCtx.strokeStyle = '#d97706';
  bpfCtx.lineWidth = 2;
  bpfCtx.strokeRect(40, 644, 944, 48);
  bpfCtx.fillStyle = '#92400e';
  bpfCtx.font = '600 18px "Plus Jakarta Sans", system-ui, sans-serif';
  bpfCtx.textAlign = 'center';
  bpfCtx.fillText(
    'ATENÇÃO: A inversão de etapas ou omissão de higiene gera Não Conformidade na auditoria de acesso.',
    512,
    674,
  );

  const bpfBoard = new THREE.CanvasTexture(bpfCan);
  bpfBoard.colorSpace = THREE.SRGBColorSpace;
  bpfBoard.anisotropy = aniso;
  allTextures.push(bpfBoard);

  // 5. Door Signage
  const [doorCan, doorCtx] = makeCanvas(1024, 224);
  doorCtx.fillStyle = '#0f2942';
  doorCtx.fillRect(0, 0, 1024, 224);
  doorCtx.strokeStyle = '#38bdf8';
  doorCtx.lineWidth = 6;
  doorCtx.strokeRect(8, 8, 1008, 208);

  doorCtx.fillStyle = '#ffffff';
  doorCtx.font = '700 44px "Plus Jakarta Sans", system-ui, sans-serif';
  doorCtx.textAlign = 'center';
  doorCtx.fillText('ÁREA DE PRODUÇÃO DE EMBUTIDOS', 512, 92);

  doorCtx.fillStyle = '#bae6fd';
  doorCtx.font = '600 26px "Plus Jakarta Sans", system-ui, sans-serif';
  doorCtx.fillText('ACESSO RESTRITO · SOMENTE PESSOAL PARAMENTADO E HIGIENIZADO', 512, 152);

  const doorSign = new THREE.CanvasTexture(doorCan);
  doorSign.colorSpace = THREE.SRGBColorSpace;
  doorSign.anisotropy = aniso;
  allTextures.push(doorSign);

  // 6. Soft Radial Contact Shadow Texture
  const [shadCan, shadCtx] = makeCanvas(256, 256);
  const grad = shadCtx.createRadialGradient(128, 128, 16, 128, 128, 126);
  grad.addColorStop(0, 'rgba(15, 23, 42, 0.42)');
  grad.addColorStop(0.55, 'rgba(15, 23, 42, 0.16)');
  grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
  shadCtx.fillStyle = grad;
  shadCtx.fillRect(0, 0, 256, 256);
  const contactShadow = new THREE.CanvasTexture(shadCan);
  contactShadow.anisotropy = aniso;
  allTextures.push(contactShadow);

  // 7. Station Identification Signs
  const stationSigns: Record<string, THREE.CanvasTexture> = {
    adornos: createLabelTexture('RETIRADA DE ADORNOS', 'Relógio · Aliança · Celular', '#0369a1', aniso),
    epis: createLabelTexture('ARMÁRIO DE EPIs', 'Touca · Máscara · Avental · Botas', '#0369a1', aniso),
    lavatorio: createLabelTexture('LAVATÓRIO AUTOMÁTICO', 'Água + Sabonete Antisséptico', '#0f766e', aniso),
    papel: createLabelTexture('PAPEL TOALHA', 'Secagem Completa das Mãos', '#0f766e', aniso),
    alcool: createLabelTexture('ÁLCOOL EM GEL 70%', 'Aplicar Após Lavar e Secar', '#047857', aniso),
    lavabotas: createLabelTexture('LAVA-BOTAS E PEDILÚVIO', 'Sanitização Obrigatória do Calçado', '#047857', aniso),
    vestibulo: createLabelTexture('SALA DE EMBUTIDOS', 'Área Limpa · Controle SIF', '#0f2942', aniso),
  };
  Object.values(stationSigns).forEach((t) => allTextures.push(t));

  return {
    wallAlbedo,
    wallRoughness,
    wallBump,
    floorAlbedo,
    floorRoughness,
    floorBump,
    steelAlbedo,
    steelRoughness,
    bpfBoard,
    doorSign,
    contactShadow,
    stationSigns,
    dispose: () => {
      allTextures.forEach((t) => t.dispose());
    },
  };
}
