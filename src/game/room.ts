import * as THREE from 'three';
import { ProceduralTextureSet } from './textures';

export const ROOM_WIDTH = 5.6;
export const ROOM_LENGTH = 10.6;
export const ROOM_HEIGHT = 3.15;
export const HALF_W = ROOM_WIDTH / 2; // 2.8
export const HALF_L = ROOM_LENGTH / 2; // 5.3
export const DOOR_OPENING_WIDTH = 1.88;
export const DOOR_OPENING_HEIGHT = 2.24;

export interface RoomBuildResult {
  group: THREE.Group;
  boardProxy: THREE.Mesh;
  dispose: () => void;
}

export function buildSanitaryRoom(
  textures: ProceduralTextureSet,
  steelMat: THREE.MeshPhysicalMaterial,
  isSoftwareGl: boolean,
): RoomBuildResult {
  const group = new THREE.Group();
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

  // Materials
  const wallTexLong = textures.wallAlbedo.clone();
  wallTexLong.repeat.set(9, 1);
  wallTexLong.needsUpdate = true;
  const wallRoughLong = textures.wallRoughness.clone();
  wallRoughLong.repeat.set(9, 1);
  wallRoughLong.needsUpdate = true;
  const wallBumpLong = textures.wallBump.clone();
  wallBumpLong.repeat.set(9, 1);
  wallBumpLong.needsUpdate = true;

  const wallTexShort = textures.wallAlbedo.clone();
  wallTexShort.repeat.set(5, 1);
  wallTexShort.needsUpdate = true;
  const wallRoughShort = textures.wallRoughness.clone();
  wallRoughShort.repeat.set(5, 1);
  wallRoughShort.needsUpdate = true;
  const wallBumpShort = textures.wallBump.clone();
  wallBumpShort.repeat.set(5, 1);
  wallBumpShort.needsUpdate = true;

  const wallMatLong = trackMat(
    new THREE.MeshStandardMaterial({
      map: wallTexLong,
      roughnessMap: wallRoughLong,
      bumpMap: wallBumpLong,
      bumpScale: 0.004,
      roughness: 0.48,
      metalness: 0.03,
    }),
  );

  const wallMatShort = trackMat(
    new THREE.MeshStandardMaterial({
      map: wallTexShort,
      roughnessMap: wallRoughShort,
      bumpMap: wallBumpShort,
      bumpScale: 0.004,
      roughness: 0.48,
      metalness: 0.03,
    }),
  );

  const floorMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.floorAlbedo,
      roughnessMap: textures.floorRoughness,
      bumpMap: textures.floorBump,
      bumpScale: 0.003,
      roughness: 0.56,
      metalness: 0.04,
    }),
  );

  const ceilingMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf4f6f5,
      roughness: 0.72,
      metalness: 0.02,
    }),
  );

  const coveMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xdfe4e3,
      roughness: 0.36,
      metalness: 0.08,
    }),
  );

  // 1. Monolithic Epoxy Floor
  const floorGeo = trackGeo(new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_LENGTH));
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  // 2. Smooth Insulated Ceiling
  const ceilingGeo = trackGeo(new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_LENGTH));
  const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = ROOM_HEIGHT;
  group.add(ceiling);

  // 3. Side Walls (Left -X, Right +X)
  const sideWallGeo = trackGeo(new THREE.PlaneGeometry(ROOM_LENGTH, ROOM_HEIGHT));
  const leftWall = new THREE.Mesh(sideWallGeo, wallMatLong);
  leftWall.position.set(-HALF_W, ROOM_HEIGHT / 2, 0);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.receiveShadow = true;
  group.add(leftWall);

  const rightWall = new THREE.Mesh(sideWallGeo, wallMatLong);
  rightWall.position.set(HALF_W, ROOM_HEIGHT / 2, 0);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.receiveShadow = true;
  group.add(rightWall);

  // 4. Entry Wall (+Z behind player at z = +HALF_L)
  const endWallGeo = trackGeo(new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_HEIGHT));
  const backEntryWall = new THREE.Mesh(endWallGeo, wallMatShort);
  backEntryWall.position.set(0, ROOM_HEIGHT / 2, HALF_L);
  backEntryWall.rotation.y = Math.PI;
  backEntryWall.receiveShadow = true;
  group.add(backEntryWall);

  // Subtle exterior entry door on +Z wall (where operator came from)
  const entryDoorMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe3e7ea,
      roughness: 0.42,
      metalness: 0.2,
    }),
  );
  const entryFrame = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.4, 2.2, 0.08)), steelMat);
  entryFrame.position.set(0, 1.1, HALF_L - 0.02);
  group.add(entryFrame);
  const entryLeaf = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.24, 2.12, 0.06)), entryDoorMat);
  entryLeaf.position.set(0, 1.06, HALF_L - 0.03);
  group.add(entryLeaf);

  // 5. Production Wall (-Z at z = -HALF_L) with central opening for the double swing doors
  const sideSegmentW = (ROOM_WIDTH - DOOR_OPENING_WIDTH) / 2; // (5.6 - 1.88)/2 = 1.86
  const sideSegGeo = trackGeo(new THREE.PlaneGeometry(sideSegmentW, ROOM_HEIGHT));

  const frontLeftSeg = new THREE.Mesh(sideSegGeo, wallMatShort);
  frontLeftSeg.position.set(-HALF_W + sideSegmentW / 2, ROOM_HEIGHT / 2, -HALF_L);
  frontLeftSeg.receiveShadow = true;
  group.add(frontLeftSeg);

  const frontRightSeg = new THREE.Mesh(sideSegGeo, wallMatShort);
  frontRightSeg.position.set(HALF_W - sideSegmentW / 2, ROOM_HEIGHT / 2, -HALF_L);
  frontRightSeg.receiveShadow = true;
  group.add(frontRightSeg);

  const headerH = ROOM_HEIGHT - DOOR_OPENING_HEIGHT;
  const headerGeo = trackGeo(new THREE.PlaneGeometry(DOOR_OPENING_WIDTH, headerH));
  const frontHeader = new THREE.Mesh(headerGeo, wallMatShort);
  frontHeader.position.set(0, DOOR_OPENING_HEIGHT + headerH / 2, -HALF_L);
  frontHeader.receiveShadow = true;
  group.add(frontHeader);

  // 6. Production Vestibule Beyond the Double Door (visible through door windows & when open)
  const vestDepth = 2.8;
  const vestMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xe9eef2, roughness: 0.5, metalness: 0.05 }),
  );
  const vestFloor = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(3.8, vestDepth)), floorMat);
  vestFloor.rotation.x = -Math.PI / 2;
  vestFloor.position.set(0, 0.001, -HALF_L - vestDepth / 2);
  group.add(vestFloor);

  const vestCeiling = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(3.8, vestDepth)), ceilingMat);
  vestCeiling.rotation.x = Math.PI / 2;
  vestCeiling.position.set(0, ROOM_HEIGHT, -HALF_L - vestDepth / 2);
  group.add(vestCeiling);

  const vestBack = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(3.8, ROOM_HEIGHT)), vestMat);
  vestBack.position.set(0, ROOM_HEIGHT / 2, -HALF_L - vestDepth);
  group.add(vestBack);

  const vestSideGeo = trackGeo(new THREE.PlaneGeometry(vestDepth, ROOM_HEIGHT));
  const vestLeft = new THREE.Mesh(vestSideGeo, vestMat);
  vestLeft.rotation.y = Math.PI / 2;
  vestLeft.position.set(-1.9, ROOM_HEIGHT / 2, -HALF_L - vestDepth / 2);
  group.add(vestLeft);

  const vestRight = new THREE.Mesh(vestSideGeo, vestMat);
  vestRight.rotation.y = -Math.PI / 2;
  vestRight.position.set(1.9, ROOM_HEIGHT / 2, -HALF_L - vestDepth / 2);
  group.add(vestRight);

  // Clean signage inside the vestibule visible through the door glass
  const vestSignMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.stationSigns.vestibulo,
      roughness: 0.35,
      metalness: 0.05,
    }),
  );
  const vestSign = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(1.3, 0.48)), vestSignMat);
  vestSign.position.set(0, 1.85, -HALF_L - vestDepth + 0.02);
  group.add(vestSign);

  const vestLight = new THREE.PointLight(0xf3f9ff, 3.2, 6, 2);
  vestLight.position.set(0, 2.75, -HALF_L - 1.3);
  group.add(vestLight);

  // 7. Curved Sanitary Coved Skirting (Rodapé Sanitário Meia-Cana Curvo) via ExtrudeGeometry
  const coveRadius = 0.085;
  const coveShape = new THREE.Shape();
  coveShape.moveTo(0, 0);
  coveShape.lineTo(coveRadius, 0);
  // Concave quarter-arc from floor (coveRadius, 0) up to wall (0, coveRadius)
  coveShape.absarc(coveRadius, coveRadius, coveRadius, -Math.PI / 2, Math.PI, true);
  coveShape.lineTo(0, coveRadius + 0.015);
  coveShape.lineTo(0, 0);

  const makeCoveRun = (length: number): THREE.Mesh => {
    const geo = trackGeo(
      new THREE.ExtrudeGeometry(coveShape, {
        depth: length,
        bevelEnabled: false,
        curveSegments: 10,
      }),
    );
    const mesh = new THREE.Mesh(geo, coveMat);
    mesh.receiveShadow = true;
    return mesh;
  };

  // Left wall cove (runs Z from -HALF_L to +HALF_L)
  const leftCove = makeCoveRun(ROOM_LENGTH);
  leftCove.position.set(-HALF_W, 0, -HALF_L);
  group.add(leftCove);

  // Right wall cove
  const rightCove = makeCoveRun(ROOM_LENGTH);
  rightCove.rotation.y = Math.PI;
  rightCove.position.set(HALF_W, 0, HALF_L);
  group.add(rightCove);

  // Back entry wall cove (around +Z, split nicely or full width minus small entry step)
  const backCove = makeCoveRun(ROOM_WIDTH);
  backCove.rotation.y = Math.PI / 2;
  backCove.position.set(-HALF_W, 0, HALF_L);
  group.add(backCove);

  // Front production wall coves (flanking the double door opening)
  const frontLeftCove = makeCoveRun(sideSegmentW);
  frontLeftCove.rotation.y = -Math.PI / 2;
  frontLeftCove.position.set(-HALF_W + sideSegmentW, 0, -HALF_L);
  group.add(frontLeftCove);

  const frontRightCove = makeCoveRun(sideSegmentW);
  frontRightCove.rotation.y = -Math.PI / 2;
  frontRightCove.position.set(HALF_W, 0, -HALF_L);
  group.add(frontRightCove);

  // 8. Rounded Vertical Sanitary Corner Coves at all 4 room corners
  const vertCoveShape = new THREE.Shape();
  const vr = 0.08;
  vertCoveShape.moveTo(0, 0);
  vertCoveShape.lineTo(vr, 0);
  vertCoveShape.absarc(vr, vr, vr, -Math.PI / 2, Math.PI, true);
  vertCoveShape.lineTo(0, vr);
  vertCoveShape.lineTo(0, 0);

  const vertCoveGeo = trackGeo(
    new THREE.ExtrudeGeometry(vertCoveShape, {
      depth: ROOM_HEIGHT,
      bevelEnabled: false,
      curveSegments: 10,
    }),
  );
  // Rotate so extrusion along +Z becomes vertical +Y
  vertCoveGeo.rotateX(-Math.PI / 2);

  const corners: Array<{ x: number; z: number; rotY: number }> = [
    { x: -HALF_W, z: -HALF_L, rotY: 0 },
    { x: HALF_W, z: -HALF_L, rotY: -Math.PI / 2 },
    { x: HALF_W, z: HALF_L, rotY: Math.PI },
    { x: -HALF_W, z: HALF_L, rotY: Math.PI / 2 },
  ];
  corners.forEach((c) => {
    const m = new THREE.Mesh(vertCoveGeo, coveMat);
    m.position.set(c.x, 0, c.z);
    m.rotation.y = c.rotY;
    group.add(m);
  });

  // 9. Linear Stainless Steel Floor Drains (Ralos Lineares com Grelhas Perfuradas em Inox)
  const drainLength = 9.0;
  const drainWidth = 0.14;
  const drainTroughMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7, metalness: 0.3 }),
  );
  const drainXPositions = [-2.3, 2.3];

  // Instanced perforated grate slats for crisp geometric detail
  const slatSpacing = 0.045;
  const slatsPerDrain = Math.floor(drainLength / slatSpacing);
  const totalSlats = slatsPerDrain * drainXPositions.length;
  const slatGeo = trackGeo(new THREE.BoxGeometry(drainWidth - 0.018, 0.004, 0.02));
  const slatInstanced = new THREE.InstancedMesh(slatGeo, steelMat, totalSlats);
  const dummy = new THREE.Object3D();
  let slatIdx = 0;

  drainXPositions.forEach((dx) => {
    // Dark recessed channel flush at y = 0.001
    const trough = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(drainWidth - 0.014, drainLength - 0.02)),
      drainTroughMat,
    );
    trough.rotation.x = -Math.PI / 2;
    trough.position.set(dx, 0.001, 0);
    group.add(trough);

    // Side stainless frame rails
    const railGeo = trackGeo(new THREE.BoxGeometry(0.014, 0.005, drainLength));
    const railL = new THREE.Mesh(railGeo, steelMat);
    railL.position.set(dx - drainWidth / 2, 0.0025, 0);
    group.add(railL);

    const railR = new THREE.Mesh(railGeo, steelMat);
    railR.position.set(dx + drainWidth / 2, 0.0025, 0);
    group.add(railR);

    for (let i = 0; i < slatsPerDrain; i++) {
      const sz = -drainLength / 2 + 0.03 + i * slatSpacing;
      dummy.position.set(dx, 0.002, sz);
      dummy.updateMatrix();
      slatInstanced.setMatrixAt(slatIdx++, dummy.matrix);
    }
  });
  slatInstanced.instanceMatrix.needsUpdate = true;
  slatInstanced.computeBoundingSphere();
  group.add(slatInstanced);

  // 10. Recessed Ceiling Neutral-White LED Panels & Balanced Industrial Lighting
  const ledFrameMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xdbe0e5, roughness: 0.35, metalness: 0.7 }),
  );
  const ledPanelMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xf8fbff,
      emissiveIntensity: 1.5,
      roughness: 0.25,
    }),
  );

  const ledCoords: Array<[number, number]> = [
    [-1.25, -3.2],
    [1.25, -3.2],
    [-1.25, 0.0],
    [1.25, 0.0],
    [-1.25, 3.2],
    [1.25, 3.2],
  ];

  const fixtureFrameGeo = trackGeo(new THREE.BoxGeometry(0.68, 0.028, 1.28));
  const fixtureDiffuserGeo = trackGeo(new THREE.PlaneGeometry(0.6, 1.2));

  ledCoords.forEach(([lx, lz], idx) => {
    const fixture = new THREE.Group();
    fixture.position.set(lx, ROOM_HEIGHT - 0.01, lz);
    const frame = new THREE.Mesh(fixtureFrameGeo, ledFrameMat);
    const diffuser = new THREE.Mesh(fixtureDiffuserGeo, ledPanelMat);
    diffuser.rotation.x = Math.PI / 2;
    diffuser.position.y = -0.015;
    fixture.add(frame, diffuser);
    group.add(fixture);

    // Add balanced fill point lights on centerline rows (3 lights total for optimal shader cost)
    if (idx % 2 === 0) {
      const pt = new THREE.PointLight(0xf6f9fc, 5.2, 11, 2);
      pt.position.set(0, ROOM_HEIGHT - 0.25, lz);
      group.add(pt);
    }
  });

  // Cool/Neutral Hemisphere Fill
  const hemi = new THREE.HemisphereLight(0xf4f8fc, 0xcbd2d6, 0.78);
  group.add(hemi);

  // Warm-Neutral Key Directional Light (tight shadow frustum)
  const keyLight = new THREE.DirectionalLight(0xfffaf2, 1.15);
  keyLight.position.set(1.8, 3.05, 1.5);
  keyLight.target.position.set(-0.4, 0, -1.2);
  if (!isSoftwareGl) {
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 0.4;
    keyLight.shadow.camera.far = 14;
    keyLight.shadow.camera.left = -5.5;
    keyLight.shadow.camera.right = 5.5;
    keyLight.shadow.camera.top = 6;
    keyLight.shadow.camera.bottom = -6;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
  }
  group.add(keyLight, keyLight.target);

  // 11. Quadro Informativo de BPF (Composite Frame on Right Wall, x = +2.78, z = +1.95)
  const boardGroup = new THREE.Group();
  boardGroup.position.set(HALF_W - 0.02, 1.62, 1.95);
  boardGroup.rotation.y = -Math.PI / 2;

  const boardW = 1.72;
  const boardH = 1.22;
  const boardBack = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(boardW + 0.06, boardH + 0.06, 0.025)),
    steelMat,
  );
  boardBack.castShadow = true;
  boardGroup.add(boardBack);

  // Frame perimeter bars (top, bottom, left, right)
  const barHGeo = trackGeo(new THREE.BoxGeometry(boardW + 0.08, 0.035, 0.042));
  const barVGeo = trackGeo(new THREE.BoxGeometry(0.035, boardH + 0.08, 0.042));
  const topBar = new THREE.Mesh(barHGeo, steelMat);
  topBar.position.set(0, boardH / 2 + 0.02, 0.008);
  const botBar = new THREE.Mesh(barHGeo, steelMat);
  botBar.position.set(0, -boardH / 2 - 0.02, 0.008);
  const leftBar = new THREE.Mesh(barVGeo, steelMat);
  leftBar.position.set(-boardW / 2 - 0.02, 0, 0.008);
  const rightBar = new THREE.Mesh(barVGeo, steelMat);
  rightBar.position.set(boardW / 2 + 0.02, 0, 0.008);
  boardGroup.add(topBar, botBar, leftBar, rightBar);

  // Printed Graphic Plate
  const boardFaceMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.bpfBoard,
      roughness: 0.35,
      metalness: 0.02,
    }),
  );
  const boardFace = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(boardW, boardH)), boardFaceMat);
  boardFace.position.z = 0.015;
  boardGroup.add(boardFace);

  // Clear protective acrylic/glass sheet over the board
  const boardGlassMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.08,
      metalness: 0,
      transparent: true,
      opacity: 0.14,
      clearcoat: 1,
      depthWrite: false,
    }),
  );
  const boardGlass = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(boardW, boardH)), boardGlassMat);
  boardGlass.position.z = 0.022;
  boardGroup.add(boardGlass);

  // Interactive Raycast Proxy for the BPF Board
  const boardProxy = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(boardW + 0.1, boardH + 0.1, 0.12)),
    trackMat(new THREE.MeshBasicMaterial({ visible: false })),
  );
  boardProxy.userData.stationId = 'quadro';
  boardGroup.add(boardProxy);

  group.add(boardGroup);

  return {
    group,
    boardProxy,
    dispose: () => {
      wallTexLong.dispose();
      wallRoughLong.dispose();
      wallBumpLong.dispose();
      wallTexShort.dispose();
      wallRoughShort.dispose();
      wallBumpShort.dispose();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
