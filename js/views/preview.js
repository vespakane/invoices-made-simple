import { h, topbar, backBtn, barBtn, icon, toast, clear } from '../ui.js';
import * as nav from '../nav.js';
import { renderPreview } from '../pdf/index.js';
import { actions } from './editor.js';

export function previewScreen(doc) {
  const content = h('div', { class: 'content preview-content' }, h('div', { class: 'preview-loading' }, 'Preparing preview…'));
  const screen = h('div', {},
    topbar({ title: 'Preview', left: backBtn(() => nav.pop()), right: barBtn('Send', { primary: true, onClick: () => actions.send(doc) }) }),
    content,
    h('div', { class: 'editor-footer preview-footer' },
      h('button', { type: 'button', class: 'btn secondary footer-btn', onClick: () => actions.share(doc) }, icon('share'), 'Share'),
      h('button', { type: 'button', class: 'btn footer-btn', style: { flex: '1' }, onClick: () => actions.send(doc) }, icon('send'), 'Send')
    )
  );
  content.classList.add('has-footer');
  screen.onShow = async () => {
    try {
      const width = Math.min(content.clientWidth - 32, 680);
      const { canvases, pages } = await renderPreview(doc, width);
      clear(content);
      canvases.forEach((c, i) => content.append(h('div', { class: 'pdf-page-wrap' }, c, pages > 1 ? h('div', { class: 'pdf-page-num' }, `Page ${i + 1} of ${pages}`) : null)));
    } catch (e) {
      console.error(e);
      clear(content);
      content.append(h('div', { class: 'preview-loading' }, 'Could not render the preview. ' + (e.message || '')));
    }
  };
  return screen;
}
