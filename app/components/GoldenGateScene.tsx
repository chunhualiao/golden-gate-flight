"use client";

import { Sky, Stars } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  BufferGeometry,
  BackSide,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  MathUtils,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from "three";

export type ViewpointRequest = {
  index: number;
  nonce: number;
};

type SceneProps = {
  timeOfDay: number;
  fogLevel: number;
  quality: "cinematic" | "balanced" | "performance";
  flightSpeed: number;
  traffic: boolean;
  viewpoint: ViewpointRequest;
};

const INTERNATIONAL_ORANGE = "#c84c30";
const DARK_STEEL = "#3b2b28";
const ROAD = "#17191b";
const DECK_Y = 29;
const TOWER_Z = 128;
const TOWER_TOP = 86;
const BRIDGE_END = 278;
const DRAG_THRESHOLD_PX = 4;

const VIEWPOINTS = [
  { position: [78, 64, -338], target: [0, 36, 0] },
  { position: [25, 38, -8], target: [0, 36, 95] },
  { position: [92, 128, -55], target: [0, 30, 10] },
  { position: [-56, 8, -150], target: [0, 38, -70] },
] as const;

function smoothstep(min: number, max: number, value: number) {
  const x = MathUtils.clamp((value - min) / (max - min), 0, 1);
  return x * x * (3 - 2 * x);
}

function daylightAt(timeOfDay: number) {
  const elevation = Math.sin(((timeOfDay - 6) / 12) * Math.PI);
  return smoothstep(-0.08, 0.35, elevation);
}

function sunPositionAt(timeOfDay: number): [number, number, number] {
  const angle = ((timeOfDay - 6) / 12) * Math.PI;
  return [Math.cos(angle) * 260, Math.sin(angle) * 300, -180];
}

export function GoldenGateScene({
  timeOfDay,
  fogLevel,
  quality,
  flightSpeed,
  traffic,
  viewpoint,
}: SceneProps) {
  const daylight = daylightAt(timeOfDay);
  const night = 1 - daylight;
  const sunPosition = sunPositionAt(timeOfDay);
  const fogColor = useMemo(() => {
    const midnight = new Color("#08131f");
    const sunset = new Color("#d4a18a");
    const day = new Color("#9eb7c3");
    const duskAmount = Math.max(0, 1 - Math.abs(timeOfDay - 18.5) / 2.6);
    return midnight.lerp(day, daylight).lerp(sunset, duskAmount * 0.34);
  }, [daylight, timeOfDay]);
  const fogDensity = 0.00025 + Math.pow(fogLevel / 100, 1.8) * 0.012;

  return (
    <>
      <Sky
        distance={1200}
        sunPosition={sunPosition}
        inclination={0.49}
        azimuth={0.25}
        turbidity={5 + fogLevel * 0.05}
        rayleigh={0.6 + daylight * 2.1}
        mieCoefficient={0.006 + fogLevel * 0.00008}
        mieDirectionalG={0.82}
      />
      {night > 0.02 && (
        <mesh>
          <sphereGeometry args={[1080, 32, 18]} />
          <meshBasicMaterial
            color="#071524"
            side={BackSide}
            transparent
            opacity={night * 0.86}
            depthWrite={false}
          />
        </mesh>
      )}
      <fogExp2 attach="fog" args={[fogColor, fogDensity]} />

      {night > 0.4 && (
        <Stars
          radius={560}
          depth={90}
          count={quality === "performance" ? 900 : 2200}
          factor={3.2}
          saturation={0.45}
          fade
          speed={0.12}
        />
      )}

      <ambientLight intensity={0.24 + daylight * 0.34} color="#b9d3e8" />
      <hemisphereLight
        intensity={0.32 + daylight * 0.66}
        color={daylight > 0.35 ? "#d9edff" : "#48627e"}
        groundColor={daylight > 0.35 ? "#32433b" : "#111927"}
      />
      <directionalLight
        castShadow={quality !== "performance"}
        position={sunPosition}
        intensity={0.12 + daylight * 3.2}
        color={
          daylight > 0.72
            ? "#fff1d0"
            : daylight > 0.08
              ? "#ff9a62"
              : "#8ea9d4"
        }
        shadow-mapSize-width={quality === "cinematic" ? 2048 : 1024}
        shadow-mapSize-height={quality === "cinematic" ? 2048 : 1024}
        shadow-camera-far={700}
        shadow-camera-left={-280}
        shadow-camera-right={280}
        shadow-camera-top={280}
        shadow-camera-bottom={-280}
        shadow-bias={-0.0004}
      />
      <directionalLight
        position={[-180, 220, 180]}
        intensity={night * 1.15}
        color="#8eb4ec"
      />
      {night > 0.55 && (
        <mesh position={[-210, 260, 420]}>
          <sphereGeometry args={[14, 24, 16]} />
          <meshBasicMaterial color="#d9e7f7" />
        </mesh>
      )}

      <OceanWater
        daylight={daylight}
        fogLevel={fogLevel}
        quality={quality}
        sunPosition={sunPosition}
      />
      <GoldenGateBridge night={night} quality={quality} />
      <BayEnvironment daylight={daylight} night={night} quality={quality} />
      {traffic && <Traffic night={night} />}

      <FlightController
        speed={flightSpeed}
        viewpoint={viewpoint}
      />

    </>
  );
}

