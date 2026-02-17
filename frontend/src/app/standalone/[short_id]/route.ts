import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || 'http://localhost:3001/api';

/**
 * 与 FullHTMLRenderer 一致的 eduNestRuntime 注入脚本。
 * 在 standalone 返回的 full_html 中注入，使 Learn 页与 short_id 页能统一收到 stage_change 和 EDUNEST_UI_STATE_RESPONSE。
 * - 内容若已定义 window.eduNestRuntime（如 intro 模板），则不会被覆盖（下方用 if undefined 再赋值）。
 * - 始终注入对 EDUNEST_GET_UI_STATE 的监听，以便父页 refreshUIState 能拿到完整 uiState。
 */
const EDUNEST_RUNTIME_SCRIPT = `
<script>
(function() {
  'use strict';
  if (typeof window.eduNestRuntime === 'undefined') {
    window.eduNestRuntime = {
      dispatchLearningEvent: function(eventType, data) {
        if (window.parent) {
          window.parent.postMessage({
            type: 'EDUNEST_EVENT',
            data: { eventType: eventType, data: data || {}, timestamp: new Date().toISOString() }
          }, '*');
        }
      },
      requestAIGuideHelp: function(payload) {
        if (window.parent) {
          window.parent.postMessage({ type: 'EDUNEST_AI_GUIDE_REQUEST', data: payload || {} }, '*');
        }
      },
      getUIState: function() {
        var state = {};
        if (typeof window.__eduNestUIStateProvider === 'function') {
          try {
            var custom = window.__eduNestUIStateProvider();
            if (custom && typeof custom === 'object') {
              for (var k in custom) if (custom.hasOwnProperty(k)) state[k] = custom[k];
            }
          } catch (e) {}
        }
        if (state.currentStageIndex != null && state.stageIndex == null) state.stageIndex = Number(state.currentStageIndex) + 1;
        var inputs = document.querySelectorAll('input, select, textarea');
        inputs.forEach(function(inp) {
          var name = inp.name || inp.id;
          if (name) {
            if (inp.type === 'checkbox' || inp.type === 'radio') state[name] = inp.checked;
            else if (inp.type === 'range') state[name] = parseFloat(inp.value) || 0;
            else state[name] = inp.value || '';
          }
        });
        var si = document.querySelector('[data-stage-index]');
        if (si) { var v = si.getAttribute('data-stage-index'); state.stageIndex = v != null && !isNaN(parseFloat(v)) ? parseFloat(v) : v; }
        var cs = document.querySelector('[data-current-stage]');
        if (cs) state.currentStage = cs.getAttribute('data-current-stage') || '';
        var sc = document.querySelector('[data-score]');
        if (sc) { var v = sc.getAttribute('data-score'); state.score = v != null && !isNaN(parseFloat(v)) ? parseFloat(v) : v; }
        if (state.currentStage != null && state.stageIndex == null) {
          var csVal = state.currentStage;
          if (typeof csVal === 'number') state.stageIndex = csVal;
          else if (typeof csVal === 'string') { var numMatch = csVal.match(/(\\d+)/); if (numMatch) state.stageIndex = parseFloat(numMatch[1]); }
        }
        if (state.stageIndex == null || state.currentStage == null) {
          var activeTab = document.querySelector('.tab-header.active') || document.querySelector('.nav-link.active') || document.querySelector('[role="tab"][aria-selected="true"]') || document.querySelector('.tab.active');
          if (activeTab && activeTab.parentElement) {
            var headers = activeTab.parentElement.querySelectorAll('.tab-header, .nav-link, [role="tab"], .tab');
            if (headers.length === 0) headers = activeTab.parentElement.children;
            var idx = Array.prototype.indexOf.call(headers, activeTab);
            if (idx >= 0) {
              if (state.stageIndex == null) state.stageIndex = idx + 1;
              if (state.currentStage == null) state.currentStage = (activeTab.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 80) || ('stage' + (idx + 1));
              if (state.totalStages == null && headers.length > 0) state.totalStages = headers.length;
            }
          }
        }
        if (state.stageIndex == null && state.currentStage == null) {
          var panels = document.querySelectorAll('.tab-panel, .tab-pane');
          var headers = document.querySelectorAll('.tab-header, .nav-link, [role="tab"]');
          for (var i = 0; i < panels.length; i++) {
            var p = panels[i];
            var isVisible = p.offsetParent !== null && (p.style.display !== 'none');
            if (isVisible && headers[i]) {
              if (state.stageIndex == null) state.stageIndex = i + 1;
              if (state.currentStage == null) state.currentStage = (headers[i].textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 80) || ('stage' + (i + 1));
              if (state.totalStages == null && headers.length > 0) state.totalStages = headers.length;
              break;
            }
          }
        }
        if (state.stageIndex == null && state.currentStage == null) {
          var anyActive = document.querySelector('.active');
          if (anyActive && anyActive.parentElement && anyActive.parentElement.children.length > 1) {
            var sibs = anyActive.parentElement.children;
            var idx = Array.prototype.indexOf.call(sibs, anyActive);
            if (idx >= 0) {
              state.stageIndex = idx + 1;
              state.currentStage = (anyActive.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 80) || ('stage' + (idx + 1));
              state.totalStages = sibs.length;
            }
          }
        }
        if (state.stageIndex == null || state.currentStage == null) {
          var rounded = document.querySelectorAll('[class*="rounded-full"], .rounded-full');
          var bestBar = null;
          var bestFilled = 0;
          var bestTotal = 0;
          for (var ri = 0; ri < rounded.length; ri++) {
            var bar = rounded[ri].parentElement;
            if (!bar || bar.children.length < 3) continue;
            var filledCount = 0;
            for (var ci = 0; ci < bar.children.length; ci++) {
              var cell = bar.children[ci];
              var cn = (cell.className && typeof cell.className === 'string') ? cell.className : '';
              if (cn.indexOf('bg-blue') !== -1) filledCount++;
            }
            if (filledCount <= bar.children.length && bar.children.length > bestTotal) {
              bestTotal = bar.children.length;
              bestFilled = filledCount;
              bestBar = bar;
            }
          }
          if (bestBar) {
            if (state.stageIndex == null) state.stageIndex = bestFilled > 0 ? bestFilled : 1;
            if (state.totalStages == null) state.totalStages = bestTotal;
          }
          if (state.currentStage == null) {
            var h2 = document.querySelector('.bg-slate-800 h2') || document.querySelector('[class*="bg-slate"] h2') || document.querySelector('#app h2');
            if (h2) state.currentStage = (h2.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 80);
          }
        }
        return state;
      }
    };
  }
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'EDUNEST_GET_UI_STATE') {
      function sendState() {
        var ui = window.eduNestRuntime.getUIState();
        if (window.parent) {
          window.parent.postMessage({ type: 'EDUNEST_UI_STATE_RESPONSE', data: ui }, '*');
        }
      }
      var ui = window.eduNestRuntime.getUIState();
      if (ui.stageIndex != null || ui.currentStage != null) {
        sendState();
      } else {
        if (document.readyState !== 'complete') {
          window.addEventListener('load', function once() {
            window.removeEventListener('load', once);
            setTimeout(sendState, 250);
          });
        } else {
          setTimeout(sendState, 350);
        }
      }
    }
  });
})();
</script>`;

