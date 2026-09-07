(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.createElement('canvas');
  canvas.className = 'auth-leaves';
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  const leaves = Array.from({ length: reduce ? 8 : 28 }, (_, i) => ({ x: Math.random(), y: Math.random() - 1, size: 7 + Math.random() * 12, speed: .0015 + Math.random() * .0025, sway: Math.random() * Math.PI * 2, spin: Math.random() * .05, rotation: Math.random() * 6.28, alpha: .25 + Math.random() * .6, tone: i % 3 === 0 ? '#e77866' : i % 3 === 1 ? '#c83b36' : '#8f2427' }));
  const resize = () => { canvas.width = innerWidth * devicePixelRatio; canvas.height = innerHeight * devicePixelRatio; canvas.style.width = `${innerWidth}px`; canvas.style.height = `${innerHeight}px`; ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); };
  const drawLeaf = (leaf, time) => { const x = leaf.x * innerWidth + Math.sin(time * .0007 + leaf.sway) * 24; const y = ((leaf.y + time * leaf.speed) % 1.2) * innerHeight - 80; ctx.save(); ctx.translate(x, y); ctx.rotate(leaf.rotation + time * leaf.spin); ctx.globalAlpha = leaf.alpha; ctx.fillStyle = leaf.tone; ctx.beginPath(); ctx.moveTo(0, -leaf.size); ctx.bezierCurveTo(leaf.size * 1.2, -leaf.size * .35, leaf.size * .7, leaf.size, 0, leaf.size * 1.15); ctx.bezierCurveTo(-leaf.size * .7, leaf.size, -leaf.size * 1.2, -leaf.size * .35, 0, -leaf.size); ctx.fill(); ctx.strokeStyle = 'rgba(244,240,231,.35)'; ctx.lineWidth = .6; ctx.beginPath(); ctx.moveTo(0, -leaf.size * .8); ctx.lineTo(0, leaf.size * .85); ctx.stroke(); ctx.restore(); };
  const animate = (time) => { ctx.clearRect(0, 0, innerWidth, innerHeight); leaves.forEach((leaf) => drawLeaf(leaf, time)); if (!reduce) requestAnimationFrame(animate); };
  addEventListener('resize', resize); resize(); animate(0);
})();