function FlightController({
  speed,
  viewpoint,
}: {
  speed: number;
  viewpoint: ViewpointRequest;
}) {
  const keys = useRef(new Set<string>());
  const { camera, gl } = useThree();
  const cameraRef = useRef(camera);

  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  useEffect(() => {
    const canvas = gl.domElement;
    let dragging = false;
    let dragStarted = false;
    let previousX = 0;
    let previousY = 0;

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      dragging = true;
      dragStarted = false;
      previousX = event.clientX;
      previousY = event.clientY;
      cameraRef.current.rotation.reorder("YXZ");
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      if ((event.buttons & 1) === 0) {
        dragging = false;
        return;
      }
      const yaw = event.clientX - previousX;
      const pitch = event.clientY - previousY;
      if (!dragStarted) {
        if (Math.hypot(yaw, pitch) < DRAG_THRESHOLD_PX) return;
        dragStarted = true;
      }
      previousX = event.clientX;
      previousY = event.clientY;
      cameraRef.current.rotation.y -= yaw * 0.0026;
      cameraRef.current.rotation.x = MathUtils.clamp(
        cameraRef.current.rotation.x - pitch * 0.0026,
        -Math.PI / 2 + 0.04,
        Math.PI / 2 - 0.04,
      );
    };
    const stopDragging = () => {
      dragging = false;
      dragStarted = false;
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", stopDragging);
    canvas.addEventListener("pointercancel", stopDragging);
    canvas.addEventListener("pointerleave", stopDragging);
    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", stopDragging);
      canvas.removeEventListener("pointercancel", stopDragging);
      canvas.removeEventListener("pointerleave", stopDragging);
    };
  }, [gl]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      keys.current.add(event.code);
      if (["KeyW", "KeyA", "KeyS", "KeyD", "Space", "KeyQ"].includes(event.code)) {
        event.preventDefault();
      }
      if (event.code === "KeyR") {
        const view = VIEWPOINTS[0];
        cameraRef.current.position.set(...view.position);
        cameraRef.current.lookAt(...view.target);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => keys.current.delete(event.code);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [camera]);

  useEffect(() => {
    const view = VIEWPOINTS[viewpoint.index] ?? VIEWPOINTS[0];
    cameraRef.current.position.set(...view.position);
    cameraRef.current.lookAt(...view.target);
  }, [viewpoint]);

  useFrame((_, delta) => {
    const active = keys.current;
    const boost = active.has("ShiftLeft") || active.has("ShiftRight") ? 2.7 : 1;
    const distance = Math.min(delta, 0.05) * speed * boost;
    if (active.has("KeyW")) cameraRef.current.translateZ(-distance);
    if (active.has("KeyS")) cameraRef.current.translateZ(distance);
    if (active.has("KeyA")) cameraRef.current.translateX(-distance);
    if (active.has("KeyD")) cameraRef.current.translateX(distance);
    if (active.has("Space") || active.has("KeyE")) cameraRef.current.position.y += distance;
    if (active.has("KeyQ") || active.has("KeyC")) cameraRef.current.position.y -= distance;
    cameraRef.current.position.y = Math.max(
      -8,
      Math.min(520, cameraRef.current.position.y),
    );
  });

  return null;
}

