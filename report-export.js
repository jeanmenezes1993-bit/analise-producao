/**
 * report-export.js
 * -----------------------------------------------------------------------
 * Botão "Exportar Relatório" injetado na tela Painel (dashboard) do
 * sistema. Este arquivo é aditivo: não altera nem depende de detalhes
 * internos do bundle gerado em app.js.
 *
 * Histórico de abordagens (por que chegamos neste design):
 * 1ª tentativa: capturar a tela em canvas (html2canvas) e fatiar em
 * imagens no PDF (jsPDF) — frágil: ou cortava conteúdo, ou espalhava
 * tudo em dezenas de páginas minúsculas.
 * 2ª tentativa: impressão nativa do navegador, escondendo/mostrando os
 * elementos reais da tela via CSS de impressão — melhor (texto
 * vetorial, paginação correta), mas ainda frágil: dropdowns de filtro
 * "flutuavam" fora do lugar, cartões cortavam entre páginas, e cartões
 * desmarcados às vezes continuavam aparecendo (o app re-renderiza via
 * React e pode desfazer classes que adicionamos no DOM que ele
 * controla).
 * 3ª tentativa (atual): não mexemos mais no DOM da tela. Só LEMOS o
 * texto de cada cartão selecionado (rótulo + valor) e construímos um
 * relatório próprio — um "resumo executivo" com grade de indicadores —
 * num elemento novo, fora da árvore que o React controla (anexado
 * direto no body). Isso elimina a classe inteira de bugs anteriores:
 * não há nada pra "desfazer", nada flutuando fora do lugar, nada
 * cortando ao meio.
 *
 * Mantido separado de app.js de propósito: app.js é um build minificado
 * sem código-fonte versionado, então qualquer lógica nova deve viver
 * aqui, em um arquivo legível e editável diretamente.
 * -----------------------------------------------------------------------
 */
