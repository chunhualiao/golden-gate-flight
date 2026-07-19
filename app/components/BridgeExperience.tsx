"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense, useMemo, useState } from "react";
import {
  ACESFilmicToneMapping,
  CineonToneMapping,
  NoToneMapping,
  SRGBColorSpace,
} from "three";
import { GoldenGateScene, type ViewpointRequest } from "./GoldenGateScene";

type Quality = "cinematic" | "balanced" | "performance";

const VIEWPOINTS = [
  { label: "Approach", short: "01" },
  { label: "Midspan", short: "02" },
  { label: "Above", short: "03" },
  { label: "Waterline", short: "04" },
] as const;

function formatTime(time: number) {
  const hour = Math.floor(time);
  const minutes = Math.round((time - hour) * 60);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function conditionLabel(time: number) {
  if (time < 5 || time >= 21) return "Night";
  if (time < 7.5) return "Dawn";
  if (time < 17.5) return "Daylight";
  if (time < 20) return "Golden hour";
  return "Blue hour";
}

export function BridgeExperience() {
  const [timeOfDay, setTimeOfDay] = useState(17.1);
  const [fogLevel, setFogLevel] = useState(28);
  const [quality, setQuality] = useState<Quality>("cinematic");
  const [flightSpeed, setFlightSpeed] = useState(34);
  const [traffic, setTraffic] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [viewpoint, setViewpoint] = useState<ViewpointRequest>({
    index: 0,
    nonce: 0,
  });

  const dpr = useMemo<[number, number]>(() => {
    if (quality === "cinematic") return [1, 2];
    if (quality === "balanced") return [1, 1.5];
    return [0.75, 1];
  }, [quality]);

  const daylight = Math.max(
    0,
    Math.sin(((timeOfDay - 6) / 12) * Math.PI),
  );

  function chooseView(index: number) {
    setViewpoint((current) => ({ index, nonce: current.nonce + 1 }));
  }

  return (
    <section className="bridge-experience" aria-label="Golden Gate 3D flight">
      <div className="canvas-wrap" id="flight-canvas">
        <Canvas
          dpr={dpr}
          shadows={quality !== "performance"}
          camera={{
            position: [78, 64, -338],
            fov: 58,
            near: 0.25,
            far: 1800,
          }}
          gl={{
            antialias: quality !== "performance",
            powerPreference: "high-performance",
            alpha: false,
          }}
          onCreated={({ camera, gl }) => {
            camera.lookAt(0, 34, 0);
            gl.outputColorSpace = SRGBColorSpace;
            gl.toneMapping =
              quality === "cinematic"
                ? ACESFilmicToneMapping
                : quality === "balanced"
                  ? CineonToneMapping
                  : NoToneMapping;
            gl.toneMappingExposure = daylight < 0.08 ? 1.25 : 1.05;
          }}
        >
          <Suspense fallback={null}>
            <GoldenGateScene
              timeOfDay={timeOfDay}
              fogLevel={fogLevel}
              quality={quality}
              flightSpeed={flightSpeed}
              traffic={traffic}
              viewpoint={viewpoint}
            />
          </Suspense>
        </Canvas>
      </div>

      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            GG
          </span>
          <div>
            <p className="eyebrow">Interactive landmark study</p>
            <h1>Golden Gate</h1>
          </div>
        </div>
        <div className="live-conditions" aria-live="polite">
          <span className={daylight > 0.1 ? "sun-dot" : "sun-dot night"} />
          <span>{conditionLabel(timeOfDay)}</span>
          <span className="condition-divider" />
          <span>{formatTime(timeOfDay)}</span>
          <span className="condition-divider" />
          <span>{fogLevel}% fog</span>
        </div>
        <div className="topbar-actions">
          <button
            className="return-bridge"
            type="button"
            onClick={() => chooseView(0)}
          >
            ↺ Return to bridge
          </button>
          <button
            className="panel-toggle"
            type="button"
            onClick={() => setPanelOpen((open) => !open)}
            aria-expanded={panelOpen}
            aria-controls="environment-panel"
          >
            {panelOpen ? "Hide controls" : "Environment"}
          </button>
        </div>
      </header>

      <aside
        id="environment-panel"
        className={`environment-panel ${panelOpen ? "is-open" : ""}`}
        aria-label="Environment controls"
      >
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Live atmosphere</p>
            <h2>Environment controls</h2>
          </div>
          <span className="panel-index">01</span>
        </div>

        <div className="control-group">
          <label className="control-label" htmlFor="sunlight">
            <span>Sunlight</span>
            <output htmlFor="sunlight">{formatTime(timeOfDay)}</output>
          </label>
          <input
            id="sunlight"
            data-testid="sunlight-control"
            type="range"
            min="0"
            max="24"
            step="0.1"
            value={timeOfDay}
            onChange={(event) => setTimeOfDay(Number(event.target.value))}
            style={{ "--range-value": `${(timeOfDay / 24) * 100}%` } as React.CSSProperties}
          />
          <span className="range-scale">
            <span>Night</span>
            <span>Noon</span>
            <span>Night</span>
          </span>
          <div className="quick-presets" aria-label="Sunlight presets">
            <button type="button" onClick={() => setTimeOfDay(0.3)}>Night</button>
            <button type="button" onClick={() => setTimeOfDay(12)}>Noon</button>
            <button type="button" onClick={() => setTimeOfDay(18.6)}>Sunset</button>
          </div>
        </div>

        <div className="control-group">
          <label className="control-label" htmlFor="fog">
            <span>Coastal fog</span>
            <output htmlFor="fog">{fogLevel}%</output>
          </label>
          <input
            id="fog"
            data-testid="fog-control"
            type="range"
            min="0"
            max="100"
            step="1"
            value={fogLevel}
            onChange={(event) => setFogLevel(Number(event.target.value))}
            style={{ "--range-value": `${fogLevel}%` } as React.CSSProperties}
          />
          <span className="range-scale">
            <span>Clear</span>
            <span>Marine layer</span>
          </span>
          <div className="quick-presets" aria-label="Fog presets">
            <button type="button" onClick={() => setFogLevel(0)}>Clear</button>
            <button type="button" onClick={() => setFogLevel(35)}>Light</button>
            <button type="button" onClick={() => setFogLevel(78)}>Dense</button>
          </div>
        </div>

        <div className="control-group">
          <label className="control-label" htmlFor="speed">
            <span>Flight speed</span>
            <output htmlFor="speed">{flightSpeed} m/s</output>
          </label>
          <input
            id="speed"
            type="range"
            min="12"
            max="80"
            step="1"
            value={flightSpeed}
            onChange={(event) => setFlightSpeed(Number(event.target.value))}
            style={{
              "--range-value": `${((flightSpeed - 12) / 68) * 100}%`,
            } as React.CSSProperties}
          />
        </div>

        <div className="split-control">
          <label htmlFor="quality">Render detail</label>
          <select
            id="quality"
            value={quality}
            onChange={(event) => setQuality(event.target.value as Quality)}
          >
            <option value="cinematic">Cinematic</option>
            <option value="balanced">Balanced</option>
            <option value="performance">Performance</option>
          </select>
        </div>

        <label className="toggle-row" htmlFor="traffic">
          <span>
            <strong>Live traffic</strong>
            <small>Headlights respond after dusk</small>
          </span>
          <input
            id="traffic"
            type="checkbox"
            checked={traffic}
            onChange={(event) => setTraffic(event.target.checked)}
          />
          <span className="toggle-track" aria-hidden="true" />
        </label>
      </aside>

      <nav className="viewpoints" aria-label="Preset viewpoints">
        <p className="eyebrow">Quick positions</p>
        <div>
          {VIEWPOINTS.map((view, index) => (
            <button
              type="button"
              key={view.label}
              onClick={() => chooseView(index)}
              className={viewpoint.index === index ? "active" : ""}
              aria-label={`Move to ${view.label} viewpoint`}
            >
              <span>{view.short}</span>
              {view.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="flight-help" aria-label="Flight keyboard controls">
        <div className="key-cluster">
          <kbd>W</kbd>
          <span>
            <kbd>A</kbd>
            <kbd>S</kbd>
            <kbd>D</kbd>
          </span>
        </div>
        <p>
          <strong>Fly</strong>
          Drag to look
        </p>
        <span className="help-divider" />
        <p>
          <strong>Space / Q</strong>
          Rise / descend
        </p>
        <span className="help-divider" />
        <p>
          <strong>Shift</strong>
          Boost
        </p>
        <span className="help-divider" />
        <p>
          <strong>R</strong>
          Reset
        </p>
      </div>

      <div className="compass" aria-hidden="true">
        <span>N</span>
        <div className="compass-line" />
        <small>MARIN</small>
      </div>

      <div className="frame-corners" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>

      <p className="mobile-note">
        Drag to look · Choose Return to bridge whenever you want the landmark centered.
      </p>
    </section>
  );
}