function OceanWater({
  daylight,
  fogLevel,
  quality,
  sunPosition,
}: {
  daylight: number;
  fogLevel: number;
  quality: SceneProps["quality"];
  sunPosition: [number, number, number];
}) {
  const material = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDaylight: { value: daylight },
      uFog: { value: fogLevel / 100 },
      uSun: { value: new Vector3(...sunPosition).normalize() },
      uDeep: { value: new Color("#061f2d") },
      uShallow: { value: new Color("#2d7181") },
      uNight: { value: new Color("#061629") },
    }),
    [daylight, fogLevel, sunPosition],
  );

  useFrame(({ clock }) => {
    if (material.current) material.current.uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.9, 0]} receiveShadow>
      <planeGeometry
        args={[
          1400,
          1400,
          quality === "cinematic" ? 180 : quality === "balanced" ? 110 : 64,
          quality === "cinematic" ? 180 : quality === "balanced" ? 110 : 64,
        ]}
      />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={WATER_VERTEX_SHADER}
        fragmentShader={WATER_FRAGMENT_SHADER}
        side={DoubleSide}
      />
    </mesh>
  );
}

const WATER_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorldPosition;
  varying float vWave;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 p = position;
    float broad = sin(p.x * 0.021 + uTime * 0.72) * 0.58;
    broad += sin(p.y * 0.029 - uTime * 0.54) * 0.38;
    float detail = sin((p.x + p.y) * 0.082 + uTime * 1.15) * 0.16;
    detail += sin((p.x - p.y) * 0.13 - uTime * 0.9) * 0.1;
    p.z += broad + detail;
    vWave = broad + detail;
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorldPosition = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const WATER_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uDaylight;
  uniform float uFog;
  uniform vec3 uSun;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uNight;
  varying vec3 vWorldPosition;
  varying float vWave;
  varying vec2 vUv;

  float ripple(vec2 p) {
    return sin(p.x * 54.0 + uTime * 1.7) * sin(p.y * 37.0 - uTime * 1.25);
  }

  void main() {
    vec2 p = vWorldPosition.xz * 0.018;
    float r = ripple(p) * 0.16 + ripple(p * 1.83 + 2.1) * 0.08;
    vec3 normal = normalize(vec3(r, 1.0, r * 0.72 + vWave * 0.05));
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.2);
    float specular = pow(max(dot(reflect(-uSun, normal), viewDir), 0.0), 84.0);
    vec3 dayColor = mix(uDeep, uShallow, 0.35 + fresnel * 0.65 + r * 0.14);
    vec3 color = mix(uNight, dayColor, uDaylight);
    color += vec3(1.0, 0.69, 0.42) * specular * (0.2 + uDaylight * 2.4);
    color = mix(color, vec3(0.54, 0.64, 0.68), uFog * 0.12);
    gl_FragColor = vec4(color, 1.0);
  }
