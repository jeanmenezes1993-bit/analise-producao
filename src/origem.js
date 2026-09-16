// Categorias de origem de produção/SKU. "consumivel" é a categoria nova
// pedida pelo usuário — mesmo tratamento que nacional/importado, só
// mais uma opção lado a lado.
export const ORIGENS = [
  { valor: "nacional", label: "Nacional", cor: "#16C2C2" },
  { valor: "importado", label: "Importado", cor: "#F5A623" },
  { valor: "consumivel", label: "Consumível", cor: "#8B5CF6" }
];

export function origemLabel(valor) {
  const found = ORIGENS.find((o) => o.valor === valor);
  return found ? found.label : valor;
}

export function origemCor(valor) {
  const found = ORIGENS.find((o) => o.valor === valor);
  return found ? found.cor : "#999999";
}
