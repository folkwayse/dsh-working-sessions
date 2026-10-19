/**
 * dsh-working-sessions — v6 FINAL.
 *
 * Root cause terverifikasi: standard hooks (props.useSessions dll.) adalah
 * selector-hooks — WAJIB dipanggil dengan selector, persis seperti pemakaian
 * internal WorkspaceBrowser: useSessions((s) => s) (ui-workspace client.js:2727).
 * Panggilan tanpa selector → useSyncExternalStoreWithSelector memanggil
 * selector undefined → "l is not a function".
 *
 * Struktur: WorkingRoot = class error boundary (sidebar tak pernah rusak),
 * WorkingInner = hooks + banner, OriginalBrowser tetap ter-render di bawah.
 *
 * v6: header section 'Working' dan 'Recent' jadi toggleable — klik untuk
 * collapse/expand dengan indikator chevron (▾ expanded / ▸ collapsed).
 * State awal: Working expanded, Recent collapsed.
 */
window.__ModuleLoader__.load({
  id: 'dsh-working-sessions',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    let ctxRef = null;
    let OriginalBrowser;
    let bridged = false;

    function findOriginal(entries) {
      return entries.find((e) => e.options?.id !== 'dsh-working-sessions'
        && typeof e.component === 'function');
    }

    function ensureBridge() {
      if (!ctxRef || bridged) return bridged;
      let entries;
      try { entries = ctxRef.slots.entries('sidebar.workspaces'); } catch { return false; }
      if (!entries || !entries.length) return false;
      const wrapper = entries.find((e) => e.options?.id === 'dsh-working-sessions');
      const original = findOriginal(entries);
      if (!wrapper || !original) return false;
      for (const k of ['children', 'store', 'inject', 'locale']) {
        if (wrapper[k] === undefined && original[k] !== undefined) wrapper[k] = original[k];
      }
      OriginalBrowser = original.component;
      bridged = true;
      console.info('[working-sessions] bridge to original WorkspaceBrowser OK');
      return true;
    }

    function pickWorking(list, statuses) {
      const working = [];
      if (!list || !Array.isArray(list.ids)) return working;
      for (const id of list.ids) {
        const s = list.byId && list.byId[id];
        if (!s || s.archived) continue;
        const st = statuses && statuses.get ? statuses.get(id) : undefined;
        // Kriteria SATU dan sama dengan spinner sidebar (sessionNode,
        // ui-workspace client.js:466): running = status?.running ?? s.running.
        // Sesi yang spinner-nya muter di sidebar = naik. Titik.
        const running = (st ? st.running : undefined) ?? Boolean(s.running);
        // Selesai-belum-dibuka (dot hijau): ✓ sampai sesinya dibuka.
        const completed = (st ? st.completionUnread : undefined) === true && !running;
        if (running || completed) {
          working.push({ id, title: s.title, displayTitle: s.displayTitle, running, completed });
        }
      }
      working.sort((a, b) => (b.running - a.running));
      return working;
    }

    // Kategori "Recent": sesi yang sudah selesai (bukan running), urut dari yang
    // terakhir selesai (updatedAt terbaru dulu) — sesi running tetap di grup Working.
    function pickRecent(list, statuses) {
      const recent = [];
      if (!list || !Array.isArray(list.ids)) return recent;
      for (const id of list.ids) {
        const s = list.byId && list.byId[id];
        if (!s || s.archived || s.blank) continue;
        const st = statuses && statuses.get ? statuses.get(id) : undefined;
        const running = (st ? st.running : undefined) ?? Boolean(s.running);
        if (running) continue;
        const completed = (st ? st.completionUnread : undefined) === true;
        recent.push({ id, title: s.title, displayTitle: s.displayTitle, completed, updatedAt: s.updatedAt || 0 });
      }
      recent.sort((a, b) => (b.updatedAt - a.updatedAt));
      return recent.slice(0, 5);
    }

    function Pill({ text }) {
      return h('div', {
        style: {
          margin: '4px 8px', padding: '2px 8px', fontSize: 10,
          borderRadius: 6, display: 'inline-block',
          background: '#2a2a35', color: '#8f8fa3',
          border: '1px dashed #555', fontFamily: 'monospace'
        }
      }, text);
    }

    function WorkingInner(props) {
      const sessions = props.useSessions((s) => s);
      const statuses = props.useSessionStatus((s) => s);
      const working = pickWorking(sessions, statuses);
      const recent = pickRecent(sessions, statuses);
      // Collapse state per-section. Default awal: Working expanded, Recent collapsed.
      const [collapsed, setCollapsed] = React.useState({ Working: false, Recent: true });
      const toggle = (label) => setCollapsed((c) => ({ ...c, [label]: !c[label] }));
      if (!working.length && !recent.length) return null;
      const open = (id) => {
        try {
          if (ctxRef && ctxRef.uiWorkspace && typeof ctxRef.uiWorkspace.openSession === 'function') {
            ctxRef.uiWorkspace.openSession(id);
            return;
          }
        } catch {}
        try {
          const a = props.actions;
          if (a && typeof a.open === 'function') a.open(id);
        } catch {}
      };
      const renderRow = (s) =>
        h('button', {
          key: s.id,
          onClick: () => open(s.id),
          title: s.displayTitle || s.title || s.id,
          style: {
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            textAlign: 'left', padding: '6px 10px', borderRadius: 8,
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: 'var(--dsh-text-primary, #d5d5dc)', font: 'inherit',
            fontSize: 13, lineHeight: 1.3, whiteSpace: 'nowrap',
            overflow: 'hidden'
          },
          onMouseEnter: (e) => { e.currentTarget.style.background = 'var(--dsh-surface-hover, rgba(255,255,255,0.06))'; },
          onMouseLeave: (e) => { e.currentTarget.style.background = 'transparent'; }
        },
          s.running
            ? h('span', {
                style: {
                  width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                  border: '2px solid rgba(63,178,127,0.25)',
                  borderTopColor: '#3fb27f',
                  animation: 'dsh-working-spin 1s linear infinite'
                }
              })
            : h('span', {
                style: {
                  width: 14, height: 14, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: s.completed ? '#3fb27f' : '#8a8a96', fontSize: 12, fontWeight: 700
                }
              }, s.completed ? '✓' : '·'),
          h('span', {
            style: { overflow: 'hidden', textOverflow: 'ellipsis' }
          }, s.displayTitle || s.title || s.id)
        );

      const renderSection = (label, rows, dotColor, expanded) => h('div', { style: { margin: '2px 0 4px' } },
        // Header gaya section label sidebar (seperti "Workspaces"), toggleable:
        // klik = collapse/expand. Chevron ▾ (rotate 0) = expanded, ▸ (rotate -90) = collapsed.
        h('div', {
          role: 'button',
          tabIndex: 0,
          'aria-expanded': expanded ? 'true' : 'false',
          title: (expanded ? 'Collapse ' : 'Expand ') + label,
          onClick: () => toggle(label),
          onKeyDown: (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(label); }
          },
          style: {
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '0 16px', margin: '6px 0 2px',
            fontSize: 11.5, fontWeight: 500,
            color: 'var(--dsh-text-tertiary, #8a8a96)',
            textTransform: 'none', userSelect: 'none',
            cursor: 'pointer', borderRadius: 6, lineHeight: '20px'
          },
          onMouseEnter: (e) => { e.currentTarget.style.background = 'var(--dsh-surface-hover, rgba(255,255,255,0.06))'; },
          onMouseLeave: (e) => { e.currentTarget.style.background = 'transparent'; }
        },
          h('span', {
            style: {
              width: 6, height: 6, borderRadius: '50%', background: dotColor,
              flexShrink: 0, boxShadow: '0 0 0 3px ' + dotColor + '26'
            }
          }),
          label,
          h('span', {
            style: { flexShrink: 0, opacity: 0.7, fontVariantNumeric: 'tabular-nums' }
          }, rows.length),
          h('span', {
            style: {
              marginLeft: 'auto', fontSize: 10, flexShrink: 0,
              display: 'inline-block', transition: 'transform 120ms ease',
              transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
              color: 'var(--dsh-text-tertiary, #8a8a96)'
            }
          }, '▾')
        ),
        // Baris sesi: gaya sama dengan row sesi sidebar (hanya saat expanded)
        expanded
          ? h('div', { style: { padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 1 } },
              rows.map((s) => renderRow(s))
            )
          : null
      );

      return h('div', { style: { margin: '2px 0 4px' } },
        working.length ? renderSection('Working', working, '#3fb27f', !collapsed.Working) : null,
        recent.length ? renderSection('Recent', recent, '#8a8a96', !collapsed.Recent) : null,
        // Keyframes spinner sekali saja
        h('style', null, '@keyframes dsh-working-spin{to{transform:rotate(360deg)}}')
      );
    }

    class WorkingRoot extends React.Component {
      constructor(props) {
        super(props);
        this.state = { error: null };
      }
      static getDerivedStateFromError(error) {
        return { error };
      }
      componentDidCatch(error, info) {
        console.error('[working-sessions] inner crashed', error, info);
      }
      render() {
        const p = this.props;
        const ok = ensureBridge();
        const inner = !this.state.error
          && typeof p.useSessions === 'function'
          && typeof p.useSessionStatus === 'function'
          ? h(WorkingInner, p)
          : null;
        return h(React.Fragment, null,
          inner,
          typeof OriginalBrowser === 'function' ? h(OriginalBrowser, p) : null
        );
      }
    }

    return {
      inject: ['slots', 'uiWorkspace'],
      apply(ctx) {
        ctxRef = ctx;
        console.info('[working-sessions] apply()');
        ctx.slots.inject('sidebar.workspaces', () => {
          let dispose;
          try {
            dispose = ctx.slots.register(
              {
                name: 'sidebar.workspaces',
                id: 'dsh-working-sessions',
                priority: -10,
                label: 'working-sessions'
              },
              WorkingRoot
            );
            console.info('[working-sessions] WorkingRoot registered');
          } catch (error) {
            console.error('[working-sessions] register failed', error);
            return undefined;
          }
          ensureBridge();
          try {
            ctx.slots.subscribe('sidebar.workspaces', () => { ensureBridge(); });
          } catch {}
          return dispose;
        });
      }
    };
  }
});
