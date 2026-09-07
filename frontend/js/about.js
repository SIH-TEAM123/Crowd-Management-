const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.querySelector('#flow-canvas');
const ctx = canvas?.getContext('2d');
const visual = document.querySelector('.hero-visual');

function resizeCanvas() {
  if (!canvas || !visual) return;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = visual.clientWidth * ratio;
  canvas.height = visual.clientHeight * ratio;
  canvas.style.width = `${visual.clientWidth}px`;
  canvas.style.height = `${visual.clientHeight}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function drawFlow(time = 0) {
  if (!ctx || !visual) return;
  const width = visual.clientWidth;
  const height = visual.clientHeight;
  ctx.clearRect(0, 0, width, height);
  const paths = [
    [[width * .02, height * .76], [width * .26, height * .44], [width * .52, height * .61], [width * .98, height * .18]],
    [[width * .04, height * .16], [width * .3, height * .32], [width * .6, height * .18], [width * .9, height * .68]],
    [[width * .18, height * .98], [width * .4, height * .65], [width * .72, height * .72], [width * .96, height * .42]]
  ];
  paths.forEach((points, pathIndex) => {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    ctx.bezierCurveTo(...points[1], ...points[2], ...points[3]);
    ctx.strokeStyle = pathIndex === 1 ? 'rgba(22,24,23,.28)' : 'rgba(22,24,23,.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
    for (let i = 0; i < 7; i++) {
      const progress = ((time * .00004 * (pathIndex + 1) + i / 7) % 1);
      const x = points[0][0] + (points[3][0] - points[0][0]) * progress + Math.sin(progress * Math.PI * 2) * 18;
      const y = points[0][1] + (points[3][1] - points[0][1]) * progress;
      ctx.beginPath(); ctx.arc(x, y, pathIndex === 1 ? 2.5 : 2, 0, Math.PI * 2); ctx.fillStyle = pathIndex === 1 ? '#b9ee3d' : '#161817'; ctx.fill();
    }
  });
  if (!reducedMotion) requestAnimationFrame(drawFlow);
}

if (canvas) { resizeCanvas(); drawFlow(); window.addEventListener('resize', resizeCanvas); }

const revealObserver = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) entry.target.classList.add('is-visible'); }), { threshold: .15 });
document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));

const stages = [...document.querySelectorAll('.stage')];
const panelNumber = document.querySelector('[data-panel-number]');
const panelCopy = document.querySelector('[data-panel-copy]');
const stageCopy = ['Understand how people and resources are moving through the hospital in real time.', 'Spot pressure before it becomes a bottleneck, with a shared language for the whole team.', 'Turn a clear signal into a confident next step, without adding friction to care.'];
stages.forEach((stage) => stage.addEventListener('click', () => { const index = Number(stage.dataset.stage); stages.forEach((item, itemIndex) => { item.classList.toggle('is-active', itemIndex === index); item.setAttribute('aria-selected', itemIndex === index); }); if (panelNumber) panelNumber.textContent = `0${index + 1}`; if (panelCopy) panelCopy.textContent = stageCopy[index]; }));

const densityVisual = document.querySelector('[data-density-visual]');
if (densityVisual) { for (let i = 0; i < 42; i += 1) { const dot = document.createElement('i'); dot.style.transform = `translate(${Math.sin(i * 2.4) * 76}px, ${Math.cos(i * 1.8) * 72}px)`; densityVisual.append(dot); } }

if (!reducedMotion) window.addEventListener('scroll', () => { const header = document.querySelector('[data-header]'); header?.classList.toggle('is-scrolled', window.scrollY > 24); });
