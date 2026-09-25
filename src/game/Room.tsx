import { useMemo } from "react";
import { woodFloor, wallpaper, rug } from "./textures";

// Giant cube room: 10x the original floor length, ceiling as tall as the floor is long
export const ROOM = { w: 600, d: 600, h: 600 };
const S = 10; // furniture scale

function Box({ p, s, c, r = 0 }: { p: [number, number, number]; s: [number, number, number]; c: string; r?: number }) {
  return (
    <mesh position={p} rotation-y={r} castShadow receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} roughness={0.8} />
    </mesh>
  );
}

function Sofa({ p, r = 0 }: { p: [number, number, number]; r?: number }) {
  return (
    <group position={p} rotation-y={r}>
      <Box p={[0, 1, 0]} s={[10, 2, 4]} c="#3f5e5a" />
      <Box p={[0, 2.8, -1.6]} s={[10, 3.6, 1]} c="#365250" />
      <Box p={[-4.6, 2.2, 0]} s={[1, 2.4, 4]} c="#365250" />
      <Box p={[4.6, 2.2, 0]} s={[1, 2.4, 4]} c="#365250" />
      <Box p={[-2.2, 2.3, -0.3]} s={[4, 0.6, 3]} c="#4a6d68" />
      <Box p={[2.2, 2.3, -0.3]} s={[4, 0.6, 3]} c="#4a6d68" />
    </group>
  );
}

export function Room() {
  const floor = useMemo(() => {
    const t = woodFloor();
    t.repeat.multiplyScalar(10);
    return t;
  }, []);
  const wall = useMemo(() => {
    const t = wallpaper();
    t.repeat.set(t.repeat.x * 10, t.repeat.y * 40);
    return t;
  }, []);
  const rugT = useMemo(rug, []);
  const { w, d, h } = ROOM;
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial map={floor} roughness={0.6} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position={[0, h, 0]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#efe6d4" />
      </mesh>
      {[
        { p: [0, h / 2, -d / 2] as [number, number, number], r: 0, len: w },
        { p: [0, h / 2, d / 2] as [number, number, number], r: Math.PI, len: w },
        { p: [-w / 2, h / 2, 0] as [number, number, number], r: Math.PI / 2, len: d },
        { p: [w / 2, h / 2, 0] as [number, number, number], r: -Math.PI / 2, len: d },
      ].map((wl, i) => (
        <group key={i} position={wl.p} rotation-y={wl.r}>
          <mesh receiveShadow>
            <planeGeometry args={[wl.len, h]} />
            <meshStandardMaterial map={wall} roughness={0.9} />
          </mesh>
          <mesh position={[0, -h / 2 + 4, 1]}>
            <boxGeometry args={[wl.len, 8, 2]} />
            <meshStandardMaterial color="#f4ede0" />
          </mesh>
        </group>
      ))}
      {/* windows on back wall */}
      {[-140, 140].map((x) => (
        <group key={x} position={[x, 120, -d / 2 + 0.5]} scale={S}>
          <mesh>
            <planeGeometry args={[8, 6]} />
            <meshStandardMaterial color="#bfe0f5" emissive="#bfe0f5" emissiveIntensity={0.8} />
          </mesh>
          <Box p={[0, 0, 0.1]} s={[0.3, 6.2, 0.2]} c="#f4ede0" />
          <Box p={[0, 0, 0.1]} s={[8.2, 0.3, 0.2]} c="#f4ede0" />
          <Box p={[-5, 0, 0.3]} s={[2, 7.5, 0.3]} c="#9c3b3b" />
          <Box p={[5, 0, 0.3]} s={[2, 7.5, 0.3]} c="#9c3b3b" />
        </group>
      ))}
      {/* furniture, 10x scale */}
      <group scale={S}>
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.005, 0]} receiveShadow>
          <planeGeometry args={[22, 16]} />
          <meshStandardMaterial map={rugT} roughness={1} />
        </mesh>
        <Sofa p={[0, 0, 17]} r={Math.PI} />
        <Sofa p={[-24, 0, 0]} r={Math.PI / 2} />
        <Box p={[0, 1.2, -20.5]} s={[12, 2.4, 2.5]} c="#4b3424" />
        <Box p={[0, 5, -21.2]} s={[10, 5.5, 0.4]} c="#151515" />
        <group position={[26, 0, -12]}>
          <Box p={[0, 5, 0]} s={[3, 10, 7]} c="#5b3d27" />
          {[2, 4.5, 7].map((y) =>
            [-2.5, -1, 0.5, 2].map((z, i) => (
              <Box key={`${y}${z}`} p={[-1.2, y + 0.9, z]} s={[0.8, 1.6, 1.2]} c={["#8b2e2e", "#2e5a8b", "#c9a227", "#3c7a4a"][i]!} />
            )),
          )}
        </group>
        <group position={[22, 0, 12]} rotation-y={-Math.PI / 1.4}>
          <Box p={[0, 1, 0]} s={[4, 2, 4]} c="#a0522d" />
          <Box p={[0, 3, -1.6]} s={[4, 3, 0.8]} c="#8b4726" />
        </group>
        <group position={[-26, 0, -18]}>
          <Box p={[0, 4, 0]} s={[0.3, 8, 0.3]} c="#2b2b2b" />
          <mesh position={[0, 8.5, 0]}>
            <coneGeometry args={[1.5, 2, 16, 1, true]} />
            <meshStandardMaterial color="#f7e3b0" emissive="#ffcf7a" emissiveIntensity={0.6} side={2} />
          </mesh>
          <pointLight position={[0, 8, 0]} intensity={4000} distance={260} color="#ffcf8a" />
        </group>
        <group position={[26, 0, 18]}>
          <Box p={[0, 1, 0]} s={[2, 2, 2]} c="#b5651d" />
          <mesh position={[0, 3.5, 0]} castShadow>
            <icosahedronGeometry args={[2, 0]} />
            <meshStandardMaterial color="#3f7d3a" flatShading />
          </mesh>
        </group>
      </group>
    </group>
  );
}

// Axis-aligned obstacles (xz) for simple collision, scaled with furniture
export const OBSTACLES: { x: number; z: number; hw: number; hd: number }[] = [
  { x: 0, z: 17, hw: 5, hd: 2 },
  { x: -24, z: 0, hw: 2, hd: 5 },
  { x: 0, z: -20.5, hw: 6, hd: 1.3 },
  { x: 26, z: -12, hw: 1.5, hd: 3.5 },
  { x: 22, z: 12, hw: 2.2, hd: 2.2 },
  { x: 26, z: 18, hw: 1, hd: 1 },
].map((o) => ({ x: o.x * S, z: o.z * S, hw: o.hw * S, hd: o.hd * S }));
