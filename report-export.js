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
  var PRINT_STYLE_ID = "vx-export-report-print-style";
  var PRINT_TARGET_CLASS = "vx-print-target";
  var PRINT_HEADER_CLASS = "vx-print-header";
  var BRAND_TEAL = "#16C2C2";
  var PAINEL_TITLE = "Painel de Produção";

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

  function exportReport() {
    var btn = document.getElementById(BUTTON_ID);
    if (!btn) return;

    var heading = findPainelHeading();
    var container = getReportContainer(heading);
    if (!container) {
      alert("Não encontrei o conteúdo do painel para exportar.");
      return;
    }

    ensurePrintStyle();

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

    function cleanup() {
      container.classList.remove(PRINT_TARGET_CLASS);
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
    btn.addEventListener("click", exportReport);

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