/** 在 full_html 的 <head> 末尾注入 runtime，保证先于 body 内脚本执行 */
function injectEduNestRuntime(fullHtml: string): string {
  const closeHead = /<\/head\s*>/i;
  if (closeHead.test(fullHtml)) {
    return fullHtml.replace(closeHead, EDUNEST_RUNTIME_SCRIPT + '\n</head>');
  }
  const openBody = /<body\s*[^>]*>/i;
  if (openBody.test(fullHtml)) {
    return fullHtml.replace(openBody, (m) => m + EDUNEST_RUNTIME_SCRIPT);
  }
  return EDUNEST_RUNTIME_SCRIPT + fullHtml;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { short_id: string } }
) {
  try {
    const shortId = params.short_id;

    // 直接调用后端 API，避免使用包含 React 依赖的 api 客户端
    const response = await fetch(`${API_BASE_URL}/content/short/${encodeURIComponent(shortId)}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: 'Content not found' }, { status: 404 });
      }
      return NextResponse.json(
        { error: 'Failed to fetch content' },
        { status: response.status }
      );
    }

    const result = await response.json();
    const content = result?.data;

    if (!content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    // 直接返回 full_html，如果没有则返回错误
    if (!content.full_html) {
      return NextResponse.json({ error: 'Content does not have full_html' }, { status: 404 });
    }

    const html = injectEduNestRuntime(content.full_html);

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error generating standalone page:', error);
    return NextResponse.json(
      { error: 'Failed to generate standalone page' },
      { status: 500 }
    );
  }
}


