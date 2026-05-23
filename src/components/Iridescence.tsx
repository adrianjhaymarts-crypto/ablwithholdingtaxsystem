import { Renderer, Program, Mesh, Color, Triangle } from "ogl";
import { useEffect, useRef } from "react";

const vertex = `attribute vec2 uv;attribute vec2 position;varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,0,1);}`;
const fragment = `precision highp float;uniform float uTime;uniform vec3 uColor;uniform vec3 uResolution;uniform vec2 uMouse;uniform float uAmplitude;uniform float uSpeed;varying vec2 vUv;void main(){float mr=min(uResolution.x,uResolution.y);vec2 uv=(vUv.xy*2.0-1.0)*uResolution.xy/mr;uv+=(uMouse-vec2(0.5))*uAmplitude;float d=-uTime*0.5*uSpeed;float a=0.0;for(float i=0.0;i<8.0;++i){a+=cos(i-d-a*uv.x);d+=sin(uv.y*i+a);}d+=uTime*0.5*uSpeed;vec3 col=vec3(cos(uv*vec2(d,a))*0.6+0.4,cos(a+d)*0.5+0.5);col=cos(col*cos(vec3(d,a,2.5))*0.5+0.5)*uColor;gl_FragColor=vec4(col,1.0);} `;

interface Props {
  color?: [number, number, number];
  speed?: number;
  amplitude?: number;
  mouseReact?: boolean;
  className?: string;
}

export default function Iridescence({
  color = [0.4, 0.85, 0.75],
  speed = 0.7,
  amplitude = 0.1,
  mouseReact = false,
  className,
}: Props) {
  const ctnDom = useRef<HTMLDivElement | null>(null);
  const mousePos = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    if (typeof window === "undefined" || !ctnDom.current) return;
    const ctn = ctnDom.current;
    const renderer = new Renderer();
    const gl = renderer.gl;
    gl.clearColor(1, 1, 1, 1);
    let program: Program;

    function resize() {
      renderer.setSize(ctn.offsetWidth, ctn.offsetHeight);
      if (program) {
        program.uniforms.uResolution.value = new Color(
          gl.canvas.width,
          gl.canvas.height,
          gl.canvas.width / gl.canvas.height
        );
      }
    }
    window.addEventListener("resize", resize);
    resize();
    const geometry = new Triangle(gl);
    program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new Color(...color) },
        uResolution: {
          value: new Color(gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height),
        },
        uMouse: { value: new Float32Array([0.5, 0.5]) },
        uAmplitude: { value: amplitude },
        uSpeed: { value: speed },
      },
    });
    const mesh = new Mesh(gl, { geometry, program });
    let raf = 0;
    function update(t: number) {
      raf = requestAnimationFrame(update);
      program.uniforms.uTime.value = t * 0.001;
      renderer.render({ scene: mesh });
    }
    raf = requestAnimationFrame(update);
    ctn.appendChild(gl.canvas);
    function onMouse(e: MouseEvent) {
      const rect = ctn.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1 - (e.clientY - rect.top) / rect.height;
      mousePos.current = { x, y };
      (program.uniforms.uMouse.value as Float32Array)[0] = x;
      (program.uniforms.uMouse.value as Float32Array)[1] = y;
    }
    if (mouseReact) ctn.addEventListener("mousemove", onMouse);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      if (mouseReact) ctn.removeEventListener("mousemove", onMouse);
      try {
        ctn.removeChild(gl.canvas);
      } catch {}
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [color, speed, amplitude, mouseReact]);

  return <div ref={ctnDom} className={className} style={{ width: "100%", height: "100%" }} />;
}