(function () {
  "use strict";

  var BUTTON_ID = "vx-export-report-btn";
  var DIALOG_ID = "vx-export-report-dialog";
  var REPORT_ROOT_ID = "vx-export-report-root";
  var PRINT_STYLE_ID = "vx-export-report-print-style";
  var PRINT_TARGET_CLASS = "vx-print-target";
  var STORAGE_KEY = "vx-export-report-selected-cards";
  var BRAND_TEAL = "#16C2C2";
  var PAINEL_TITLE = "Painel de Produção";

  // Cartões de indicador que podem ser ligados/desligados no relatório.
  // "search" é o texto usado para localizar o cartão na tela (ver
  // findElementByText), de onde extraímos rótulo + valor.
  var CARD_SECTIONS = [
    { id: "prod-nacional", label: "Produção Nacional", search: "Produção Nacional" },
    { id: "prod-importada", label: "Produção Importada", search: "Produção Importada" },
    { id: "total-periodo", label: "Total do Período", search: "Total do Período" },
    { id: "maior-volume", label: "Maior Volume", search: "Maior Volume" },
    { id: "melhor-ritmo", label: "Melhor Ritmo", search: "Melhor Ritmo" },
    { id: "ritmo-medio", label: "Ritmo Médio", search: "Ritmo Médio" },
    { id: "colaboradores-ativos", label: "Colaboradores Ativos", search: "Colaboradores Ativos" }
  ];

  // ---------------------------------------------------------------------
  // Helpers de leitura do estado atual da tela
  // ---------------------------------------------------------------------

  function findPainelHeading() {
    var candidates = document.querySelectorAll("h1, h2");
    for (var i = 0; i < candidates.length; i++) {
      if (candidates[i].textContent.trim() === PAINEL_TITLE) {
        return candidates[i];
      }
    }
    return null;
  }

  // Acha um elemento cujo texto bate com o procurado, ignorando
  // maiúsculas/minúsculas (rótulos de seção costumam ser exibidos em
  // caixa alta só por CSS text-transform, com o texto real em
  // minúsculas no DOM) e espaços extras. Prioriza o elemento mais
  // específico (sem filhos); se não achar, aceita o de menor texto
  // entre os que contêm a frase.
  function findElementByText(text) {
    var needle = text.trim().toLowerCase();
    var all = document.querySelectorAll(
      "h1, h2, h3, h4, h5, div, span, p, td, th, label"
    );
    for (var i = 0; i < all.length; i++) {
      if (
        all[i].children.length === 0 &&
        all[i].textContent.trim().toLowerCase() === needle
      ) {
        return all[i];
      }
    }
    var best = null;
    for (var j = 0; j < all.length; j++) {
      var content = all[j].textContent.trim().toLowerCase();
      if (content.indexOf(needle) !== -1) {
        if (!best || content.length < best.textContent.trim().length) {
          best = all[j];
        }
      }
    }
    return best;
  }

  // Sobe a partir do rótulo do cartão até um ancestral que (a) tem
  // irmãos no mesmo nível (indício de estar numa fileira de cartões) e
  // (b) tem tamanho plausível de cartão (não só a linha do ícone com o
  // rótulo). Guarda o primeiro candidato com irmãos como reserva, caso
  // nenhum nível satisfaça o tamanho mínimo.
  function climbToCardLevel(el) {
    var node = el;
    var fallback = null;
    while (node && node.parentElement) {
      if (node.parentElement.children.length > 1) {
        var rect = node.getBoundingClientRect();
        if (rect.height >= 50 && rect.width >= 100) {
          return node;
        }
        if (!fallback) fallback = node;
      }
      node = node.parentElement;
    }
    return fallback || node;
  }

  function resolveCardElement(search) {
    var labelEl = findElementByText(search);
    if (!labelEl) return null;
    return climbToCardLevel(labelEl);
  }

  // Lê o conteúdo de um cartão e separa em "valor principal" (o texto
  // com a maior fonte lá dentro — normalmente o número grande, ou o
  // nome do colaborador em destaque) e "extras" (as demais linhas de
  // texto, ex.: "1%", "9.525 un.").
  function extractCardData(el, label) {
    var all = el.querySelectorAll("*");
    var leaves = [];
    for (var i = 0; i < all.length; i++) {
      if (all[i].children.length === 0 && all[i].textContent.trim()) {
        leaves.push(all[i]);
      }
    }
    if (!leaves.length) {
      return { value: el.textContent.trim() || "—", extra: [] };
    }

    var value = leaves[0];
    var maxSize = 0;
    leaves.forEach(function (node) {
      var size = parseFloat(getComputedStyle(node).fontSize) || 0;
      if (size > maxSize) {
        maxSize = size;
        value = node;
      }
    });

    var extra = [];
    leaves.forEach(function (node) {
      if (node === value) return;
      var t = node.textContent.trim();
      if (!t || t.toLowerCase() === label.toLowerCase()) return;
      if (extra.indexOf(t) === -1) extra.push(t);
    });

    return { value: value.textContent.trim(), extra: extra.slice(0, 2) };
  }

  function getActivePeriodLabel() {
    var labels = ["Dia", "Semana", "Mês", "Ano"];
    var buttons = Array.prototype.filter.call(
      document.querySelectorAll("button"),
      function (b) {
        return labels.indexOf(b.textContent.trim()) !== -1;
      }
    );
    if (!buttons.length) return null;

    for (var i = 0; i < buttons.length; i++) {
      var bg = getComputedStyle(buttons[i]).backgroundColor;
      var m = bg.match(/\d+/g);
      if (!m) continue;
      var r = Number(m[0]), g = Number(m[1]), b = Number(m[2]);
      // Botão ativo tem preenchimento colorido (não branco/quase-branco).
      if (!(r > 235 && g > 235 && b > 235)) {
        return buttons[i].textContent.trim();
      }
    }
    return buttons[0].textContent.trim();
  }

  function getSelectedDate() {
    var input = document.querySelector('input[type="date"]');
    return input && input.value ? input.value : null;
  }

  function loadSelectedCardIds() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed) ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  function saveSelectedCardIds(ids) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch (e) {
      // localStorage indisponível (modo privado etc.) — sem problema,
      // só não lembramos a escolha da próxima vez.
    }
  }

  // ---------------------------------------------------------------------
  // Montagem do relatório (elemento próprio, fora do DOM que o React
  // controla) e impressão
  // ---------------------------------------------------------------------

  function ensurePrintStyle() {
    if (document.getElementById(PRINT_STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = PRINT_STYLE_ID;
    style.textContent =
      "@media print {" +
      "  body * { visibility: hidden !important; }" +
      "  ." + PRINT_TARGET_CLASS + "," +
      "  ." + PRINT_TARGET_CLASS + " * { visibility: visible !important; }" +
      "  #" + BUTTON_ID + " { display: none !important; }" +
      "  ." + PRINT_TARGET_CLASS + " {" +
      "    display: block !important;" +
      "    position: absolute !important;" +
      "    left: 0 !important;" +
      "    top: 0 !important;" +
      "    width: 100% !important;" +
      "    margin: 0 !important;" +
      "    background: #fff !important;" +
      "    font-family: 'Inter', system-ui, sans-serif !important;" +
      "  }" +
      "  .vx-print-header { margin: 0 0 20pt 0; }" +
      "  .vx-print-header h1 { font-size: 20pt; margin: 0 0 4pt 0; color: #111; }" +
      "  .vx-print-header p { font-size: 11pt; color: #555; margin: 2pt 0; }" +
      "  .vx-print-grid {" +
      "    display: grid;" +
      "    grid-template-columns: repeat(2, 1fr);" +
      "    gap: 14pt;" +
      "  }" +
      "  .vx-print-kpi {" +
      "    border: 1pt solid #ddd;" +
      "    border-radius: 8pt;" +
      "    padding: 14pt 16pt;" +
      "    break-inside: avoid;" +
      "    page-break-inside: avoid;" +
      "  }" +
      "  .vx-print-kpi-label {" +
      "    font-size: 9pt;" +
      "    text-transform: uppercase;" +
      "    letter-spacing: 0.5pt;" +
      "    color: " + BRAND_TEAL + ";" +
      "    font-weight: 700;" +
      "    margin: 0 0 6pt 0;" +
      "  }" +
      "  .vx-print-kpi-value { font-size: 22pt; font-weight: 800; color: #111; }" +
      "  .vx-print-kpi-extra { font-size: 9pt; color: #777; margin: 4pt 0 0 0; }" +
      "  .vx-print-empty { font-size: 11pt; color: #777; }" +
      "  @page { margin: 18mm; }" +
      "}";
    document.head.appendChild(style);
  }

  function buildReportRoot(selectedCardIds, periodo, dataSel, geradoEm) {
    var root = document.createElement("div");
    root.id = REPORT_ROOT_ID;
    root.className = PRINT_TARGET_CLASS;
    root.style.display = "none"; // só aparece via @media print

    var header = document.createElement("div");
    header.className = "vx-print-header";
    header.innerHTML =
      "<h1>Relatório de Produção</h1>" +
      "<p>Período: " +
      periodo +
      (dataSel ? " &nbsp;•&nbsp; Data de referência: " + dataSel : "") +
      "</p>" +
      "<p>Gerado em: " +
      geradoEm +
      "</p>";
    root.appendChild(header);

    var grid = document.createElement("div");
    grid.className = "vx-print-grid";
    var foundAny = false;

    CARD_SECTIONS.forEach(function (section) {
      if (selectedCardIds.indexOf(section.id) === -1) return;

      var el = resolveCardElement(section.search);
      var data = el ? extractCardData(el, section.label) : null;

      var cell = document.createElement("div");
      cell.className = "vx-print-kpi";

      var labelEl = document.createElement("div");
      labelEl.className = "vx-print-kpi-label";
      labelEl.textContent = section.label;
      cell.appendChild(labelEl);

      var valueEl = document.createElement("div");
      valueEl.className = "vx-print-kpi-value";
      valueEl.textContent = data ? data.value : "—";
      cell.appendChild(valueEl);

      if (data && data.extra.length) {
        var extraEl = document.createElement("div");
        extraEl.className = "vx-print-kpi-extra";
        extraEl.textContent = data.extra.join(" · ");
        cell.appendChild(extraEl);
      }

      grid.appendChild(cell);
      foundAny = true;
    });

    root.appendChild(grid);

    if (!foundAny) {
      var empty = document.createElement("p");
      empty.className = "vx-print-empty";
      empty.textContent = "Nenhum cartão selecionado.";
      root.appendChild(empty);
    }

    return root;
  }

  function runExport(selectedCardIds) {
    ensurePrintStyle();

    var periodo = getActivePeriodLabel() || "-";
    var dataSel = getSelectedDate();
    var geradoEm = new Date().toLocaleString("pt-BR");

    var root = buildReportRoot(selectedCardIds, periodo, dataSel, geradoEm);
    document.body.appendChild(root);

    var originalTitle = document.title;
    var fileDate = dataSel || new Date().toISOString().slice(0, 10);
    var fileSafePeriodo = periodo.toLowerCase().replace(/[^a-z0-9]/gi, "");
    document.title = "relatorio-producao-" + fileSafePeriodo + "-" + fileDate;

    function cleanup() {
      if (root.parentNode) root.parentNode.removeChild(root);
      document.title = originalTitle;
      window.removeEventListener("afterprint", cleanup);
    }

    window.addEventListener("afterprint", cleanup);
    // Segurança: caso o navegador não dispare "afterprint" (alguns
    // fluxos de "cancelar" no diálogo não disparam em certos
    // navegadores), desfaz de qualquer forma depois de um tempo.
    setTimeout(cleanup, 60000);

    window.print();
  }

  // ---------------------------------------------------------------------
  // Diálogo de seleção de cartões
  // ---------------------------------------------------------------------

  function styleDialogButton(btn, primary) {
    var style = btn.style;
    style.padding = "8px 16px";
    style.borderRadius = "8px";
    style.fontSize = "13px";
    style.fontWeight = "600";
    style.fontFamily = "'Inter', system-ui, sans-serif";
    style.cursor = "pointer";
    if (primary) {
      style.background = BRAND_TEAL;
      style.color = "#fff";
      style.border = "none";
    } else {
      style.background = "#fff";
      style.color = "#333";
      style.border = "1px solid #ddd";
    }
  }

  function closeDialog() {
    var overlay = document.getElementById(DIALOG_ID);
    if (overlay) overlay.remove();
  }

  function openExportDialog() {
    if (document.getElementById(DIALOG_ID)) return;

    var overlay = document.createElement("div");
    overlay.id = DIALOG_ID;
    var overlayStyle = overlay.style;
    overlayStyle.position = "fixed";
    overlayStyle.inset = "0";
    overlayStyle.background = "rgba(15,23,23,0.55)";
    overlayStyle.zIndex = "2147483600";
    overlayStyle.display = "flex";
    overlayStyle.alignItems = "center";
    overlayStyle.justifyContent = "center";
    overlayStyle.fontFamily = "'Inter', system-ui, sans-serif";

    var panel = document.createElement("div");
    var panelStyle = panel.style;
    panelStyle.background = "#fff";
    panelStyle.borderRadius = "14px";
    panelStyle.padding = "20px 22px";
    panelStyle.width = "320px";
    panelStyle.maxWidth = "90vw";
    panelStyle.maxHeight = "80vh";
    panelStyle.overflowY = "auto";
    panelStyle.boxShadow = "0 20px 60px rgba(0,0,0,0.35)";

    var title = document.createElement("h3");
    title.textContent = "Exportar Relatório";
    title.style.margin = "0 0 4px 0";
    title.style.fontSize = "16px";
    title.style.color = "#111";
    panel.appendChild(title);

    var subtitle = document.createElement("p");
    subtitle.textContent = "Escolha quais indicadores entram no resumo:";
    subtitle.style.margin = "0 0 12px 0";
    subtitle.style.fontSize = "12px";
    subtitle.style.color = "#666";
    subtitle.style.lineHeight = "1.4";
    panel.appendChild(subtitle);

    var stored = loadSelectedCardIds();
    var checkboxes = [];

    CARD_SECTIONS.forEach(function (section) {
      var row = document.createElement("label");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "8px";
      row.style.padding = "6px 0";
      row.style.fontSize = "13px";
      row.style.color = "#222";
      row.style.cursor = "pointer";

      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = stored ? stored.indexOf(section.id) !== -1 : true;
      cb.dataset.sectionId = section.id;
      row.appendChild(cb);

      var span = document.createElement("span");
      span.textContent = section.label;
      row.appendChild(span);

      panel.appendChild(row);
      checkboxes.push(cb);
    });

    var actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.justifyContent = "flex-end";
    actions.style.gap = "8px";
    actions.style.marginTop = "16px";

    var cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.textContent = "Cancelar";
    styleDialogButton(cancelBtn, false);
    cancelBtn.addEventListener("click", closeDialog);

    var confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.textContent = "Gerar PDF";
    styleDialogButton(confirmBtn, true);
    confirmBtn.addEventListener("click", function () {
      var selectedIds = checkboxes
        .filter(function (cb) {
          return cb.checked;
        })
        .map(function (cb) {
          return cb.dataset.sectionId;
        });
      saveSelectedCardIds(selectedIds);
      closeDialog();
      runExport(selectedIds);
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    panel.appendChild(actions);

    overlay.appendChild(panel);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeDialog();
    });
    document.body.appendChild(overlay);
  }

  // ---------------------------------------------------------------------
  // Botão flutuante + observação da SPA
  // ---------------------------------------------------------------------

  function createButton() {
    var btn = document.createElement("button");
    btn.id = BUTTON_ID;
    btn.type = "button";
    btn.innerHTML = "&#8681;&nbsp; Exportar Relatório";
    btn.title =
      "Exportar um resumo dos indicadores selecionados em PDF — escolha \"Salvar como PDF\" na janela de impressão";

    var style = btn.style;
    style.position = "fixed";
    style.top = "18px";
    style.right = "24px";
    style.zIndex = "2147483000";
    style.background = BRAND_TEAL;
    style.color = "#fff";
    style.border = "none";
    style.borderRadius = "10px";
    style.padding = "10px 16px";
    style.fontFamily = "'Inter', system-ui, sans-serif";
    style.fontWeight = "600";
    style.fontSize = "13px";
    style.cursor = "pointer";
    style.boxShadow = "0 4px 14px rgba(0,0,0,0.18)";
    style.transition = "filter 0.15s ease, transform 0.15s ease";

    btn.addEventListener("mouseenter", function () {
      style.filter = "brightness(1.08)";
    });
    btn.addEventListener("mouseleave", function () {
      style.filter = "none";
    });
    btn.addEventListener("click", openExportDialog);

    document.body.appendChild(btn);
    return btn;
  }

  function syncButtonVisibility() {
    var onPainel = !!findPainelHeading();
    var btn = document.getElementById(BUTTON_ID);
    if (onPainel && !btn) {
      createButton();
    } else if (!onPainel && btn) {
      btn.remove();
      closeDialog();
    }
  }

  function start() {
    syncButtonVisibility();
    var observer = new MutationObserver(function () {
      syncButtonVisibility();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