`;

function GoldenGateBridge({
  night,
  quality,
}: {
  night: number;
  quality: SceneProps["quality"];
}) {
  const towers = [-TOWER_Z, TOWER_Z];
  const sections = useMemo(
    () =>
      Array.from(
        { length: quality === "performance" ? 37 : 57 },
        (_, index) => -BRIDGE_END + index * ((BRIDGE_END * 2) / (quality === "performance" ? 36 : 56)),
      ),
    [quality],
  );

  return (
    <group>
      <BridgeDeck sections={sections} night={night} />
      {towers.map((z) => (
        <BridgeTower key={z} z={z} night={night} />
      ))}
      <SuspensionSystem quality={quality} />
      <Anchorages />
    </group>
  );
}

function BridgeDeck({ sections, night }: { sections: number[]; night: number }) {
  return (
    <group>
      <mesh position={[0, DECK_Y, 0]} castShadow receiveShadow>
        <boxGeometry args={[24, 1.6, BRIDGE_END * 2]} />
        <meshStandardMaterial color={ROAD} roughness={0.84} metalness={0.08} />
      </mesh>
      <mesh position={[-11.3, DECK_Y + 1.1, 0]} castShadow>
        <boxGeometry args={[1.4, 0.65, BRIDGE_END * 2]} />
        <meshStandardMaterial color="#7d675f" roughness={0.88} />
      </mesh>
      <mesh position={[11.3, DECK_Y + 1.1, 0]} castShadow>
        <boxGeometry args={[1.4, 0.65, BRIDGE_END * 2]} />
        <meshStandardMaterial color="#7d675f" roughness={0.88} />
      </mesh>

      {[-6.2, 0, 6.2].map((x) => (
        <group key={x}>
          {Array.from({ length: 70 }, (_, index) => (
            <mesh
              key={index}
              position={[x, DECK_Y + 0.86, -270 + index * 7.8]}
            >
              <boxGeometry args={[0.16, 0.025, 4.6]} />
              <meshStandardMaterial color="#e8e0c9" roughness={0.62} />
            </mesh>
          ))}
        </group>
      ))}

      {[-12.15, 12.15].map((x) => (
        <group key={x}>
          <mesh position={[x, 25.4, 0]} castShadow>
            <boxGeometry args={[0.55, 0.6, BRIDGE_END * 2]} />
            <meshStandardMaterial color={INTERNATIONAL_ORANGE} metalness={0.64} roughness={0.36} />
          </mesh>
          <mesh position={[x, 20.8, 0]} castShadow>
            <boxGeometry args={[0.48, 0.52, BRIDGE_END * 2]} />
            <meshStandardMaterial color={DARK_STEEL} metalness={0.72} roughness={0.4} />
          </mesh>
          <mesh position={[x, 31.5, 0]}>
            <boxGeometry args={[0.15, 0.16, BRIDGE_END * 2]} />
            <meshStandardMaterial
              color="#a23f2b"
              emissive="#ff7046"
              emissiveIntensity={night * 0.16}
              metalness={0.66}
              roughness={0.35}
            />
          </mesh>
          {sections.map((z, index) => (
            <group key={z}>
              <Beam
                start={[x, 21, z]}
                end={[x, 29, z]}
                thickness={0.32}
                color={INTERNATIONAL_ORANGE}
              />
              {index < sections.length - 1 && (
                <Beam
                  start={[x, index % 2 ? 21 : 29, z]}
                  end={[x, index % 2 ? 29 : 21, sections[index + 1]]}
                  thickness={0.28}
                  color={INTERNATIONAL_ORANGE}
                />
              )}
            </group>
          ))}
        </group>
      ))}

      {sections.filter((_, index) => index % 2 === 0).map((z) => (
        <Beam
          key={z}
          start={[-12.2, 21, z]}
          end={[12.2, 21, z]}
          thickness={0.28}
          color={DARK_STEEL}
        />
      ))}

      <BridgeLamps night={night} />
    </group>
  );
}

function BridgeTower({ z, night }: { z: number; night: number }) {
  return (
    <group position={[0, 0, z]}>
      {[-10.5, 10.5].map((x) => (
        <group key={x}>
          <mesh position={[x, 56, 0]} castShadow receiveShadow>
            <boxGeometry args={[5.3, 61, 6.5]} />
            <meshStandardMaterial
              color={INTERNATIONAL_ORANGE}
              metalness={0.68}
              roughness={0.32}
            />
          </mesh>
          <mesh position={[x * 1.01, 57, -3.35]}>
            <boxGeometry args={[1.4, 56, 0.26]} />
            <meshStandardMaterial color="#e26a48" metalness={0.6} roughness={0.34} />
          </mesh>
          <mesh position={[x, 88.25, 0]} castShadow>
            <boxGeometry args={[6.8, 3.8, 8]} />
            <meshStandardMaterial color={INTERNATIONAL_ORANGE} metalness={0.7} roughness={0.3} />
          </mesh>
          <pointLight
            position={[x, 89.5, 0]}
            color="#ff4a34"
            intensity={night * 9}
            distance={34}
            decay={2}
          />
          <mesh position={[x, 90.4, 0]}>
            <sphereGeometry args={[0.42, 12, 8]} />
            <meshStandardMaterial
              color="#ff3a2a"
              emissive="#ff1b10"
              emissiveIntensity={night * 6}
            />
          </mesh>
        </group>
      ))}

      {[42, 61, 78].map((y, index) => (
        <group key={y}>
          <mesh position={[0, y, 0]} castShadow>
            <boxGeometry args={[26.5, index === 2 ? 4 : 3.2, 5.7]} />
            <meshStandardMaterial color={INTERNATIONAL_ORANGE} metalness={0.68} roughness={0.32} />
          </mesh>
          <mesh position={[0, y, -3]}>
            <boxGeometry args={[19, 0.7, 0.24]} />
            <meshStandardMaterial color="#e26a48" metalness={0.6} roughness={0.34} />
          </mesh>
        </group>
      ))}

      {[0, Math.PI].map((rotation) => (
        <group key={rotation} rotation={[0, rotation, 0]}>
          <Beam start={[-8, 44, -3.1]} end={[8, 58.8, -3.1]} thickness={0.65} color="#ab3e2a" />
          <Beam start={[8, 44, -3.1]} end={[-8, 58.8, -3.1]} thickness={0.65} color="#ab3e2a" />
          <Beam start={[-8, 63, -3.1]} end={[8, 75.8, -3.1]} thickness={0.58} color="#ab3e2a" />
          <Beam start={[8, 63, -3.1]} end={[-8, 75.8, -3.1]} thickness={0.58} color="#ab3e2a" />
        </group>
      ))}

      {[-10.5, 10.5].map((x) => (
        <mesh key={x} position={[x, 7.8, 0]} receiveShadow>
          <cylinderGeometry args={[7.4, 9.2, 15.6, 12]} />
          <meshStandardMaterial color="#565755" roughness={0.96} />
        </mesh>
      ))}
    </group>
  );
}

function SuspensionSystem({ quality }: { quality: SceneProps["quality"] }) {
  const mainCurves = useMemo(
    () =>
      [-13.35, 13.35].map((x) => {
        const points = Array.from({ length: 65 }, (_, index) => {
          const z = -TOWER_Z + index * ((TOWER_Z * 2) / 64);
          const y = 47 + 39 * Math.pow(Math.abs(z) / TOWER_Z, 2.05);
          return new Vector3(x, y, z);
        });
        return new CatmullRomCurve3(points);
      }),
    [],
  );
  const sideCurves = useMemo(
    () =>
      [-13.35, 13.35].flatMap((x) =>
        [-1, 1].map((side) => {
          const points = Array.from({ length: 28 }, (_, index) => {
            const t = index / 27;
            const z = side * (TOWER_Z + t * (BRIDGE_END - TOWER_Z));
            const y = TOWER_TOP - 61 * t + 7 * Math.sin(t * Math.PI);
            return new Vector3(x, y, z);
          });
          return new CatmullRomCurve3(points);
        }),
      ),
    [],
  );
  const hangerStep = quality === "performance" ? 16 : 9;
  const hangerPositions = useMemo(
    () => Array.from({ length: Math.floor((TOWER_Z * 2) / hangerStep) + 1 }, (_, i) => -TOWER_Z + i * hangerStep),
    [hangerStep],
  );
  const sideHangers = useMemo(
    () =>
      [-1, 1].flatMap((side) =>
        Array.from({ length: Math.floor((BRIDGE_END - TOWER_Z) / hangerStep) }, (_, i) =>
          side * (TOWER_Z + (i + 1) * hangerStep),
        ),
      ),
    [hangerStep],
  );

  function cableHeight(z: number) {
    if (Math.abs(z) <= TOWER_Z) {
      return 47 + 39 * Math.pow(Math.abs(z) / TOWER_Z, 2.05);
    }
    const t = (Math.abs(z) - TOWER_Z) / (BRIDGE_END - TOWER_Z);
    return TOWER_TOP - 61 * t + 7 * Math.sin(t * Math.PI);
  }

  return (
    <group>
      {[...mainCurves, ...sideCurves].map((curve, index) => (
        <mesh key={index} castShadow>
          <tubeGeometry args={[curve, quality === "performance" ? 64 : 140, 0.58, 10, false]} />
          <meshStandardMaterial color="#a83e2a" metalness={0.75} roughness={0.31} />
        </mesh>
      ))}
      {[-13.35, 13.35].flatMap((x) =>
        [...hangerPositions, ...sideHangers].map((z) => (
          <Beam
            key={`${x}-${z}`}
            start={[x, DECK_Y + 1.3, z]}
            end={[x, cableHeight(z), z]}
            thickness={0.105}
            color="#b74731"
          />
        )),
      )}
    </group>
  );
}

function Anchorages() {
  return (
    <group>
      {[-BRIDGE_END - 7, BRIDGE_END + 7].map((z) => (
        <group key={z} position={[0, 0, z]}>
          <mesh position={[-13.4, 19, 0]} castShadow receiveShadow>
            <boxGeometry args={[13, 29, 22]} />
            <meshStandardMaterial color="#6f6b62" roughness={0.94} />
          </mesh>
          <mesh position={[13.4, 19, 0]} castShadow receiveShadow>
            <boxGeometry args={[13, 29, 22]} />
            <meshStandardMaterial color="#6f6b62" roughness={0.94} />
          </mesh>
          <mesh position={[0, 31, 0]} castShadow>
            <boxGeometry args={[39, 6, 26]} />
            <meshStandardMaterial color="#8c8377" roughness={0.92} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function BridgeLamps({ night }: { night: number }) {
  const positions = useMemo(
    () => Array.from({ length: 31 }, (_, index) => -255 + index * 17),
    [],
  );
  return (
    <group>
      {[-10.5, 10.5].flatMap((x) =>
        positions.map((z, index) => (
          <group key={`${x}-${z}`} position={[x, DECK_Y + 1.3, z]}>
            <mesh position={[0, 2.2, 0]}>
              <cylinderGeometry args={[0.08, 0.12, 4.4, 8]} />
              <meshStandardMaterial color="#443d39" metalness={0.82} roughness={0.3} />
            </mesh>
            <mesh position={[0, 4.45, 0]}>
              <sphereGeometry args={[0.28, 12, 8]} />
              <meshStandardMaterial
                color="#fff1ba"
                emissive="#ffd680"
                emissiveIntensity={0.3 + night * 7}
              />
            </mesh>
            {index % 6 === 0 && (
              <pointLight
                position={[0, 4.2, 0]}
                color="#ffd792"
                intensity={night * 3.8}
                distance={22}
                decay={2}
              />
            )}
          </group>
        )),
      )}
    </group>
  );
}

function Beam({
  start,
  end,
  thickness,
  color,
}: {
  start: [number, number, number];
  end: [number, number, number];
  thickness: number;
  color: string;
}) {
  const { position, quaternion, length } = useMemo(() => {
    const startVector = new Vector3(...start);
    const endVector = new Vector3(...end);
    const direction = endVector.clone().sub(startVector);
    const midpoint = startVector.clone().add(endVector).multiplyScalar(0.5);
    const rotation = new Quaternion().setFromUnitVectors(
      new Vector3(0, 0, 1),
      direction.clone().normalize(),
    );
    return { position: midpoint, quaternion: rotation, length: direction.length() };
  }, [end, start]);

  return (
    <mesh position={position} quaternion={quaternion} castShadow>
      <boxGeometry args={[thickness, thickness, length]} />
      <meshStandardMaterial color={color} metalness={0.68} roughness={0.36} />
    </mesh>
  );
}

function Traffic({ night }: { night: number }) {
  const vehicles = useRef<Array<Group | null>>([]);
  const cars = useMemo(
    () =>
      Array.from({ length: 22 }, (_, index) => ({
        base: -255 + index * 24.2,
        lane: [-7.8, -4.8, 4.8, 7.8][index % 4],
        direction: index % 4 < 2 ? 1 : -1,
        speed: 9 + ((index * 7) % 6),
        color: ["#e7e0d4", "#182d43", "#692a25", "#b8afa4", "#26362d"][index % 5],
      })),
    [],
  );

  useFrame(({ clock }) => {
    const span = 532;
    cars.forEach((car, index) => {
      const vehicle = vehicles.current[index];
      if (!vehicle) return;
      const raw = car.base + clock.elapsedTime * car.speed * car.direction;
      vehicle.position.z = ((raw + span / 2) % span + span) % span - span / 2;
    });
  });

  return (
    <group>
      {cars.map((car, index) => (
        <group
          key={index}
          ref={(node) => {
            vehicles.current[index] = node;
          }}
          position={[car.lane, DECK_Y + 1.4, car.base]}
          rotation={[0, car.direction < 0 ? Math.PI : 0, 0]}
        >
          <mesh castShadow>
            <boxGeometry args={[1.45, 0.65, 3.2]} />
            <meshStandardMaterial color={car.color} metalness={0.42} roughness={0.34} />
          </mesh>
          <mesh position={[0, 0.53, -0.18]} castShadow>
            <boxGeometry args={[1.24, 0.52, 1.65]} />
            <meshStandardMaterial color="#18232a" metalness={0.68} roughness={0.18} />
          </mesh>
          {[-0.48, 0.48].map((x) => (
            <mesh key={`head-${x}`} position={[x, 0.05, 1.63]}>
              <boxGeometry args={[0.22, 0.16, 0.05]} />
              <meshStandardMaterial color="#fff8d2" emissive="#fff0ae" emissiveIntensity={night * 8} />
            </mesh>
          ))}
          {[-0.48, 0.48].map((x) => (
            <mesh key={`tail-${x}`} position={[x, 0.05, -1.63]}>
              <boxGeometry args={[0.22, 0.16, 0.05]} />
              <meshStandardMaterial color="#a91e18" emissive="#ff2215" emissiveIntensity={night * 5} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function BayEnvironment({
  daylight,
  night,
  quality,
}: {
  daylight: number;
  night: number;
  quality: SceneProps["quality"];
}) {
  const southTerrain = useMemo(() => createTerrainGeometry(-415, -1, quality), [quality]);
  const northTerrain = useMemo(() => createTerrainGeometry(415, 1, quality), [quality]);

  return (
    <group>
      <mesh geometry={southTerrain} receiveShadow castShadow>
        <meshStandardMaterial vertexColors roughness={0.96} metalness={0.02} />
      </mesh>
      <mesh geometry={northTerrain} receiveShadow castShadow>
        <meshStandardMaterial vertexColors roughness={0.96} metalness={0.02} />
      </mesh>
      <FortPoint />
      <DistantCity night={night} />
      <HeadlandDetails daylight={daylight} />
    </group>
  );
}

function createTerrainGeometry(
  centerZ: number,
  side: -1 | 1,
  quality: SceneProps["quality"],
) {
  const segmentsX = quality === "performance" ? 24 : 48;
  const segmentsZ = quality === "cinematic" ? 44 : 30;
  const width = 720;
  const depth = 350;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const rock = new Color("#514d45");
  const grass = new Color("#64705b");
  const dry = new Color("#88765e");

  for (let iz = 0; iz <= segmentsZ; iz += 1) {
    for (let ix = 0; ix <= segmentsX; ix += 1) {
      const x = -width / 2 + (ix / segmentsX) * width;
      const z = centerZ - depth / 2 + (iz / segmentsZ) * depth;
      const shoreDistance = side === 1 ? Math.max(0, z - 238) : Math.max(0, -238 - z);
      const broad = Math.sin(x * 0.018 + z * 0.007) * 8;
      const ridge = Math.sin(x * 0.007 - z * 0.017) * 5;
      const detail = Math.sin(x * 0.071 + z * 0.053) * 1.4;
      const coastalCliff = 7 + smoothstep(0, 52, shoreDistance) * 24;
      const y = coastalCliff + broad + ridge + detail + shoreDistance * 0.045;
      positions.push(x, Math.max(1.5, y), z);

      const heightMix = smoothstep(4, 50, y);
      const color = rock.clone().lerp(grass, 0.35 + heightMix * 0.42).lerp(dry, Math.max(0, detail) * 0.07);
      colors.push(color.r, color.g, color.b);
    }
  }

  for (let iz = 0; iz < segmentsZ; iz += 1) {
    for (let ix = 0; ix < segmentsX; ix += 1) {
      const a = iz * (segmentsX + 1) + ix;
      const b = a + 1;
      const c = a + segmentsX + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function FortPoint() {
  return (
    <group position={[-34, 5, -238]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[42, 14, 34]} />
        <meshStandardMaterial color="#8a6b55" roughness={0.92} />
      </mesh>
      <mesh position={[0, 8.2, 0]} castShadow>
        <boxGeometry args={[45, 3, 37]} />
        <meshStandardMaterial color="#9b7960" roughness={0.9} />
      </mesh>
      {[-13, 0, 13].flatMap((x) =>
        [-17.2, 17.2].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.5, z]}>
            <boxGeometry args={[5.2, 5.5, 0.35]} />
            <meshStandardMaterial color="#302c28" roughness={0.98} />
          </mesh>
        )),
      )}
    </group>
  );
}

function DistantCity({ night }: { night: number }) {
  const buildings = useMemo(
    () =>
      Array.from({ length: 34 }, (_, index) => ({
        x: -185 + ((index * 53) % 370),
        z: -555 - ((index * 19) % 65),
        width: 7 + ((index * 3) % 11),
        height: 18 + ((index * 17) % 62),
      })),
    [],
  );
  return (
    <group>
      {buildings.map((building, index) => (
        <mesh
          key={index}
          position={[building.x, building.height / 2 + 12, building.z]}
        >
          <boxGeometry args={[building.width, building.height, building.width]} />
          <meshStandardMaterial
            color="#263038"
            emissive="#e8c582"
            emissiveIntensity={night * (index % 3 === 0 ? 0.16 : 0.04)}
            roughness={0.82}
          />
        </mesh>
      ))}
    </group>
  );
}

function HeadlandDetails({ daylight }: { daylight: number }) {
  const rocks = useMemo(
    () =>
      Array.from({ length: 20 }, (_, index) => ({
        x: -220 + ((index * 47) % 440),
        z: index % 2 === 0 ? 248 + ((index * 13) % 34) : -248 - ((index * 11) % 31),
        scale: 5 + (index % 5) * 1.8,
      })),
    [],
  );
  return (
    <group>
      {rocks.map((rock, index) => (
        <mesh
          key={index}
          position={[rock.x, rock.scale * 0.15, rock.z]}
          scale={[rock.scale * 1.5, rock.scale, rock.scale]}
          rotation={[index * 0.19, index * 0.41, index * 0.13]}
          castShadow
          receiveShadow
        >
          <dodecahedronGeometry args={[1, 1]} />
          <meshStandardMaterial
            color={index % 3 === 0 ? "#736a5b" : "#59584f"}
            roughness={0.98}
          />
        </mesh>
      ))}
      <mesh position={[162, 52, 356]} castShadow>
        <cylinderGeometry args={[1.5, 2.6, 28, 12]} />
        <meshStandardMaterial color="#d9d2c4" roughness={0.76} />
      </mesh>
      <mesh position={[162, 67, 356]}>
        <sphereGeometry args={[2.3, 16, 10]} />
        <meshStandardMaterial
          color="#fff3c4"
          emissive="#fff0ae"
          emissiveIntensity={0.8 + (1 - daylight) * 4}
        />
      </mesh>
    </group>
  );
}
