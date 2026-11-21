import AdminButton from "./AdminButton";
import type { ProductDraft } from "./product-draft";
export default function ProductDetailsSection({
  draft,
  update,
  error,
  id,
}: {
  draft: ProductDraft;
  update: (patch: Partial<ProductDraft>) => void;
  error: (field: string) => React.ReactNode;
  id: string;
}) {
  return (
    <div className="space-y-5">
      {(
        [
          ["description", "Descripción"],
          ["materials", "Materiales"],
          ["specifications", "Especificaciones"],
        ] as const
      ).map(([key, label]) => (
        <div key={key}>
          <label htmlFor={id + key}>{label}</label>
          <textarea
            id={id + key}
            name={key}
            value={draft[key]}
            rows={3}
            maxLength={
              key === "description" ? 10000 : key === "materials" ? 2000 : 5000
            }
            onChange={(e) => update({ [key]: e.target.value })}
          />
          {error(key)}
        </div>
      ))}
      <fieldset>
        <legend>Medidas por talla (cm)</legend>
        {error("measurements")}
        <div id={id + "measurements"} tabIndex={-1}>
          {draft.measurements.map((m, i) => (
            <div className="admin-measurement-row" key={i}>
              {(["size", "chestCm", "waistCm", "hipCm"] as const).map(
                (key, n) => (
                  <label key={key}>
                    {["Talla", "Pecho", "Cintura", "Cadera"][n]}
                    <input
                      aria-label={`${["Talla", "Pecho", "Cintura", "Cadera"][n]} de medida ${i + 1}`}
                      value={m[key] ?? ""}
                      type={key === "size" ? "text" : "number"}
                      min="0.01"
                      step="0.01"
                      onChange={(e) =>
                        update({
                          measurements: draft.measurements.map((v, j) =>
                            j === i
                              ? { ...v, [key]: e.target.value || null }
                              : v
                          ),
                        })
                      }
                    />
                  </label>
                )
              )}
              <AdminButton
                type="button"
                onClick={() =>
                  update({
                    measurements: draft.measurements.filter((_, j) => j !== i),
                  })
                }
              >
                Quitar talla {i + 1}
              </AdminButton>
            </div>
          ))}
        </div>
        <AdminButton
          type="button"
          disabled={draft.measurements.length >= 30}
          onClick={() =>
            update({
              measurements: [
                ...draft.measurements,
                { size: "", chestCm: null, waistCm: null, hipCm: null },
              ],
            })
          }
        >
          Agregar talla
        </AdminButton>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          Estatura del modelo (cm)
          <input
            id={id + "modelHeightCm"}
            type="number"
            min="0.01"
            step="0.01"
            value={draft.modelHeightCm ?? ""}
            onChange={(e) => update({ modelHeightCm: e.target.value || null })}
          />
          {error("modelHeightCm")}
        </label>
        <label>
          Talla usada por el modelo
          <input
            id={id + "modelSize"}
            value={draft.modelSize ?? ""}
            maxLength={30}
            onChange={(e) => update({ modelSize: e.target.value || null })}
          />
          {error("modelSize")}
        </label>
      </div>
    </div>
  );
}
