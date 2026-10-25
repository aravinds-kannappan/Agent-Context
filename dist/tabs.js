// Progressive enhancement: without JavaScript the guide remains readable.
const sections = [
  ['overview', 'Start here', ['#overview']],
  ['understand', 'The basics', ['#understand']],
  ['research', 'Research', ['.research-section']],
  ['explore', 'Try it', ['#explore']],
  ['fields', 'In practice', ['#fields', '.techniques-section']],
  ['experiment', 'Experiment', ['#experiment']],
  ['next', 'What to build', ['.next-section']],
  ['sources', 'Reading shelf', ['#sources']],
];
const main = document.querySelector('main');
const bar = document.querySelector('.guide-tabs');
const panels = new Map();
for (const [id, label, selectors] of sections) {
  const panel = document.createElement('div');
  panel.id = `panel-${id}`;
  panel.setAttribute('role', 'tabpanel');
  panel.setAttribute('aria-labelledby', `tab-${id}`);
  for (const selector of selectors) panel.append(document.querySelector(selector));
  main.append(panel); panels.set(id, panel);
  const tab = document.createElement('button');
  tab.id = `tab-${id}`; tab.textContent = label; tab.dataset.page = id;
  tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', panel.id);
  tab.addEventListener('click', () => { location.hash = id; activate(id, true); });
  bar.append(tab);
}
function activate(id, scroll = false) {
  if (!panels.has(id)) id = 'overview';
  for (const [key, panel] of panels) panel.hidden = key !== id;
  for (const tab of bar.children) {
    const selected = tab.dataset.page === id;
    tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1;
  }
  if (scroll) window.scrollTo({ top: 0, behavior: 'instant' });
}
bar.addEventListener('keydown', event => {
  const tabs = [...bar.children], i = tabs.indexOf(document.activeElement);
  if (i < 0) return;
  const positions = { ArrowRight: (i + 1) % tabs.length, ArrowLeft: (i - 1 + tabs.length) % tabs.length, Home: 0, End: tabs.length - 1 };
  if (!(event.key in positions)) return;
  event.preventDefault(); tabs[positions[event.key]].focus(); tabs[positions[event.key]].click();
});
window.addEventListener('hashchange', () => activate(location.hash.slice(1), true));
document.addEventListener('click', event => {
  const link = event.target.closest('a[href^="#"]');
  if (!link) return;
  const id = link.getAttribute('href').slice(1);
  if (panels.has(id) || !id || id === 'main') activate(id, true);
});
activate(location.hash.slice(1));
document.body.classList.add('tabbed-guide');
