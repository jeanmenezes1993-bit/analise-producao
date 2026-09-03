/**
 * duplicate-guard.js
 * -----------------------------------------------------------------------
 * Na tela "Registro de Produção", antes de enviar um novo cadastro,
 * avisa se já foi feito — nesta mesma visita/aba — um cadastro com o
 * mesmo horário (data + hora início + hora fim), colaborador(es) e
 * produto. Não bloqueia por padrão: só pergunta e deixa a pessoa
 * decidir (confirm()).
 *
 * Escopo deliberadamente limitado: compara só com cadastros feitos
 * durante esta visita (fica em memória, zera ao recarregar a página).
 * Não consulta o banco — então não pega duplicidade contra cadastros
 * de dias/sessões anteriores.
 *
 * Como intercepta o envio: a tela tem um <button> "Registrar Produção"
 * dentro de um <form>. O React lida com cliques via um listener
 * "delegado" lá em cima da árvore (não direto no botão) — então um
 * listener nosso, colocado direto no <form> (evento "submit") ou no
 * botão (evento "click") em fase de captura, roda ANTES do React
 * processar o clique. Cancelando com preventDefault() +
 * stopImmediatePropagation(), o envio real nunca chega a acontecer.
 *
 * Aditivo, como report-export.js: não mexe em app.js.
 * -----------------------------------------------------------------------
 */
(function () {
  "use strict";

  var SUBMIT_TEXT = "registrar produção";

  var seenFingerprints = []; // cadastros desta visita
  var boundTarget = null;
  var boundEventName = null;
  var boundButton = null;

  function findSubmitButton() {
    var buttons = document.querySelectorAll("button");
    for (var i = 0; i < buttons.length; i++) {
      if (buttons[i].textContent.trim().toLowerCase() === SUBMIT_TEXT) {
        return buttons[i];
      }
    }
    return null;
  }

  function findEnclosingForm(el) {
    var node = el;
    while (node && node.tagName !== "FORM") {
      node = node.parentElement;
    }
    return node;
  }

  // Lê os campos relevantes da tela no momento do envio. Usa seletores
  // por tipo de input (não por classe/nome interno do bundle, que não
  // conhecemos): únicos <input type="time"> da tela são hora início/
  // fim, o <select> é o colaborador (o 2º só existe com "Em dupla"
  // marcado), etc.
  function readFormSnapshot() {
    var selects = document.querySelectorAll("select");
    var colaborador1 = selects[0] ? selects[0].value : "";

    var duplaCheckbox = document.querySelector('input[type="checkbox"]');
    var emDupla = duplaCheckbox ? duplaCheckbox.checked : false;
    var colaborador2 = emDupla && selects[1] ? selects[1].value : "";

    var produtoInput = document.querySelector(
      'input[placeholder*="Buscar por código"]'
    );
    var produto = produtoInput ? produtoInput.value.trim().toLowerCase() : "";

    var timeInputs = document.querySelectorAll('input[type="time"]');
    var horaInicio = timeInputs[0] ? timeInputs[0].value : "";
    var horaFim = timeInputs[1] ? timeInputs[1].value : "";

    var dateInput = document.querySelector('input[type="date"]');
    var data = dateInput ? dateInput.value : "";

    return {
      colaboradores: [colaborador1, colaborador2].filter(Boolean).sort().join("+"),
      produto: produto,
      horaInicio: horaInicio,
      horaFim: horaFim,
      data: data
    };
  }

  // Só considera "comparável" um cadastro com os campos-chave
  // preenchidos — evita falso alarme (ou falso "não duplicado") em
  // formulário incompleto, que o próprio app já vai barrar na validação
  // dele.
  function isSnapshotUsable(snap) {
    return !!(snap.colaboradores && snap.produto && snap.horaInicio && snap.data);
  }

  function fingerprint(snap) {
    return [snap.data, snap.horaInicio, snap.horaFim, snap.colaboradores, snap.produto].join("|");
  }

  function handleSubmitAttempt(event) {
    var snap = readFormSnapshot();
    if (!isSnapshotUsable(snap)) return; // deixa o próprio app validar

    var key = fingerprint(snap);
    if (seenFingerprints.indexOf(key) !== -1) {
      var proceed = confirm(
        "Já existe um cadastro feito agora, nesta mesma visita, com o mesmo " +
          "horário, colaborador(es) e produto.\n\nDeseja cadastrar mesmo assim?"
      );
      if (!proceed) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
    }
    seenFingerprints.push(key);
  }

  function syncSubmitInterception() {
    var btn = findSubmitButton();
    if (btn === boundButton) return;

    if (boundTarget) {
      boundTarget.removeEventListener(boundEventName, handleSubmitAttempt, true);
      boundTarget = null;
      boundEventName = null;
    }

    boundButton = btn;
    if (!btn) return;

    var form = findEnclosingForm(btn);
    boundTarget = form || btn;
    boundEventName = form ? "submit" : "click";
    boundTarget.addEventListener(boundEventName, handleSubmitAttempt, true);
  }

  function start() {
    syncSubmitInterception();
    var observer = new MutationObserver(function () {
      syncSubmitInterception();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
