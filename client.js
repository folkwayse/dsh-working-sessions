/**
 * dsh-working-sessions — v5 FINAL.
 *
 * Root cause terverifikasi: standard hooks (props.useSessions dll.) adalah
 * selector-hooks — WAJIB dipanggil dengan selector, persis seperti pemakaian
 * internal WorkspaceBrowser: useSessions((s) => s) (ui-workspace client.js:2727).
 * Panggilan tanpa selector → useSyncExternalStoreWithSelector memanggil
 * selector undefined → "l is not a function".
 *
 * Struktur: WorkingRoot = class error boundary (sidebar tak pernah rusak),
 * WorkingInner = hooks + banner, OriginalBrowser tetap ter-render di bawah.
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
      try {
        if (!list || !Array.isArray(list.ids)) return working;
        const projections = list.projectionsBySession || {};
        for (const id of list.ids) {
          const s = list.byId && list.byId[id];
          if (!s || s.archived) continue;
          const st = statuses && statuses.get ? statuses.get(id) : undefined;
          // Status live (sessionStatus service) adalah kebenaran utama —
          // s.running dari summary sering stale (sesi berhenti tetap true).
          const running = st ? st.running === true : Boolean(s.running);
          // Subagent aktif = child yang STATUS-NYA running (bukan sekadar
          // panjang katalog — katalog memuat subagent yang sudah selesai).
          // Sama dengan runningChildCount ui-workspace client.js:450.
          const catalog = projections[id]?.values?.subagentCatalog;
          const subagents = catalog
            ? catalog.reduce((count, child) =>
                count + ((statuses.get(child.id)?.running ?? list.byId[child.id]?.running) === true ? 1 : 0), 0)
            : 0;
          // Guard zombie hanya untuk running: host kadang menandai sesi lama
          // "running" (mentok/crash tanpa stop signal). Sesi aktif beneran
          // streaming punya updatedAt segar (event terakhir < 10 menit).
          const fresh = (Date.now() - (Number(s.updatedAt) || 0)) < 10 * 60 * 1000;
          const active = (running || subagents > 0) && fresh;
          if (active) {
            working.push({ id, title: s.title, displayTitle: s.displayTitle, running: true, completed: false });
            continue;
          }
          // Selesai-belum-dibuka (dot hijau): tampil sebagai ✓ sampai sesinya
          // dibuka. Sesi yang status live-nya MASIH running / punya subagent
          // tidak pernah masuk sini — spinner sidebar masih muter berarti
          // dia bukan "selesai", walau completionUnread sempat ke-set.
          const completed = (st && st.completionUnread) === true && !running && subagents === 0;
          if (!completed) continue;
          working.push({ id, title: s.title, displayTitle: s.displayTitle, running: false, completed: true });
        }
        working.sort((a, b) => (b.running - a.running));
      } catch (e) {
        console.warn('[working-sessions] pickWorking error', e);
      }
      return working;
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
      if (!working.length) return null;
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
      return h('div', { style: { margin: '2px 0 4px' } },
        // Header gaya section label sidebar (seperti "Workspaces")
        h('div', {
          style: {
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '0 16px', margin: '6px 0 2px',
            fontSize: 11.5, fontWeight: 500,
            color: 'var(--dsh-text-tertiary, #8a8a96)',
            textTransform: 'none', userSelect: 'none'
          }
        },
          h('span', {
            style: {
              width: 6, height: 6, borderRadius: '50%', background: '#3fb27f',
              flexShrink: 0, boxShadow: '0 0 0 3px rgba(63,178,127,0.15)'
            }
          }),
          `Working`
        ),
        // Baris sesi: gaya sama dengan row sesi sidebar
        h('div', { style: { padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 1 } },
          working.map((s) =>
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
                      color: '#3fb27f', fontSize: 12, fontWeight: 700
                    }
                  }, '✓'),
              h('span', {
                style: { overflow: 'hidden', textOverflow: 'ellipsis' }
              }, s.displayTitle || s.title || s.id)
            )
          )
        ),
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
