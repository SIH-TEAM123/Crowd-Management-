(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.getElementById('flowCanvas');
  const context = canvas?.getContext('2d');
  const visual = canvas?.parentElement;
  let animationFrame;

  function sizeCanvas() {
    if (!canvas || !context || !visual) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = visual.clientWidth * ratio;
    canvas.height = visual.clientHeight * ratio;
    canvas.style.width = `${visual.clientWidth}px`;
    canvas.style.height = `${visual.clientHeight}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function drawFlow(time = 0) {
    if (!canvas || !context || !visual) return;
    const width = visual.clientWidth;
    const height = visual.clientHeight;
    context.clearRect(0, 0, width, height);
    const progress = reducedMotion ? 0.5 : (Math.sin(time * 0.0007) + 1) / 2;
    for (let stream = 0; stream < 4; stream += 1) {
      context.beginPath();
      for (let x = -20; x <= width + 20; x += 8) {
        const normalized = x / width;
        const y = height * (0.28 + stream * 0.13) + Math.sin(normalized * 8 + stream + progress * 2) * (18 + stream * 6) + (normalized - 0.5) * height * (stream - 1.5) * 0.14;
        if (x === -20) context.moveTo(x, y); else context.lineTo(x, y);
      }
      context.strokeStyle = stream === 1 ? '#171717' : '#b8b8ae';
      context.lineWidth = stream === 1 ? 1.5 : 1;
      context.stroke();
      const dotX = ((progress + stream * 0.2) % 1) * width;
      const dotY = height * (0.28 + stream * 0.13) + Math.sin((dotX / width) * 8 + stream + progress * 2) * (18 + stream * 6);
      context.fillStyle = stream === 1 ? '#d8ff48' : '#171717';
      context.beginPath(); context.arc(dotX, dotY, stream === 1 ? 4 : 2.5, 0, Math.PI * 2); context.fill();
    }
    if (!reducedMotion) animationFrame = requestAnimationFrame(drawFlow);
  }

  if (canvas) { sizeCanvas(); drawFlow(); window.addEventListener('resize', sizeCanvas); }
  const revealObserver = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) entry.target.classList.add('is-visible'); }), { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));

  const steps = [...document.querySelectorAll('[data-step]')];
  const progress = document.querySelector('[data-progress]');
  let currentStep = 0;
  const activateStep = (index) => { currentStep = index; steps.forEach((step, stepIndex) => step.classList.toggle('is-active', stepIndex === index)); if (progress) progress.style.width = `${((index + 1) / steps.length) * 100}%`; };
  const stepObserver = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) activateStep(Number(entry.target.dataset.step)); }), { threshold: 0.7, rootMargin: '-10% 0px -10% 0px' });
  steps.forEach((step) => stepObserver.observe(step));

  window.addEventListener('beforeunload', () => cancelAnimationFrame(animationFrame));
})();
