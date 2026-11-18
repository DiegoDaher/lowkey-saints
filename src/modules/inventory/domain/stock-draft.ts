export type StockChange = { id: string; version: number; stock: number };
export type StockDraft = Record<
  string,
  { id: string; version: number; value: string }
>;

export function parseStockDraft(draft: StockDraft): StockChange[] {
  const values = Object.values(draft);
  if (!values.length || values.length > 100)
    throw new Error("Guarda entre 1 y 100 celdas por operación");
  return values.map(({ id, version, value }) => {
    if (!/^\d+$/.test(value) || Number(value) > 100000)
      throw new Error("Las existencias deben ser enteros entre 0 y 100000");
    return { id, version, stock: Number(value) };
  });
}
