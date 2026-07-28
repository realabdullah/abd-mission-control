import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';

export type VibeFrame = {
  context: CanvasRenderingContext2D;
  width: number;
  height: number;
  time: number;
  delta: number;
};

export function useVibeCanvas(draw: (frame: VibeFrame) => void) {
  const canvas = ref<HTMLCanvasElement | null>(null);
  let animation = 0;
  let observer: ResizeObserver | null = null;
  let previous = 0;
  let reducedMotion = false;

  function resize() {
    const element = canvas.value;
    if (!element) return;
    const box = element.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    element.width = Math.max(1, Math.round(box.width * ratio));
    element.height = Math.max(1, Math.round(box.height * ratio));
    const context = element.getContext('2d');
    context?.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function frame(time: number) {
    const element = canvas.value;
    if (!element) return;
    const minimumFrame = reducedMotion ? 1000 / 12 : 1000 / 30;
    if (time - previous >= minimumFrame) {
      const box = element.getBoundingClientRect();
      const context = element.getContext('2d');
      if (context) {
        draw({
          context,
          width: box.width,
          height: box.height,
          time: time / 1000,
          delta: Math.min((time - previous) / 1000, 0.1),
        });
      }
      previous = time;
    }
    animation = requestAnimationFrame(frame);
  }

  onMounted(() => {
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    resize();
    observer = new ResizeObserver(resize);
    if (canvas.value) observer.observe(canvas.value);
    animation = requestAnimationFrame(frame);
  });
  onBeforeUnmount(() => {
    cancelAnimationFrame(animation);
    observer?.disconnect();
  });
  return canvas;
}

export function useSpringNumber(
  source: Ref<number>,
  options: { stiffness?: number; damping?: number; precision?: number } = {},
) {
  const value = ref(source.value);
  const stiffness = options.stiffness ?? 42;
  const damping = options.damping ?? 12;
  const precision = options.precision ?? 0.01;
  let velocity = 0;
  let animation = 0;
  let previous = 0;
  let reducedMotion = false;

  function step(time: number) {
    const delta = Math.min((time - previous) / 1000 || 0.016, 0.05);
    previous = time;
    const displacement = source.value - value.value;
    velocity += displacement * stiffness * delta;
    velocity *= Math.exp(-damping * delta);
    value.value += velocity * delta;
    if (Math.abs(displacement) < precision && Math.abs(velocity) < precision) {
      value.value = source.value;
      velocity = 0;
      animation = 0;
      return;
    }
    animation = requestAnimationFrame(step);
  }

  function begin() {
    if (reducedMotion) {
      value.value = source.value;
      velocity = 0;
      return;
    }
    if (!animation) {
      previous = performance.now();
      animation = requestAnimationFrame(step);
    }
  }

  const stop = watch(source, begin);
  onMounted(() => {
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  onBeforeUnmount(() => {
    stop();
    cancelAnimationFrame(animation);
  });
  return value;
}
