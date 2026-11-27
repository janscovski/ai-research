"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Seamless animated background.
 *
 * Default: a tiny WebGL fragment shader: navy sky, aurora ribbons, a horizon
 * light and a perspective grid floor sliding toward the viewer. Each slide can
 * set a colour family (blue, purple, green) and a hi-tech code layer through
 * window.__deckTheme; the shader eases between them. Every moving term is a function of
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
uniform vec2 r;uniform float ph;uniform float s;uniform vec3 a;uniform vec3 b;uniform float g;uniform float m;
float h(vec2 v){return fract(sin(dot(v,vec2(12.9898,78.233)))*43758.5453);}
void main(){
  vec2 uv=gl_FragCoord.xy/r;
  vec2 p=(gl_FragCoord.xy-.5*r)/r.y;
  float k=ph/6.2831853;                     // 0..1 over one loop
  // deep base tinted by the slide's colour, lighter at the top
  vec3 lo=vec3(.01,.014,.04)+a*.02;
  vec3 hi=vec3(.02,.03,.08)+a*.09;
  vec3 c=mix(lo,hi,smoothstep(-.1,1.,uv.y));
  float hz=-.2+s*.08;                         // horizon (drifts with deck progress)
  // aurora ribbons above the horizon
  for(int i=0;i<3;i++){
    float fi=float(i);
    float y0=hz+.2+fi*.17+.06*sin(p.x*1.4+ph+fi*2.1)+.03*sin(p.x*3.3-2.*ph+fi);
    float d=p.y-y0;
    float band=exp(-d*d*(70.+fi*40.))*(.6+.4*sin(ph+p.x*2.2+fi*1.7));
    c+=mix(a,b,.35+.3*sin(fi+ph))*band*(.16-fi*.035);
  }
  // horizon light
  c+=a*exp(-pow((p.y-hz)*7.,2.))*.42*(.85+.15*sin(ph));
  c+=b*exp(-pow((p.y-hz)*22.,2.))*exp(-p.x*p.x*1.6)*.35;
  // perspective grid floor moving toward the viewer (2 cells per loop: seamless)
  float dy=hz-p.y;
  if(dy>0.){
    float z=.32/dy;
    float gx=abs(fract(p.x*z*1.2)-.5);
    float gz=abs(fract(z-2.*k)-.5);
    float w=.025*z;
    float line=max(smoothstep(.5-w,.5,gx),smoothstep(.5-w*.8,.5,gz));
    float fade=exp(-z*.18)*smoothstep(0.,.05,dy);
    c+=mix(a,b,.3)*line*fade*.3;
    c+=a*.06*fade;
  }
  // sparse stars that twinkle in sync with the loop
  vec2 cell=floor(gl_FragCoord.xy/2.);
  float st=step(.9965,h(cell));
  c+=vec3(.75,.85,1.)*st*(.35+.35*sin(ph*3.+h(cell+7.)*6.2831))*smoothstep(hz,hz+.3,p.y)*(1.-m);
  // hi-tech code layer: falling glyph columns, stronger at the sides so text stays clear
  if(m>.01){
    vec2 cs=vec2(7.,10.);
    vec2 q=gl_FragCoord.xy/cs;
    vec2 cc=floor(q);
    vec2 f=fract(q);
    float on=step(.45,h(vec2(cc.x,3.)));
    float sp=1.+floor(h(vec2(cc.x,1.))*3.);   // whole cells per loop: seamless
    float rows=r.y/cs.y;
    float head=fract(h(vec2(cc.x,2.))+k*sp)*rows*1.5;
    float d=head-(rows-cc.y);
    float trail=d>0.?exp(-d*.1):0.;
    float tick=mod(floor(k*48.+h(cc)*48.),48.);
    vec2 gp=floor(vec2(f.x*4.,f.y*6.));
    float inside=step(gp.x,2.)*step(gp.y,4.)*step(.5,gp.y);
    float bit=step(.45,h(cc*7.31+gp+tick));
    float mask=.12+.88*smoothstep(.2,.48,abs(uv.x-.5));
    float glow=trail*bit*inside*on*mask;
    c+=mix(b,vec3(1.),step(d,1.)*step(0.,d)*.6)*glow*.34*m;
    // slow scan line
    c+=b*exp(-pow((uv.y-fract(-k*2.))*90.,2.))*.06*m;
  }
  // vignette + grain
  c*=1.-.45*smoothstep(.55,1.25,length(p*vec2(.8,1.1)));
  c+=(h(gl_FragCoord.xy+g)-.5)*.018;
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
      const [uR, uPh, uS, uA, uB, uG, uM] = ["r", "ph", "s", "a", "b", "g", "m"].map(u);
      const css = getComputedStyle(document.documentElement);
      // Per-slide palettes come from the tokens; the shader eases between them.
      const pal = (tone: string): [number, number, number][] => [
        hexToRgb(css.getPropertyValue(`--bg-${tone}-1`) || "#4d8dff"),
        hexToRgb(css.getPropertyValue(`--bg-${tone}-2`) || "#3ad7ff"),
      ];
      const palettes: Record<string, [number, number, number][]> = { blue: pal("blue"), purple: pal("purple"), green: pal("green") };
      const cur = { a: [...palettes.blue[0]], b: [...palettes.blue[1]], m: 0 };
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
        const theme = (window as Window & { __deckTheme?: { tone: string; code?: boolean } }).__deckTheme;
        const target = palettes[theme?.tone ?? "blue"] ?? palettes.blue;
        for (let i = 0; i < 3; i++) {
          cur.a[i] += (target[0][i] - cur.a[i]) * 0.04;
          cur.b[i] += (target[1][i] - cur.b[i]) * 0.04;
        }
        cur.m += ((theme?.code ? 1 : 0) - cur.m) * 0.04;
        gl.uniform3fv(uA, cur.a);
        gl.uniform3fv(uB, cur.b);
        gl.uniform1f(uM, cur.m);
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
