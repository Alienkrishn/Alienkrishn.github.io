document.querySelectorAll('.prose pre').forEach((pre) => {
  const box = document.createElement('div');
  box.className = 'code';
  pre.replaceWith(box);

  const head = document.createElement('div');
  head.className = 'code-head';

  const code = pre.querySelector('code');
  const langClass = code && Array.from(code.classList).find((c) => c.startsWith('language-'));
  const label = document.createElement('span');
  label.className = 'code-lang';
  label.textContent = langClass ? langClass.slice(9) : 'text';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'copy';
  btn.textContent = 'copy';
  btn.addEventListener('click', () => {
    navigator.clipboard.writeText(pre.innerText).then(() => {
      btn.textContent = 'copied!';
      setTimeout(() => { btn.textContent = 'copy'; }, 1500);
    }).catch(() => { btn.textContent = 'failed'; });
  });

  head.append(label, btn);
  box.append(head, pre);
});
