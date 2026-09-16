// Calcula o intervalo [inicio, fim] (strings "YYYY-MM-DD", como a coluna
// "data" do banco) a partir do período selecionado (Dia/Semana/Mês/Ano)
// e da data de referência escolhida no filtro.

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

function parseISODate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function getDateRange(periodo, dataRefISO) {
  const ref = parseISODate(dataRefISO);

  if (periodo === "dia") {
    return { inicio: dataRefISO, fim: dataRefISO };
  }

  if (periodo === "semana") {
    // Semana começando na segunda-feira.
    const diaSemana = ref.getDay(); // 0=domingo
    const offsetSegunda = diaSemana === 0 ? 6 : diaSemana - 1;
    const inicio = new Date(ref);
    inicio.setDate(ref.getDate() - offsetSegunda);
    const fim = new Date(inicio);
    fim.setDate(inicio.getDate() + 6);
    return { inicio: toISODate(inicio), fim: toISODate(fim) };
  }

  if (periodo === "mes") {
    const inicio = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const fim = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    return { inicio: toISODate(inicio), fim: toISODate(fim) };
  }

  if (periodo === "ano") {
    const inicio = new Date(ref.getFullYear(), 0, 1);
    const fim = new Date(ref.getFullYear(), 11, 31);
    return { inicio: toISODate(inicio), fim: toISODate(fim) };
  }

  return { inicio: dataRefISO, fim: dataRefISO };
}

export function formatDiaMes(iso) {
  const d = parseISODate(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

export function formatMesAno(iso) {
  const d = parseISODate(iso);
  const meses = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez"
  ];
  return `${meses[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
}
