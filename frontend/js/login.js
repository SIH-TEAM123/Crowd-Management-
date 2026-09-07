(() => {
  const canvas = document.getElementById('moonCanvas');
  if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = canvas.getContext('2d'); let width = 0; let height = 0; let time = 0;
  const resize = () => { width = canvas.width = window.innerWidth * devicePixelRatio; height = canvas.height = window.innerHeight * devicePixelRatio; canvas.style.width = `${window.innerWidth}px`; canvas.style.height = `${window.innerHeight}px`; ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); };
  const draw = () => { time += 0.002; ctx.clearRect(0, 0, width, height); for (let i = 0; i < 20; i += 1) { const x = (i * 83 + Math.sin(time + i) * 18) % window.innerWidth; const y = (i * 47 + Math.cos(time * .7 + i) * 22) % window.innerHeight; ctx.fillStyle = `rgba(233,230,220,${.018 + (i % 3) * .008})`; ctx.fillRect(x, y, 1, 1); } requestAnimationFrame(draw); };
  resize(); window.addEventListener('resize', resize); draw();
})();
