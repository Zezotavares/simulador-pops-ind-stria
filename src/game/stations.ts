import * as THREE from 'three';
import { ProceduralTextureSet } from './textures';
import { DOOR_OPENING_HEIGHT, DOOR_OPENING_WIDTH, HALF_L, HALF_W } from './room';
import { ColliderBox, OperatorState, StationId } from './types';

export interface StationsBuildResult {
  group: THREE.Group;
  interactables: THREE.Object3D[];
  colliders: ColliderBox[];
  updateAnimations: (dt: number, elapsed: number, state: OperatorState) => void;
  triggerActionAnimation: (id: StationId) => void;
  dispose: () => void;
}

export function buildSanitaryStations(
  textures: ProceduralTextureSet,
  steelMat: THREE.MeshPhysicalMaterial,
): StationsBuildResult {
  const group = new THREE.Group();
  const interactables: THREE.Object3D[] = [];
  const colliders: ColliderBox[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // Shared PBR Materials across stations (varied roughness/metalness per skill directive)
  const darkMetalMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.48, metalness: 0.72 }),
  );
  const rubberMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.88, metalness: 0.04 }),
  );
  const chromeMat = trackMat(
    new THREE.MeshPhysicalMaterial({ color: 0xe2e8f0, roughness: 0.14, metalness: 0.96 }),
  );
  const goldMat = trackMat(
    new THREE.MeshPhysicalMaterial({ color: 0xeab308, roughness: 0.18, metalness: 0.94 }),
  );
  const whitePvcMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.34, metalness: 0.04 }),
  );
  const capBlueMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.82, metalness: 0.0 }),
  );
  const maskMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x93c5fd, roughness: 0.78, metalness: 0.0 }),
  );
  const soapBottleMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x14b8a6,
      roughness: 0.18,
      metalness: 0.0,
      transparent: true,
      opacity: 0.78,
    }),
  );
  const alcoholGelMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xbae6fd,
      roughness: 0.15,
      metalness: 0.0,
      transparent: true,
      opacity: 0.68,
    }),
  );
  const sanitizerLiquidMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x0d9488,
      roughness: 0.12,
      metalness: 0.05,
      transparent: true,
      opacity: 0.72,
      clearcoat: 0.9,
    }),
  );
  const glassMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xe0f2fe,
      roughness: 0.08,
      metalness: 0.0,
      transparent: true,
      opacity: 0.32,
      clearcoat: 1.0,
      depthWrite: false,
    }),
  );
  const waterStreamMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xdbeafe,
      roughness: 0.08,
      metalness: 0.0,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    }),
  );
  const bristleMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.72, metalness: 0.08 }),
  );
  const shadowPlaneGeo = trackGeo(new THREE.PlaneGeometry(1, 1));
  const shadowPlaneMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: textures.contactShadow,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
    }),
  );

  const addContactShadow = (parent: THREE.Object3D, w: number, d: number, y = 0.003) => {
    const m = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    m.rotation.x = -Math.PI / 2;
    m.scale.set(w, d, 1);
    m.position.y = y;
    parent.add(m);
  };

  const addSignPlate = (
    parent: THREE.Object3D,
    key: string,
    w: number,
    h: number,
    pos: [number, number, number],
    rotY = 0,
  ) => {
    const mat = trackMat(
      new THREE.MeshStandardMaterial({
        map: textures.stationSigns[key],
        roughness: 0.35,
        metalness: 0.05,
      }),
    );
    const mesh = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(w, h)), mat);
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.rotation.y = rotY;
    parent.add(mesh);
  };

  const addInteractProxy = (
    parent: THREE.Object3D,
    stationId: StationId,
    size: [number, number, number],
    pos: [number, number, number],
  ) => {
    const proxy = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(size[0], size[1], size[2])),
      trackMat(new THREE.MeshBasicMaterial({ visible: false })),
    );
    proxy.position.set(pos[0], pos[1], pos[2]);
    proxy.userData.stationId = stationId;
    parent.add(proxy);
    interactables.push(proxy);
    return proxy;
  };

  // =========================================================================
  // 1. ESTAÇÃO DE RETIRADA DE ADORNOS (x = -2.42, z = +2.35, facing +X)
  // =========================================================================
  const adornosGroup = new THREE.Group();
  adornosGroup.position.set(-HALF_W + 0.38, 0, 2.35);
  group.add(adornosGroup);

  addContactShadow(adornosGroup, 0.95, 1.75);

  // Stainless Bench Tabletop (beveled edge look via layered plates)
  const benchW = 0.58;
  const benchL = 1.42;
  const benchH = 0.88;
  const tabletop = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(benchW, 0.045, benchL)), steelMat);
  tabletop.position.set(0, benchH, 0);
  tabletop.castShadow = true;
  tabletop.receiveShadow = true;
  adornosGroup.add(tabletop);

  // Backsplash lip on bench
  const benchLip = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.03, 0.08, benchL)), steelMat);
  benchLip.position.set(-benchW / 2 + 0.015, benchH + 0.055, 0);
  adornosGroup.add(benchLip);

  // 4 tubular stainless legs + adjustable rubber feet + bottom shelf
  const legGeo = trackGeo(new THREE.CylinderGeometry(0.022, 0.022, benchH - 0.04, 12));
  const footGeo = trackGeo(new THREE.CylinderGeometry(0.032, 0.036, 0.03, 12));
  const legOffsets: Array<[number, number]> = [
    [-benchW / 2 + 0.06, -benchL / 2 + 0.07],
    [benchW / 2 - 0.06, -benchL / 2 + 0.07],
    [-benchW / 2 + 0.06, benchL / 2 - 0.07],
    [benchW / 2 - 0.06, benchL / 2 - 0.07],
  ];
  legOffsets.forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(legGeo, steelMat);
    leg.position.set(lx, (benchH - 0.02) / 2, lz);
    leg.castShadow = true;
    adornosGroup.add(leg);
    const foot = new THREE.Mesh(footGeo, rubberMat);
    foot.position.set(lx, 0.015, lz);
    adornosGroup.add(foot);
  });

  const lowerShelf = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(benchW - 0.08, 0.025, benchL - 0.1)),
    steelMat,
  );
  lowerShelf.position.set(0, 0.22, 0);
  lowerShelf.receiveShadow = true;
  adornosGroup.add(lowerShelf);

  // Wall-mounted Locker Cabinet above bench ("GUARDA DE ADORNOS")
  const lockerCabinet = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.3, 0.72, 1.32)), steelMat);
  lockerCabinet.position.set(-0.22, 1.68, 0);
  lockerCabinet.castShadow = true;
  adornosGroup.add(lockerCabinet);

  // 4 compartment doors with handles and ventilation slots
  for (let i = 0; i < 4; i++) {
    const cz = -0.46 + i * 0.308;
    const door = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.02, 0.54, 0.28)), steelMat);
    door.position.set(-0.065, 1.62, cz);
    adornosGroup.add(door);
    const handle = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.022, 0.07, 0.018)), darkMetalMat);
    handle.position.set(-0.048, 1.62, cz + 0.09);
    adornosGroup.add(handle);
  }

  addSignPlate(adornosGroup, 'adornos', 0.76, 0.26, [-0.35, 2.28, 0], Math.PI / 2);

  // Stainless Tray on bench containing Watch, Ring, Smartphone
  const trayBase = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.3, 0.014, 0.56)), chromeMat);
  trayBase.position.set(0.04, benchH + 0.03, 0);
  adornosGroup.add(trayBase);
  const trayRimL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.3, 0.024, 0.014)), chromeMat);
  trayRimL.position.set(0.04, benchH + 0.04, -0.28);
  const trayRimR = trayRimL.clone();
  trayRimR.position.z = 0.28;
  adornosGroup.add(trayRimL, trayRimR);

  // Adornment Props Group (visible when !adornosRetirados)
  const adornmentsProps = new THREE.Group();
  adornosGroup.add(adornmentsProps);

  // Watch (case + dial + strap)
  const watchGroup = new THREE.Group();
  watchGroup.position.set(0.04, benchH + 0.044, -0.15);
  const watchCase = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.03, 0.03, 0.014, 18)), chromeMat);
  const watchDial = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.024, 0.024, 0.016, 18)),
    darkMetalMat,
  );
  const watchStrap = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.14, 0.008, 0.028)), rubberMat);
  watchGroup.add(watchCase, watchDial, watchStrap);
  adornmentsProps.add(watchGroup);

  // Gold Wedding Ring (Aliança)
  const ringMesh = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.022, 0.006, 12, 24)), goldMat);
  ringMesh.rotation.x = Math.PI / 2;
  ringMesh.position.set(0.04, benchH + 0.045, 0.0);
  adornmentsProps.add(ringMesh);

  // Smartphone (body + glass screen + camera module)
  const phoneGroup = new THREE.Group();
  phoneGroup.position.set(0.04, benchH + 0.044, 0.14);
  phoneGroup.rotation.y = 0.22;
  const phoneBody = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.082, 0.011, 0.158)), darkMetalMat);
  const phoneScreen = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.074, 0.012, 0.146)), glassMat);
  phoneGroup.add(phoneBody, phoneScreen);
  adornmentsProps.add(phoneGroup);

  addInteractProxy(adornosGroup, 'adornos', [0.75, 1.9, 1.5], [0, 1.0, 0]);
  colliders.push({
    minX: -HALF_W,
    maxX: -HALF_W + 0.78,
    minZ: 2.35 - 0.76,
    maxZ: 2.35 + 0.76,
  });

  // =========================================================================
  // 2. ARMÁRIO DE EPIs (x = -2.42, z = -0.15, facing +X)
  // =========================================================================
  const episGroup = new THREE.Group();
  episGroup.position.set(-HALF_W + 0.38, 0, -0.15);
  group.add(episGroup);

  addContactShadow(episGroup, 0.95, 1.85);

  const cabW = 0.56;
  const cabL = 1.52;
  const cabBaseY = 0.16;
  const cabBodyH = 1.72;

  // Elevated hygienic legs (for floor washdown)
  const cabLegGeo = trackGeo(new THREE.CylinderGeometry(0.025, 0.025, cabBaseY, 12));
  [
    [-cabW / 2 + 0.06, -cabL / 2 + 0.08],
    [cabW / 2 - 0.06, -cabL / 2 + 0.08],
    [-cabW / 2 + 0.06, cabL / 2 - 0.08],
    [cabW / 2 - 0.06, cabL / 2 - 0.08],
  ].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(cabLegGeo, steelMat);
    leg.position.set(lx, cabBaseY / 2, lz);
    episGroup.add(leg);
  });

  // Open-front hygienic stainless cabinet shell (back, sides, bottom, shelves)
  const cabBack = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.03, cabBodyH, cabL)), steelMat);
  cabBack.position.set(-cabW / 2 + 0.015, cabBaseY + cabBodyH / 2, 0);
  cabBack.castShadow = true;
  episGroup.add(cabBack);

  const cabSideGeo = trackGeo(new THREE.BoxGeometry(cabW, cabBodyH, 0.03));
  const cabSideL = new THREE.Mesh(cabSideGeo, steelMat);
  cabSideL.position.set(0, cabBaseY + cabBodyH / 2, -cabL / 2 + 0.015);
  cabSideL.castShadow = true;
  const cabSideR = cabSideL.clone();
  cabSideR.position.z = cabL / 2 - 0.015;
  episGroup.add(cabSideL, cabSideR);

  const cabBottom = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(cabW, 0.03, cabL)), steelMat);
  cabBottom.position.set(0, cabBaseY + 0.015, 0);
  episGroup.add(cabBottom);

  const cabMidShelf = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(cabW - 0.04, 0.025, cabL - 0.06)), steelMat);
  cabMidShelf.position.set(0, cabBaseY + 1.05, 0);
  episGroup.add(cabMidShelf);

  const cabDivider = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(cabW - 0.04, 1.04, 0.025)), steelMat);
  cabDivider.position.set(0, cabBaseY + 0.52, 0.05);
  episGroup.add(cabDivider);

  // Sloped Dust-Proof Hygienic Top (ExtrudeGeometry wedge)
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-cabW / 2, 0);
  roofShape.lineTo(cabW / 2, 0);
  roofShape.lineTo(-cabW / 2, 0.22);
  roofShape.closePath();
  const roofGeo = trackGeo(
    new THREE.ExtrudeGeometry(roofShape, { depth: cabL, bevelEnabled: false }),
  );
  roofGeo.translate(0, 0, -cabL / 2);
  const cabRoof = new THREE.Mesh(roofGeo, steelMat);
  cabRoof.position.set(0, cabBaseY + cabBodyH, 0);
  cabRoof.castShadow = true;
  episGroup.add(cabRoof);

  addSignPlate(episGroup, 'epis', 0.88, 0.28, [-0.35, 2.34, 0], Math.PI / 2);

  // PPE Props Group (visible until operator equips them)
  const ppeProps = new THREE.Group();
  episGroup.add(ppeProps);

  // Disposable Bouffant Caps (stack of 2 on upper left shelf)
  for (let i = 0; i < 2; i++) {
    const cap = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.11, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55)),
      capBlueMat,
    );
    cap.scale.set(1, 0.65, 1.15);
    cap.position.set(0.02, cabBaseY + 1.08 + i * 0.06, -0.38);
    ppeProps.add(cap);
  }

  // Surgical Mask Box + Mask on top shelf
  const maskBox = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.22, 0.1, 0.26)), whitePvcMat);
  maskBox.position.set(0.02, cabBaseY + 1.12, 0.32);
  const maskProp = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.15, 0.015, 0.1)), maskMat);
  maskProp.position.set(0.04, cabBaseY + 1.18, 0.32);
  ppeProps.add(maskBox, maskProp);

  // White Waterproof PVC Apron hanging on stainless hook (left lower bay)
  const apronRod = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.012, 0.012, 0.65, 10)),
    chromeMat,
  );
  apronRod.rotation.x = Math.PI / 2;
  apronRod.position.set(-0.04, cabBaseY + 0.96, -0.35);
  episGroup.add(apronRod);

  const apronShape = new THREE.Shape();
  apronShape.moveTo(-0.18, 0);
  apronShape.lineTo(0.18, 0);
  apronShape.lineTo(0.14, 0.58);
  apronShape.lineTo(0.09, 0.72);
  apronShape.lineTo(-0.09, 0.72);
  apronShape.lineTo(-0.14, 0.58);
  apronShape.closePath();
  const apronGeo = trackGeo(
    new THREE.ExtrudeGeometry(apronShape, { depth: 0.018, bevelEnabled: false }),
  );
  apronGeo.rotateY(Math.PI / 2);
  const apronMesh = new THREE.Mesh(apronGeo, whitePvcMat);
  apronMesh.position.set(-0.02, cabBaseY + 0.18, -0.35);
  ppeProps.add(apronMesh);

  // White PVC Boots (pair on right lower bay)
  const makeBoot = (bz: number) => {
    const boot = new THREE.Group();
    const shaft = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.068, 0.06, 0.29, 14)), whitePvcMat);
    shaft.position.set(-0.04, 0.18, 0);
    const foot = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.085, 0.11)), whitePvcMat);
    foot.position.set(0.03, 0.055, 0);
    const sole = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.25, 0.02, 0.115)), darkMetalMat);
    sole.position.set(0.03, 0.01, 0);
    boot.add(shaft, foot, sole);
    boot.position.set(0.02, cabBaseY + 0.03, bz);
    return boot;
  };
  ppeProps.add(makeBoot(0.28), makeBoot(0.47));

  addInteractProxy(episGroup, 'epis', [0.75, 2.05, 1.56], [0, 1.05, 0]);
  colliders.push({
    minX: -HALF_W,
    maxX: -HALF_W + 0.78,
    minZ: -0.15 - 0.82,
    maxZ: -0.15 + 0.82,
  });

  // =========================================================================
  // 3. LAVATÓRIO DE MÃOS COM SENSOR E SABONETE (x = +2.5, z = -0.1, facing -X)
  // =========================================================================
  const sinkGroup = new THREE.Group();
  sinkGroup.position.set(HALF_W - 0.02, 0, -0.1);
  group.add(sinkGroup);

  addContactShadow(sinkGroup, 0.78, 1.08, 0.003);

  // Wall-mounted Stainless Sink Housing + Curved Hygienic Backsplash
  const sinkBody = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.48, 0.34, 0.76)), steelMat);
  sinkBody.position.set(-0.24, 0.84, 0);
  sinkBody.castShadow = true;
  sinkBody.receiveShadow = true;
  sinkGroup.add(sinkBody);

  // Recessed dark stainless basin interior
  const basinInner = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.38, 0.04, 0.66)),
    darkMetalMat,
  );
  basinInner.position.set(-0.24, 0.995, 0);
  sinkGroup.add(basinInner);

  // Backsplash plate
  const backsplash = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.04, 0.48, 0.76)), steelMat);
  backsplash.position.set(-0.02, 1.24, 0);
  sinkGroup.add(backsplash);

  // Under-sink hygienic P-trap piping (TubeGeometry)
  const pipeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.24, 0.68, 0),
    new THREE.Vector3(-0.24, 0.5, 0),
    new THREE.Vector3(-0.18, 0.44, 0),
    new THREE.Vector3(-0.04, 0.44, 0),
  ]);
  const drainPipe = new THREE.Mesh(
    trackGeo(new THREE.TubeGeometry(pipeCurve, 14, 0.026, 10, false)),
    chromeMat,
  );
  sinkGroup.add(drainPipe);

  // Gooseneck Sensor Faucet (TubeGeometry)
  const faucetCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.05, 1.03, 0),
    new THREE.Vector3(-0.07, 1.26, 0),
    new THREE.Vector3(-0.18, 1.34, 0),
    new THREE.Vector3(-0.25, 1.22, 0),
  ]);
  const faucetSpout = new THREE.Mesh(
    trackGeo(new THREE.TubeGeometry(faucetCurve, 18, 0.015, 10, false)),
    chromeMat,
  );
  sinkGroup.add(faucetSpout);

  // Infrared Sensor Housing + Indicator LED
  const sensorBox = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.03, 0.06, 0.09)), darkMetalMat);
  sensorBox.position.set(-0.042, 1.09, 0);
  const sensorLedMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x059669, emissiveIntensity: 0.4 }),
  );
  const sensorLed = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.009, 10, 10)), sensorLedMat);
  sensorLed.position.set(-0.058, 1.09, 0.022);
  sinkGroup.add(sensorBox, sensorLed);

  // Antiseptic Liquid Soap Dispenser mounted beside faucet
  const soapCase = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.11, 0.25, 0.13)), steelMat);
  soapCase.position.set(-0.06, 1.34, 0.26);
  const soapReservoir = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.085, 0.14, 0.095)), soapBottleMat);
  soapReservoir.position.set(-0.07, 1.35, 0.26);
  const soapNozzle = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.008, 0.008, 0.04, 8)), chromeMat);
  soapNozzle.position.set(-0.085, 1.2, 0.26);
  sinkGroup.add(soapCase, soapReservoir, soapNozzle);

  // Animated Water Stream & Basin Ripple
  const waterStream = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.009, 0.015, 0.23, 12)),
    waterStreamMat,
  );
  waterStream.position.set(-0.25, 1.1, 0);
  waterStream.visible = false;
  sinkGroup.add(waterStream);

  const waterPool = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.16, 0.16, 0.008, 20)),
    waterStreamMat,
  );
  waterPool.position.set(-0.24, 1.018, 0);
  waterPool.visible = false;
  sinkGroup.add(waterPool);

  addSignPlate(sinkGroup, 'lavatorio', 0.68, 0.23, [-0.01, 1.72, 0], -Math.PI / 2);
  addInteractProxy(sinkGroup, 'lavatorio', [0.65, 1.4, 0.85], [-0.24, 1.15, 0]);
  colliders.push({
    minX: HALF_W - 0.62,
    maxX: HALF_W,
    minZ: -0.1 - 0.45,
    maxZ: -0.1 + 0.45,
  });

  // =========================================================================
  // 4. DISPENSER DE PAPEL TOALHA (x = +2.78, z = -1.05, facing -X)
  // =========================================================================
  const towelGroup = new THREE.Group();
  towelGroup.position.set(HALF_W - 0.02, 1.38, -1.05);
  group.add(towelGroup);

  const towelHood = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.17, 0.36, 0.32)), steelMat);
  towelHood.position.set(-0.085, 0, 0);
  towelHood.castShadow = true;
  towelGroup.add(towelHood);

  const towelWindow = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.015, 0.16, 0.04)), glassMat);
  towelWindow.position.set(-0.172, 0.02, 0);
  towelGroup.add(towelWindow);

  const towelSheet = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.012, 0.13, 0.22)), whitePvcMat);
  towelSheet.position.set(-0.11, -0.22, 0);
  towelGroup.add(towelSheet);

  // Stainless trash bin below towel dispenser (grounded at y = 0 in world space)
  const binGroup = new THREE.Group();
  binGroup.position.set(HALF_W - 0.22, 0, -1.05);
  group.add(binGroup);
  addContactShadow(binGroup, 0.45, 0.45);
  const binBody = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.17, 0.145, 0.56, 18)), steelMat);
  binBody.position.y = 0.28;
  binBody.castShadow = true;
  const binLid = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.18, 0.18, 0.045, 18)), darkMetalMat);
  binLid.position.y = 0.57;
  binGroup.add(binBody, binLid);

  addSignPlate(towelGroup, 'papel', 0.46, 0.17, [0.005, 0.36, 0], -Math.PI / 2);
  addInteractProxy(towelGroup, 'papel', [0.38, 0.72, 0.48], [-0.1, -0.05, 0]);
  colliders.push({
    minX: HALF_W - 0.46,
    maxX: HALF_W,
    minZ: -1.05 - 0.26,
    maxZ: -1.05 + 0.26,
  });

  // =========================================================================
  // 5. DISPENSER DE ÁLCOOL EM GEL 70% (x = +2.78, z = -2.05, facing -X)
  // =========================================================================
  const alcGroup = new THREE.Group();
  alcGroup.position.set(HALF_W - 0.02, 1.34, -2.05);
  group.add(alcGroup);

  // Wall backplate & protective stainless cradle
  const alcPlate = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.02, 0.36, 0.24)), steelMat);
  alcPlate.position.set(-0.01, 0, 0);
  const alcTopCap = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.14, 0.04, 0.18)), steelMat);
  alcTopCap.position.set(-0.08, 0.14, 0);
  const alcReservoir = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.062, 0.062, 0.22, 18)),
    alcoholGelMat,
  );
  alcReservoir.position.set(-0.085, 0.01, 0);
  const alcNozzle = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.009, 0.009, 0.05, 10)), chromeMat);
  alcNozzle.position.set(-0.105, -0.125, 0);
  // Stainless drip tray below nozzle
  const alcDripTray = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 0.025, 0.22)), steelMat);
  alcDripTray.position.set(-0.09, -0.24, 0);
  // Animated gel droplet
  const alcDrop = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.012, 10, 10)), alcoholGelMat);
  alcDrop.position.set(-0.105, -0.155, 0);
  alcDrop.visible = false;
  alcGroup.add(alcPlate, alcTopCap, alcReservoir, alcNozzle, alcDripTray, alcDrop);

  addSignPlate(alcGroup, 'alcool', 0.48, 0.18, [0.005, 0.34, 0], -Math.PI / 2);
  addInteractProxy(alcGroup, 'alcool', [0.36, 0.68, 0.42], [-0.09, -0.02, 0]);

  // =========================================================================
  // 6. PEDILÚVIO E LAVA-BOTAS AUTOMATIZADO (x = 0, z = -3.45)
  // =========================================================================
  const bootGroup = new THREE.Group();
  bootGroup.position.set(0, 0, -3.45);
  group.add(bootGroup);

  addContactShadow(bootGroup, 2.25, 1.65);

  const bwWidth = 1.78;
  const bwLen = 1.24;

  // Stainless steel recessed basin outer frame
  const basinBase = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(bwWidth, 0.055, bwLen)), steelMat);
  basinBase.position.y = 0.0275;
  basinBase.receiveShadow = true;
  bootGroup.add(basinBase);

  // Entry & Exit sloped stainless ramps (for safe walk-through)
  const makeRamp = (zPos: number, rotY: number) => {
    const rShape = new THREE.Shape();
    rShape.moveTo(0, 0);
    rShape.lineTo(0.24, 0);
    rShape.lineTo(0.24, 0.055);
    rShape.closePath();
    const rGeo = trackGeo(new THREE.ExtrudeGeometry(rShape, { depth: bwWidth, bevelEnabled: false }));
    rGeo.rotateY(Math.PI / 2);
    rGeo.translate(-bwWidth / 2, 0, 0);
    const ramp = new THREE.Mesh(rGeo, steelMat);
    ramp.position.set(0, 0, zPos);
    ramp.rotation.y = rotY;
    ramp.receiveShadow = true;
    return ramp;
  };
  bootGroup.add(makeRamp(bwLen / 2 + 0.24, 0));
  bootGroup.add(makeRamp(-bwLen / 2 - 0.24, Math.PI));

  // Sanitizing liquid pool surface inside pedilúvio
  const poolSurface = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(bwWidth - 0.24, bwLen - 0.16)),
    sanitizerLiquidMat,
  );
  poolSurface.rotation.x = -Math.PI / 2;
  poolSurface.position.y = 0.058;
  bootGroup.add(poolSurface);

  // Stainless side curb housing & handrails (TubeGeometry)
  const railPostGeo = trackGeo(new THREE.CylinderGeometry(0.02, 0.02, 0.94, 12));
  const handrailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.05, -0.58),
    new THREE.Vector3(0, 0.96, -0.56),
    new THREE.Vector3(0, 0.98, 0),
    new THREE.Vector3(0, 0.96, 0.56),
    new THREE.Vector3(0, 0.05, 0.58),
  ]);
  const handrailGeo = trackGeo(new THREE.TubeGeometry(handrailCurve, 24, 0.022, 10, false));

  [-bwWidth / 2 + 0.05, bwWidth / 2 - 0.05].forEach((rx) => {
    const curb = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.12, 0.16, bwLen)), steelMat);
    curb.position.set(rx, 0.08, 0);
    curb.castShadow = true;
    bootGroup.add(curb);

    const rail = new THREE.Mesh(handrailGeo, chromeMat);
    rail.position.set(rx, 0, 0);
    rail.castShadow = true;
    bootGroup.add(rail);

    const midPost = new THREE.Mesh(railPostGeo, chromeMat);
    midPost.position.set(rx, 0.47, 0);
    bootGroup.add(midPost);
  });

  // Control box & start sensor button on right handrail
  const ctrlBox = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.1, 0.14, 0.14)), steelMat);
  ctrlBox.position.set(bwWidth / 2 - 0.05, 0.98, 0.34);
  const ctrlBtnMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x059669, emissive: 0x047857, emissiveIntensity: 0.65 }),
  );
  const ctrlBtn = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.026, 0.026, 0.02, 14)), ctrlBtnMat);
  ctrlBtn.rotation.z = Math.PI / 2;
  ctrlBtn.position.set(bwWidth / 2 - 0.105, 0.98, 0.34);
  bootGroup.add(ctrlBox, ctrlBtn);

  // 2 Rotating Cylindrical Bristle Brushes (vertical/horizontal side-sole scrubbers)
  const brushes: THREE.Group[] = [];
  [-0.36, 0.36].forEach((bx) => {
    const brushGrp = new THREE.Group();
    brushGrp.position.set(bx, 0.14, 0);
    const core = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.04, 0.04, 0.92, 14)), steelMat);
    core.rotation.x = Math.PI / 2;
    const bristles = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.115, 0.115, 0.84, 18)),
      bristleMat,
    );
    bristles.rotation.x = Math.PI / 2;
    // Longitudinal bristle ribs so rotation is clearly visible
    for (let r = 0; r < 6; r++) {
      const ang = (r / 6) * Math.PI;
      const rib = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.245, 0.02, 0.84)), darkMetalMat);
      rib.rotation.z = ang;
      brushGrp.add(rib);
    }
    brushGrp.add(core, bristles);
    bootGroup.add(brushGrp);
    brushes.push(brushGrp);
  });

  // Floor brush in center channel
  const soleBrush = new THREE.Group();
  soleBrush.position.set(0, 0.075, 0);
  const soleCore = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.055, 0.055, 0.9, 14)), bristleMat);
  soleCore.rotation.z = Math.PI / 2;
  for (let r = 0; r < 5; r++) {
    const rib = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.88, 0.12, 0.02)), darkMetalMat);
    rib.rotation.x = (r / 5) * Math.PI;
    soleBrush.add(rib);
  }
  soleBrush.add(soleCore);
  bootGroup.add(soleBrush);
  brushes.push(soleBrush);

  addSignPlate(bootGroup, 'lavabotas', 0.62, 0.21, [bwWidth / 2 - 0.04, 1.24, 0], -Math.PI / 2);
  addInteractProxy(bootGroup, 'lavabotas', [1.9, 1.15, 1.55], [0, 0.55, 0]);

  // Colliders ONLY on left & right side handrails so player can walk cleanly through center channel
  colliders.push(
    {
      minX: -bwWidth / 2 - 0.04,
      maxX: -bwWidth / 2 + 0.14,
      minZ: -3.45 - 0.68,
      maxZ: -3.45 + 0.68,
    },
    {
      minX: bwWidth / 2 - 0.14,
      maxX: bwWidth / 2 + 0.04,
      minZ: -3.45 - 0.68,
      maxZ: -3.45 + 0.68,
    },
  );

  // =========================================================================
  // 7. PORTA DUPLA VAI-E-VEM DE AÇO INOX ESCOVADO (x = 0, z = -HALF_L)
  // =========================================================================
  const doorGroup = new THREE.Group();
  doorGroup.position.set(0, 0, -HALF_L);
  group.add(doorGroup);

  // Stainless Perimeter Door Frame
  const frameDepth = 0.14;
  const frameThick = 0.055;
  const jambGeo = trackGeo(new THREE.BoxGeometry(frameThick, DOOR_OPENING_HEIGHT, frameDepth));
  const jambL = new THREE.Mesh(jambGeo, steelMat);
  jambL.position.set(-DOOR_OPENING_WIDTH / 2 + frameThick / 2, DOOR_OPENING_HEIGHT / 2, 0);
  const jambR = new THREE.Mesh(jambGeo, steelMat);
  jambR.position.set(DOOR_OPENING_WIDTH / 2 - frameThick / 2, DOOR_OPENING_HEIGHT / 2, 0);
  const lintel = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(DOOR_OPENING_WIDTH, frameThick, frameDepth)),
    steelMat,
  );
  lintel.position.set(0, DOOR_OPENING_HEIGHT - frameThick / 2, 0);
  doorGroup.add(jambL, jambR, lintel);

  // Production Area Sign above the door
  const doorSignMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.doorSign,
      roughness: 0.35,
      metalness: 0.05,
    }),
  );
  const doorSignMesh = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(1.78, 0.38)), doorSignMat);
  doorSignMesh.position.set(0, DOOR_OPENING_HEIGHT + 0.28, 0.025);
  doorGroup.add(doorSignMesh);

  // Helper to build a composite hinged stainless door leaf with rectangular vision glass + closer + push bars
  const leafWidth = (DOOR_OPENING_WIDTH - frameThick * 2 - 0.02) / 2; // ~0.875m
  const leafHeight = DOOR_OPENING_HEIGHT - frameThick - 0.015; // ~2.17m

  const buildDoorLeaf = (side: -1 | 1): THREE.Group => {
    const hinge = new THREE.Group();
    hinge.position.set(side * (DOOR_OPENING_WIDTH / 2 - frameThick), 0, 0);

    const leafPivot = new THREE.Group();
    hinge.add(leafPivot);

    const cx = -side * (leafWidth / 2);

    // Outer stainless stiles & rails around glass opening
    const winW = 0.34;
    const winH = 0.68;
    const winCenterY = 1.48;

    // Lower solid stainless panel
    const lowerH = winCenterY - winH / 2;
    const lowerPanel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(leafWidth, lowerH, 0.048)), steelMat);
    lowerPanel.position.set(cx, lowerH / 2 + 0.01, 0);
    lowerPanel.castShadow = true;
    leafPivot.add(lowerPanel);

    // Top solid header above window
    const topY = winCenterY + winH / 2;
    const topH = leafHeight - topY;
    const topPanel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(leafWidth, topH, 0.048)), steelMat);
    topPanel.position.set(cx, topY + topH / 2, 0);
    topPanel.castShadow = true;
    leafPivot.add(topPanel);

    // Side stiles flanking window
    const stileW = (leafWidth - winW) / 2;
    const stileGeo = trackGeo(new THREE.BoxGeometry(stileW, winH, 0.048));
    const stileA = new THREE.Mesh(stileGeo, steelMat);
    stileA.position.set(cx - winW / 2 - stileW / 2, winCenterY, 0);
    const stileB = new THREE.Mesh(stileGeo, steelMat);
    stileB.position.set(cx + winW / 2 + stileW / 2, winCenterY, 0);
    leafPivot.add(stileA, stileB);

    // Rubber glass gasket bezel + clear glass pane
    const gasket = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(winW + 0.025, winH + 0.025, 0.052)),
      rubberMat,
    );
    gasket.position.set(cx, winCenterY, 0);
    const glass = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(winW, winH)), glassMat);
    glass.position.set(cx, winCenterY, 0.027);
    const glassBack = glass.clone();
    glassBack.rotation.y = Math.PI;
    glassBack.position.z = -0.027;
    leafPivot.add(gasket, glass, glassBack);

    // Protective bumper kick-plate at bottom
    const kickPlate = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(leafWidth - 0.04, 0.32, 0.056)),
      rubberMat,
    );
    kickPlate.position.set(cx, 0.19, 0);
    leafPivot.add(kickPlate);

    // Horizontal Stainless Crash/Push Bar
    const pushBar = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.016, 0.016, leafWidth - 0.14, 12)),
      chromeMat,
    );
    pushBar.rotation.z = Math.PI / 2;
    pushBar.position.set(cx, 0.96, 0.055);
    leafPivot.add(pushBar);

    // Vertical Pull Handle near center meeting edge
    const pullHandle = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.013, 0.013, 0.3, 12)),
      chromeMat,
    );
    pullHandle.position.set(cx - side * (leafWidth / 2 - 0.11), 1.12, 0.058);
    leafPivot.add(pullHandle);

    // Overhead Door Closer Body + Linkage Arm (mounted at top)
    const closerBody = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.06, 0.055)), darkMetalMat);
    closerBody.position.set(cx + side * 0.18, leafHeight - 0.07, 0.045);
    const closerArm = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.28, 0.016, 0.018)), darkMetalMat);
    closerArm.position.set(cx + side * 0.24, leafHeight + 0.01, 0.04);
    closerArm.rotation.z = side * 0.22;
    leafPivot.add(closerBody, closerArm);

    return hinge;
  };

  const leftHinge = buildDoorLeaf(-1);
  const rightHinge = buildDoorLeaf(1);
  doorGroup.add(leftHinge, rightHinge);

  const doorProxy = addInteractProxy(doorGroup, 'porta', [DOOR_OPENING_WIDTH, 2.2, 0.45], [0, 1.1, 0.08]);

  // =========================================================================
  // Animation Timers & Smooth Damping State
  // =========================================================================
  let washTimer = 0;
  let towelTimer = 0;
  let alcoholTimer = 0;
  let bootTimer = 0;
  let doorOpenAngle = 0;

  const triggerActionAnimation = (id: StationId) => {
    if (id === 'lavatorio') washTimer = 2.0;
    else if (id === 'papel') towelTimer = 0.8;
    else if (id === 'alcool') alcoholTimer = 0.65;
    else if (id === 'lavabotas') bootTimer = 2.2;
  };

  const updateAnimations = (dt: number, elapsed: number, state: OperatorState) => {
    // Show/hide adornments & PPE based on operator state
    adornmentsProps.visible = !state.adornosRetirados;
    ppeProps.visible = !state.episVestidos;

    // Sink running water animation
    if (washTimer > 0) {
      washTimer = Math.max(0, washTimer - dt);
      waterStream.visible = true;
      waterPool.visible = true;
      const pulse = 0.92 + Math.sin(elapsed * 26) * 0.12;
      waterStream.scale.set(pulse, 1, pulse);
      waterPool.scale.set(0.85 + Math.sin(elapsed * 12) * 0.15, 1, 0.85 + Math.sin(elapsed * 12) * 0.15);
      sensorLedMat.emissiveIntensity = 1.6;
    } else {
      waterStream.visible = false;
      waterPool.visible = false;
      sensorLedMat.emissiveIntensity = 0.35;
    }

    // Paper towel pull bounce
    if (towelTimer > 0) {
      towelTimer = Math.max(0, towelTimer - dt);
      const t = 1 - towelTimer / 0.8;
      towelSheet.position.y = -0.22 - Math.sin(t * Math.PI) * 0.12;
    } else {
      towelSheet.position.y = -0.22;
    }

    // Alcohol gel drop animation
    if (alcoholTimer > 0) {
      alcoholTimer = Math.max(0, alcoholTimer - dt);
      const t = 1 - alcoholTimer / 0.65;
      alcDrop.visible = true;
      alcDrop.position.y = -0.155 - t * 0.08;
    } else {
      alcDrop.visible = false;
    }

    // Boot washer cylindrical brushes spin
    const brushSpeed = bootTimer > 0 ? 14 : state.botasHigienizadas ? 1.8 : 0.45;
    if (bootTimer > 0) {
      bootTimer = Math.max(0, bootTimer - dt);
    }
    brushes[0].rotation.z += dt * brushSpeed;
    brushes[1].rotation.z -= dt * brushSpeed;
    brushes[2].rotation.x += dt * brushSpeed;

    // Subtle liquid ripple in pedilúvio
    poolSurface.position.y = 0.058 + Math.sin(elapsed * 2.5) * 0.0015;

    // Double swing door smooth exponential damping
    const targetAngle = state.portaAberta ? Math.PI * 0.46 : 0;
    doorOpenAngle = THREE.MathUtils.damp(doorOpenAngle, targetAngle, 6.5, dt);
    // Swing inward toward production vestibule (-Z)
    leftHinge.rotation.y = -doorOpenAngle;
    rightHinge.rotation.y = doorOpenAngle;

    // Disable door proxy raycast once open so player walks cleanly through
    doorProxy.visible = !state.portaAberta;
  };

  return {
    group,
    interactables,
    colliders,
    updateAnimations,
    triggerActionAnimation,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
