/* An accessible inspector for the same region routes drawn on the atlas. */
(function (root) {
  'use strict';

  function mount({container, toggle, atlas, index, types, filters, onSelect, onRegion, onRoute}) {
    const document = container.ownerDocument;
    const format = new Intl.NumberFormat('az');
    const regions = atlas.regions;
    const titleId = container.id + 'Title';
    let activeFilters = filters;
    let region = null;
    let pair = null;
    let listScroll = 0;
    let returnKey = '';

    function element(tag, className, text) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    }

    function button(className, text, action, focusKey) {
      const node = element('button', className, text);
      node.type = 'button';
      node.dataset.routeControl = focusKey;
      node.addEventListener('click', action);
      return node;
    }

    function focus(node) {
      node?.focus({preventScroll: true});
    }

    const closeButton = button('route-close', '×', () => close(true), 'close');
    closeButton.setAttribute('aria-label', 'Bağla');
    const title = element('h2', 'route-title');
    title.id = titleId;
    title.tabIndex = -1;
    const summary = element('p', 'route-summary');
    const heading = element('div', 'route-heading');
    heading.append(title, summary);
    const header = element('div', 'route-header');
    header.append(heading, closeButton);
    const content = element('div', 'route-content');
    container.replaceChildren(header, content);
    container.setAttribute('role', 'region');
    container.setAttribute('aria-labelledby', titleId);
    toggle.setAttribute('aria-controls', container.id);
    container.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');

    function setPair(next) {
      if (pair?.from === next?.from && pair?.to === next?.to) return;
      pair = next;
      onRoute?.(pair?.from ?? null, pair?.to ?? null);
    }

    function showPair(from, to) {
      if (!pair) listScroll = content.scrollTop;
      setPair({from, to});
      render();
      content.scrollTop = 0;
      focus(title);
    }

    function pairKey(from, to) {
      return 'pair-' + from + '-' + to;
    }

    function restoreControl(key) {
      const target = [...content.querySelectorAll('[data-route-control]')]
        .find(node => node.dataset.routeControl === key);
      focus(target || title);
    }

    function backToList() {
      setPair(null);
      render();
      content.scrollTop = listScroll;
      restoreControl(returnKey);
    }

    function routeList() {
      const lanes = index.lanes(activeFilters, regions.length)
        .filter(lane => region === null || lane.from === region || lane.to === region);
      title.textContent = region === null ? 'Bölgələrarası əlaqələr' : regions[region].label;
      const total = lanes.reduce((sum, lane) => sum + lane.count, 0);
      summary.textContent = format.format(lanes.length) + ' bölgə cütü · ' + format.format(total) + ' əlaqə';

      if (region !== null) {
        content.append(button('route-back', '← Bütün bölgələr', () => open(), 'all'));
      }
      if (!lanes.length) {
        content.append(element('p', 'route-empty', 'Seçilmiş süzgəclərlə bölgələrarası əlaqə tapılmadı.'));
        return;
      }

      const list = element('ul', 'route-list');
      for (const {from, to, count} of lanes) {
        const key = pairKey(from, to);
        const control = button('route-pair', undefined, () => {
          returnKey = key;
          showPair(from, to);
        }, key);
        const names = element('span', 'route-pair-names');
        const separator = element('span', 'route-separator', '↔');
        separator.setAttribute('aria-hidden', 'true');
        names.append(element('span', '', regions[from].label), separator, element('span', '', regions[to].label));
        const metric = element('span', 'route-number', format.format(count));
        control.setAttribute('aria-label', regions[from].label + ' və ' + regions[to].label + ' · ' + metric.textContent + ' əlaqə');
        control.append(names, metric);
        const item = element('li');
        item.append(control);
        list.append(item);
      }
      content.append(list);
    }

    function relationLabel(type, text) {
      const label = element('span', 'route-type', text);
      label.style.setProperty('--relation-color', types[type].color);
      return label;
    }

    function wordEndpoint(point, edgeId) {
      const control = button('route-word', point.word, () => {
        close();
        onSelect(point.node);
      }, 'edge-' + edgeId + '-word-' + point.node.id);
      control.setAttribute('aria-label', point.word + ' · sözə keç');
      const gloss = element('span', 'route-gloss', point.node.en);
      gloss.id = container.id + '-' + control.dataset.routeControl + '-gloss';
      gloss.lang = 'en';
      gloss.title = point.node.en;
      control.setAttribute('aria-describedby', gloss.id);
      const endpoint = element('div', 'route-endpoint');
      endpoint.append(control, gloss);
      return endpoint;
    }

    function routeDetail() {
      const {from, to} = pair;
      const info = index.summary(from, to, activeFilters);
      title.textContent = regions[from].label + ' ↔ ' + regions[to].label;
      summary.textContent = format.format(info.count) + ' söz əlaqəsi';
      content.append(button('route-back', '← Bölgə cütləri', backToList, 'back'));

      if (info.count) {
        const breakdown = element('ul', 'route-breakdown');
        for (const [type, count] of Object.entries(info.counts).sort((a,b) => types[a[0]].order - types[b[0]].order)) {
          if (!count) continue;
          const row = element('li');
          row.append(relationLabel(type, types[type].name), element('span', 'route-number', format.format(count)));
          breakdown.append(row);
        }
        content.append(breakdown);
        const examples = index.examples(from, to, activeFilters, 4);
        if (examples.length) {
          content.append(element('h3', 'route-subtitle', 'Söz cütləri'));
          const list = element('ul', 'route-examples');
          for (const edge of examples) {
            const first = edge.from.region === from ? edge.from : edge.to;
            const second = first === edge.from ? edge.to : edge.from;
            const row = element('li');
            const words = element('div', 'route-words');
            const join = element('span', 'route-word-join', '↔');
            join.setAttribute('aria-hidden', 'true');
            words.append(wordEndpoint(first, edge.id), join, wordEndpoint(second, edge.id));
            row.append(words, relationLabel(edge.type, types[edge.type].name));
            list.append(row);
          }
          content.append(list);
        } else {
          content.append(element('p', 'route-empty', 'Bu bölgə cütü üçün iki dildə izahlı söz nümunəsi hazırda göstərilmir.'));
        }
      } else {
        content.append(element('p', 'route-empty', 'Seçilmiş süzgəclərlə bu iki bölgə arasında əlaqə tapılmadı.'));
      }

      const visits = element('div', 'route-visits');
      visits.append(element('h3', 'route-subtitle', 'Bölgəyə keç'));
      for (const id of [from, to]) {
        const visit = button('route-visit', regions[id].label + ' ↗', () => {
          close();
          onRegion(id);
        }, 'region-' + id);
        visits.append(visit);
      }
      content.append(visits);
    }

    function render() {
      content.replaceChildren();
      if (pair) routeDetail();
      else routeList();
    }

    function refresh() {
      if (container.hidden) return;
      const focused = document.activeElement;
      const controlKey = content.contains(focused) && focused.dataset?.routeControl;
      const scroll = content.scrollTop;
      render();
      content.scrollTop = scroll;
      if (controlKey) restoreControl(controlKey);
    }

    function open(from, to) {
      const validRegion = id => Number.isInteger(id) && id >= 0 && id < regions.length;
      container.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
      region = null;
      listScroll = 0;
      returnKey = '';
      if (validRegion(from) && validRegion(to) && from !== to) {
        const a = Math.min(from, to), b = Math.max(from, to);
        returnKey = pairKey(a, b);
        showPair(a, b);
        return;
      }
      if (validRegion(from)) region = from;
      setPair(null);
      render();
      content.scrollTop = 0;
      focus(title);
    }

    function close(restoreFocus = false) {
      if (container.hidden) return;
      container.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
      setPair(null);
      if (restoreFocus) focus(toggle);
    }

    toggle.addEventListener('click', () => container.hidden ? open() : close(true));
    container.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close(true);
      }
    });

    return {open, close, refresh, isOpen: () => !container.hidden, setFilters(next) {
      activeFilters = next;
      refresh();
    }};
  }

  const api = {mount};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AtlasRoutePanel = api;
})(typeof window !== 'undefined' ? window : globalThis);
