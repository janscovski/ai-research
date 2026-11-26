"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Seamless animated background.
 *
 * Default: a tiny WebGL fragment shader. Every moving term is a function of
 * phase = 2π·t/PERIOD, so frame PERIOD equals frame 0 — the loop has no seam by
 * construction and needs no crossfade. No asset to download (0 KB).
 *
 * Alternative: NEXT_PUBLIC_BACKGROUND=video plays /loop/loop.webm (+ .mp4 fallback)
 * with /loop/poster.jpg. See README "Swapping the background loop".
 *
 * Static poster (CSS gradient) is shown first, for reduced motion, without WebGL,
 * on Save-Data, and while the shader is deferred until the page is idle.
 * Parallax: the light horizon drifts slightly as the deck advances — background only.
 */

const MODE = process.env.NEXT_PUBLIC_BACKGROUND === "video" ? "video" : "shader";

const VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;
const FRAG = `
precision mediump float;
uniform vec2 r;uniform float ph;uniform float s;uniform vec3 a;uniform float g;
float h(vec2 v){return fract(sin(dot(v,vec2(12.9898,78.233)))*43758.5453);}
void main(){
  vec2 p=(gl_FragCoord.xy-.5*r)/r.y;
  float f=sin(p.x*1.6+sin(ph)*1.3+p.y*.7)+sin(p.y*2.1-cos(ph)*1.4+p.x*.5)+sin((p.x+p.y)*1.2+sin(2.*ph)*.8);
  f/=3.;
  float y=p.y+.62+s*.22;
  float arc=exp(-pow((y-.2*p.x*p.x)*5.5,2.));
  float pulse=.6+.4*sin(ph+p.x*1.8);
  vec3 c=vec3(.035,.035,.039);
  c+=a*(.045+.035*f)*smoothstep(1.3,0.,length(p-vec2(.15*sin(ph),-.55)));
  c+=a*arc*pulse*.16;
  c+=a*.03*smoothstep(.9,0.,length(p-vec2(.75,.6+.05*cos(ph))));
  c+=(h(gl_FragCoord.xy+g)-.5)*.016;
  gl_FragColor=vec4(c,1.);
}`;

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.trim().replace("#", "");
  const n = parseInt(m.length === 3 ? m.replace(/./g, "$&$&") : m.slice(0, 6), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function canAnimate() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  return !reduce && !saveData;
}

export function Background() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [video, setVideo] = useState(false);

  useEffect(() => {
    if (!canAnimate()) return;
    if (MODE === "video") {
      const id = window.setTimeout(() => setVideo(true), 1200);
      return () => clearTimeout(id);
    }
    let raf = 0;
    let stop = false;
    let cleanup = () => {};
    const start = () => {
      const canvas = canvasRef.current;
      if (!canvas || stop) return;
      const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
      if (!gl) return;
      const sh = (type: number, src: string) => {
        const s = gl.createShader(type)!;
        gl.shaderSource(s, src);
        gl.compileShader(s);
        return s;
      };
      const prog = gl.createProgram()!;
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "p");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const u = (n: string) => gl.getUniformLocation(prog, n);
      const [uR, uPh, uS, uA, uG] = ["r", "ph", "s", "a", "g"].map(u);
      const css = getComputedStyle(document.documentElement);
      gl.uniform3fv(uA, hexToRgb(css.getPropertyValue("--color-accent") || "#4d8dff"));
      const period = Number(css.getPropertyValue("--bg-loop-seconds")) || 32;

      const SCALE = 0.5; // render at half resolution; it is a soft field
      const resize = () => {
        const w = Math.max(1, Math.floor(window.innerWidth * SCALE));
        const h = Math.max(1, Math.floor(window.innerHeight * SCALE));
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
        gl.uniform2f(uR, w, h);
      };
      resize();
      window.addEventListener("resize", resize);

      let scroll = 0;
      let last = 0;
      let first = true;
      const t0 = performance.now();
      const frame = (now: number) => {
        raf = requestAnimationFrame(frame);
        if (document.hidden || now - last < 1000 / 30) return; // 30 fps is plenty for a slow field
        last = now;
        // Parallax target: the slide deck's progress (0..1), or page scroll as a fallback.
        const deck = (window as Window & { __deckProgress?: number }).__deckProgress;
        const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        scroll += ((deck ?? window.scrollY / max) - scroll) * 0.05;
        const t = (now - t0) / 1000;
        gl.uniform1f(uPh, ((t % period) / period) * Math.PI * 2);
        gl.uniform1f(uS, scroll);
        gl.uniform1f(uG, Math.floor(t * 12) % 97);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        if (first) {
          first = false;
          setReady(true);
        }
      };
      raf = requestAnimationFrame(frame);
      cleanup = () => {
        window.removeEventListener("resize", resize);
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      };
    };

    // Defer until the page has loaded and the main thread is idle (protects LCP/TBT).
    const idle = (cb: () => void) => {
      const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
      if (w.requestIdleCallback) w.requestIdleCallback(cb, { timeout: 2500 });
      else setTimeout(cb, 1200);
    };
    const kick = () => idle(start);
    if (document.readyState === "complete") kick();
    else window.addEventListener("load", kick, { once: true });

    return () => {
      stop = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("load", kick);
      cleanup();
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
      <div className="bg-poster absolute inset-0" />
      {MODE === "shader" ? (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full transition-opacity duration-[2400ms]"
          style={{ opacity: ready ? 1 : 0 }}
        />
      ) : video ? (
        <video
          className="absolute inset-0 h-full w-full object-cover opacity-70"
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          poster="/loop/poster.jpg"
        >
          <source src="/loop/loop.webm" type="video/webm" />
          <source src="/loop/loop.mp4" type="video/mp4" />
        </video>
      ) : null}
    </div>
  );
}
