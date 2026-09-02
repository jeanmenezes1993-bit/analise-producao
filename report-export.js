/**
 * report-export.js
 * -----------------------------------------------------------------------
 * Botão "Exportar Relatório" injetado na tela Painel (dashboard) do
 * sistema. Este arquivo é aditivo: não altera nem depende de detalhes
 * internos do bundle gerado em app.js. Ele apenas observa o DOM já
 * renderizado, adiciona um botão flutuante e, ao clicar, aciona a
 * impressão nativa do navegador (respeitando o filtro Dia/Semana/Mês/
 * Ano e a data selecionados no momento), escondendo o menu lateral e o
 * próprio botão via CSS de impressão — o usuário escolhe "Salvar como
 * PDF" no diálogo de impressão do navegador.
 *
 * Por que impressão nativa em vez de "print da tela" + canvas/imagem:
 * a abordagem anterior (html2canvas + jsPDF fatiando uma captura em
 * imagem) se mostrou frágil — ou cortava o conteúdo, ou espalhava tudo
 * em dezenas de páginas minúsculas e ilegíveis. A impressão nativa usa
 * texto real (vetorial), então fica nítido em qualquer zoom, e a
 * paginação é feita pelo próprio motor do navegador — muito mais
 * confiável.
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
  var PRINT_STYLE_ID = "vx-export-report-print-style";
  var PRINT_TARGET_CLASS = "vx-print-target";
  var PRINT_HEADER_CLASS = "vx-print-header";
  var PRINT_HIDE_CLASS = "vx-print-hide";
  var STORAGE_KEY = "vx-export-report-selected-cards";
  var BRAND_TEAL = "#16C2C2";
  var PAINEL_TITLE = "Painel de Produção";

  // Cartões de indicador que podem ser ligados/desligados no relatório.
  // "search" é o texto usado para localizar o cartão na tela (ver
  // findElementByText). Gráficos e a tabela de colaboradores sempre
  // entram no relatório — não são opcionais por enquanto.
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

  function commonAncestor(a, b) {
    var ancestors = new Set();
    var el = a;
    while (el) {
      ancestors.add(el);
      el = el.parentElement;
    }
    el = b;
    while (el) {
      if (ancestors.has(el)) return el;
      el = el.parentElement;
    }
    return null;
  }

  // Sobe a árvore a partir do título até achar um container "largo o
  // suficiente" para ser a área de conteúdo principal (ignorando a
  // barra lateral estreita). Cai para <main> ou document.body se não
  // achar nada melhor.
  function getContainerByWidthHeuristic(heading) {
    var main = document.querySelector("main");
    if (!heading) return main || document.body;

    var el = heading;
    var vw = window.innerWidth || document.documentElement.clientWidth;
    while (el && el.parentElement) {
      el = el.parentElement;
      var w = el.getBoundingClientRect().width;
      if (w >= vw * 0.55) return el;
    }
    return main || document.body;
  }

  // Estratégia principal: usar o ancestral comum entre o título do
  // painel e alguma outra seção conhecida da tela (tenta várias, da
  // mais específica/profunda para a mais genérica). Isso garante que
  // cards, gráficos e tabela — tudo que fica entre os dois — fique
  // dentro do container escolhido para impressão.
  function getReportContainer(heading) {
    var candidateLandmarks = [
      "Desempenho por Colaborador",
      "Composição e Evolução",
      "Nacional x Importado",
      "Colaboradores Ativos",
      "Ritmo Médio"
    ];
    var container = null;

    if (heading) {
      for (var i = 0; i < candidateLandmarks.length && !container; i++) {
        var landmark = findElementByText(candidateLandmarks[i]);
        if (landmark) {
          var common = commonAncestor(heading, landmark);
          if (common) container = common;
        }
      }
    }

    if (!container) {
      container = getContainerByWidthHeuristic(heading);
    }

    return container;
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

  // Esconde controles de filtro (selects/dropdowns de cada gráfico —
  // ex.: escolher colaborador, período de comparação) na impressão.
  // Eles costumam usar position: fixed/absolute calculado por JS para a
  // tela normal; no layout de impressão (sidebar escondida, container
  // reposicionado) esses valores ficam obsoletos e o controle "flutua"
  // fora do lugar, sobre o gráfico. Como são só filtros interativos,
  // não fazem sentido num PDF estático mesmo — melhor escondê-los.
  function hideFloatingControls(container, hiddenEls) {
    var controls = container.querySelectorAll(
      "select, [role='combobox'], [role='listbox'], [aria-haspopup]"
    );
    for (var i = 0; i < controls.length; i++) {
      controls[i].classList.add(PRINT_HIDE_CLASS);
      hiddenEls.push(controls[i]);
    }

    var all = container.querySelectorAll("*");
    for (var j = 0; j < all.length; j++) {
      var el = all[j];
      if (el.classList.contains(PRINT_HIDE_CLASS)) continue;
      if (getComputedStyle(el).position === "fixed") {
        el.classList.add(PRINT_HIDE_CLASS);
        hiddenEls.push(el);
      }
    }
  }

  // Evita que um cartão (caixa com cantos arredondados + borda/sombra)
  // seja cortado ao meio quando cai numa quebra de página. Detecta
  // "cara de cartão" pelo estilo computado em vez de depender de nomes
  // de classe do bundle. Retorna a lista de elementos alterados, para
  // desfazer depois.
  function markCardsToAvoidBreaking(container) {
    var touched = [];
    var all = container.querySelectorAll("*");
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var cs = getComputedStyle(el);
      var hasRadius = parseFloat(cs.borderTopLeftRadius) > 4;
      var hasBoxLook =
        cs.boxShadow !== "none" || parseFloat(cs.borderWidth) >= 1;
      if (hasRadius && hasBoxLook) {
        touched.push({
          el: el,
          breakInside: el.style.breakInside,
          pageBreakInside: el.style.pageBreakInside
        });
        el.style.breakInside = "avoid";
        el.style.pageBreakInside = "avoid";
      }
    }
    return touched;
  }

  function unmarkCardsToAvoidBreaking(touched) {
    touched.forEach(function (entry) {
      entry.el.style.breakInside = entry.breakInside;
      entry.el.style.pageBreakInside = entry.pageBreakInside;
    });
  }

  // ---------------------------------------------------------------------
  // Impressão / exportação em PDF
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
      "    position: absolute !important;" +
      "    left: 0 !important;" +
      "    top: 0 !important;" +
      "    width: 100% !important;" +
      "    max-width: 100% !important;" +
      "    height: auto !important;" +
      "    max-height: none !important;" +
      "    overflow: visible !important;" +
      "    margin: 0 !important;" +
      "    background: #fff !important;" +
      "    box-shadow: none !important;" +
      "    font-size: 13pt !important;" +
      "  }" +
      "  ." + PRINT_TARGET_CLASS + " * {" +
      "    overflow: visible !important;" +
      "    box-shadow: none !important;" +
      "  }" +
      "  ." + PRINT_HEADER_CLASS + " {" +
      "    display: block !important;" +
      "    margin: 0 0 16pt 0 !important;" +
      "    font-family: 'Inter', system-ui, sans-serif !important;" +
      "  }" +
      "  ." + PRINT_HEADER_CLASS + " h1 {" +
      "    font-size: 18pt !important;" +
      "    margin: 0 0 4pt 0 !important;" +
      "  }" +
      "  ." + PRINT_HEADER_CLASS + " p {" +
      "    font-size: 11pt !important;" +
      "    color: #444 !important;" +
      "    margin: 2pt 0 !important;" +
      "  }" +
      "  ." + PRINT_HIDE_CLASS + " {" +
      "    display: none !important;" +
      "  }" +
      "  @page { margin: 16mm; }" +
      "}";
    document.head.appendChild(style);
  }

  function buildPrintHeader(periodo, dataSel, geradoEm) {
    var header = document.createElement("div");
    header.className = PRINT_HEADER_CLASS;
    header.style.display = "none"; // só aparece via @media print
    header.innerHTML =
      "<h1>Relatório de Produção</h1>" +
      "<p>Período: " +
      periodo +
      (dataSel ? " &nbsp;•&nbsp; Data de referência: " + dataSel : "") +
      "</p>" +
      "<p>Gerado em: " +
      geradoEm +
      "</p>";
    return header;
  }

  // O app parece atualizar dados em segundo plano (polling) e
  // re-renderizar via React — o que pode desfazer silenciosamente as
  // classes/estilos que marcamos para a impressão entre o momento em
  // que marcamos e o momento em que a impressão de fato acontece. Este
  // observador reaplica nosso estado imediatamente sempre que algo
  // muda, enquanto a exportação estiver em andamento.
  function startPrintStateEnforcer(container, hiddenEls, breakMarks) {
    function reassert() {
      if (!container.classList.contains(PRINT_TARGET_CLASS)) {
        container.classList.add(PRINT_TARGET_CLASS);
      }
      hiddenEls.forEach(function (el) {
        if (document.body.contains(el) && !el.classList.contains(PRINT_HIDE_CLASS)) {
          el.classList.add(PRINT_HIDE_CLASS);
        }
      });
      breakMarks.forEach(function (entry) {
        if (!document.body.contains(entry.el)) return;
        if (entry.el.style.breakInside !== "avoid") {
          entry.el.style.breakInside = "avoid";
        }
        if (entry.el.style.pageBreakInside !== "avoid") {
          entry.el.style.pageBreakInside = "avoid";
        }
      });
    }

    var observer = new MutationObserver(reassert);
    observer.observe(container, {
      attributes: true,
      attributeFilter: ["class", "style"],
      subtree: true
    });
    reassert();
    return observer;
  }

  function runExport(selectedCardIds) {
    var heading = findPainelHeading();
    var container = getReportContainer(heading);
    if (!container) {
      alert("Não encontrei o conteúdo do painel para exportar.");
      return;
    }

    ensurePrintStyle();

    // Esconde (só na impressão) os cartões que o usuário desmarcou.
    var hiddenEls = [];
    var diagLines = [];
    CARD_SECTIONS.forEach(function (section) {
      if (selectedCardIds.indexOf(section.id) !== -1) return;
      var el = resolveCardElement(section.search);
      if (el) {
        el.classList.add(PRINT_HIDE_CLASS);
        hiddenEls.push(el);
        var rect = el.getBoundingClientRect();
        var line =
          "✓ " + section.label + " → escondido (" +
          el.tagName.toLowerCase() +
          (el.className && typeof el.className === "string" ? "." + el.className.split(" ").join(".") : "") +
          ", " + Math.round(rect.width) + "x" + Math.round(rect.height) + "px)";
        diagLines.push(line);
        console.debug("[report-export] escondendo cartão:", section.label, el);
      } else {
        diagLines.push("✗ " + section.label + " → NÃO ACHADO na tela");
        console.warn("[report-export] não achei o cartão para esconder:", section.label);
      }
    });

    // Diagnóstico temporário: mostra na tela (sem precisar abrir o
    // console) exatamente o que o script encontrou, pra investigar por
    // que cartões desmarcados continuam saindo no PDF.
    if (window.__vxExportDebug !== false) {
      alert(
        "[Diagnóstico Exportar Relatório]\n\n" +
          (diagLines.length ? diagLines.join("\n") : "(nenhum cartão desmarcado)") +
          "\n\nClique OK para continuar para a impressão."
      );
    }

    // Esconde dropdowns/filtros que "flutuam" fora do lugar na
    // impressão, e evita que cartões sejam cortados ao virar página.
    hideFloatingControls(container, hiddenEls);
    var breakMarks = markCardsToAvoidBreaking(container);

    var periodo = getActivePeriodLabel() || "-";
    var dataSel = getSelectedDate();
    var geradoEm = new Date().toLocaleString("pt-BR");
    var header = buildPrintHeader(periodo, dataSel, geradoEm);

    var originalTitle = document.title;
    var fileDate = dataSel || new Date().toISOString().slice(0, 10);
    var fileSafePeriodo = periodo.toLowerCase().replace(/[^a-z0-9]/gi, "");
    document.title = "relatorio-producao-" + fileSafePeriodo + "-" + fileDate;

    container.classList.add(PRINT_TARGET_CLASS);
    container.insertBefore(header, container.firstChild);

    var enforcer = startPrintStateEnforcer(container, hiddenEls, breakMarks);

    function cleanup() {
      enforcer.disconnect();
      container.classList.remove(PRINT_TARGET_CLASS);
      hiddenEls.forEach(function (el) {
        el.classList.remove(PRINT_HIDE_CLASS);
      });
      unmarkCardsToAvoidBreaking(breakMarks);
      if (header.parentNode) header.parentNode.removeChild(header);
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
    subtitle.textContent = "Escolha quais cartões entram no PDF (gráficos e a tabela de colaboradores sempre entram):";
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
      "Exportar o painel atual (respeitando o filtro selecionado) em PDF — escolha \"Salvar como PDF\" na janela de impressão";

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
