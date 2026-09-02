/**
 * report-export.js
 * -----------------------------------------------------------------------
 * Botão "Exportar Relatório" injetado na tela Painel (dashboard) do
 * sistema. Este arquivo é aditivo: não altera nem depende de detalhes
 * internos do bundle gerado em app.js. Ele apenas observa o DOM já
 * renderizado, adiciona um botão flutuante e, ao clicar, captura o
 * conteúdo visível do painel (respeitando o filtro Dia/Semana/Mês/Ano e
 * a data selecionados no momento) e gera um PDF para download.
 *
 * Dependências (carregadas via <script defer> no index.html, antes
 * deste arquivo): html2canvas e jsPDF (window.jspdf).
 *
 * Mantido separado de app.js de propósito: app.js é um build minificado
 * sem código-fonte versionado, então qualquer lógica nova deve viver
 * aqui, em um arquivo legível e editável diretamente.
 * -----------------------------------------------------------------------
 */
(function () {
  "use strict";

  var BUTTON_ID = "vx-export-report-btn";
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

  // Acha um elemento "folha" (sem filhos) cujo texto bate exatamente
  // com o procurado. Usado para localizar marcos fixos do layout
  // (títulos de seção) sem depender de classes internas do bundle.
  function findElementByExactText(text) {
    var all = document.querySelectorAll("h1, h2, h3, h4, div, span, p");
    for (var i = 0; i < all.length; i++) {
      if (all[i].children.length === 0 && all[i].textContent.trim() === text) {
        return all[i];
      }
    }
    return null;
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
  // painel e a última seção conhecida da tela (Desempenho por
  // Colaborador). Isso garante que cards, gráficos e tabela — tudo que
  // fica entre os dois — entre na captura, em vez de parar cedo demais
  // num wrapper estreito só do cabeçalho.
  function getReportContainer(heading) {
    if (heading) {
      var landmark =
        findElementByExactText("DESEMPENHO POR COLABORADOR") ||
        findElementByExactText("COMPOSIÇÃO E EVOLUÇÃO");
      if (landmark) {
        var common = commonAncestor(heading, landmark);
        if (common) return common;
      }
    }
    return getContainerByWidthHeuristic(heading);
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
  // Geração do PDF
  // ---------------------------------------------------------------------

  function loadLibsReady() {
    return typeof window.html2canvas === "function" &&
      window.jspdf && typeof window.jspdf.jsPDF === "function";
  }

  async function exportReport() {
    var btn = document.getElementById(BUTTON_ID);
    if (!btn) return;

    if (!loadLibsReady()) {
      alert(
        "As bibliotecas de exportação ainda estão carregando. Aguarde alguns segundos e tente novamente."
      );
      return;
    }

    var heading = findPainelHeading();
    var container = getReportContainer(heading);
    if (!container) {
      alert("Não encontrei o conteúdo do painel para exportar.");
      return;
    }

    var originalLabel = btn.innerHTML;
    btn.disabled = true;
    btn.style.cursor = "wait";
    btn.innerHTML = "Gerando PDF...";

    try {
      var canvas = await window.html2canvas(container, {
        backgroundColor: "#f4f7f8",
        scale: Math.min(2, window.devicePixelRatio || 1.5),
        useCORS: true,
        ignoreElements: function (el) {
          return el.id === BUTTON_ID;
        }
      });

      var jsPDF = window.jspdf.jsPDF;
      var pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
      var pageWidth = pdf.internal.pageSize.getWidth();
      var pageHeight = pdf.internal.pageSize.getHeight();
      var margin = 24;
      var usableWidth = pageWidth - margin * 2;

      var periodo = getActivePeriodLabel() || "-";
      var dataSel = getSelectedDate();
      var geradoEm = new Date().toLocaleString("pt-BR");

      pdf.setFontSize(14);
      pdf.setTextColor(20, 20, 20);
      pdf.text("Relatório de Produção", margin, margin + 6);
      pdf.setFontSize(9);
      pdf.setTextColor(90, 90, 90);
      pdf.text(
        "Período: " + periodo + (dataSel ? "  •  Data de referência: " + dataSel : ""),
        margin,
        margin + 22
      );
      pdf.text("Gerado em: " + geradoEm, margin, margin + 34);

      var cursorY = margin + 46;
      var imgWidth = usableWidth;
      var imgHeight = (canvas.height * imgWidth) / canvas.width;
      var scalePxPerPt = canvas.width / imgWidth;

      var remainingHeight = imgHeight;
      var sourceY = 0;
      var pageUsableHeight = pageHeight - margin * 2;
      var firstPage = true;

      while (remainingHeight > 0.5) {
        var availableHeight = firstPage
          ? pageHeight - cursorY - margin
          : pageUsableHeight;
        var sliceHeightPt = Math.min(availableHeight, remainingHeight);
        var sliceHeightPx = sliceHeightPt * scalePxPerPt;

        var sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceHeightPx;
        var ctx = sliceCanvas.getContext("2d");
        ctx.drawImage(
          canvas,
          0, sourceY, canvas.width, sliceHeightPx,
          0, 0, canvas.width, sliceHeightPx
        );

        pdf.addImage(
          sliceCanvas.toDataURL("image/png"),
          "PNG",
          margin,
          firstPage ? cursorY : margin,
          imgWidth,
          sliceHeightPt
        );

        remainingHeight -= sliceHeightPt;
        sourceY += sliceHeightPx;
        firstPage = false;

        if (remainingHeight > 0.5) pdf.addPage();
      }

      var fileDate = dataSel || new Date().toISOString().slice(0, 10);
      var fileSafePeriodo = periodo.toLowerCase().replace(/[^a-z0-9]/gi, "");
      pdf.save("relatorio-producao-" + fileSafePeriodo + "-" + fileDate + ".pdf");
    } catch (err) {
      console.error("[report-export] falha ao gerar PDF:", err);
      alert(
        "Não foi possível gerar o relatório em PDF. Abra o console (F12) para ver o erro técnico."
      );
    } finally {
      btn.disabled = false;
      btn.style.cursor = "pointer";
      btn.innerHTML = originalLabel;
    }
  }

  // ---------------------------------------------------------------------
  // Botão flutuante + observação da SPA
  // ---------------------------------------------------------------------

  function createButton() {
    var btn = document.createElement("button");
    btn.id = BUTTON_ID;
    btn.type = "button";
    btn.innerHTML = "&#8681;&nbsp; Exportar Relatório";
    btn.title = "Exportar o painel atual (respeitando o filtro selecionado) em PDF";

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
      if (!btn.disabled) style.filter = "brightness(1.08)";
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
