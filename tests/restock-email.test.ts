import { test } from "node:test";
import assert from "node:assert/strict";
import { renderRestockEmail } from "../supabase/functions/_shared/restock/infra/RestockEmail";

const input = {
  productName: `Playera "Saints" <Edición> & más`,
  size: "M",
  color: "Negro",
  productUrl: "https://tienda.example/productos/playera?x=1&y=2",
  unsubscribeUrl: "https://tienda.example/baja?token=abc",
};

test("restock email escapes product data in HTML", () => {
  const { html } = renderRestockEmail(input);
  assert.match(
    html,
    /Playera &quot;Saints&quot; &lt;Edición&gt; &amp; más volvió/
  );
  assert.doesNotMatch(html, /<Edición>/);
  assert.match(
    html,
    /href="https:\/\/tienda\.example\/productos\/playera\?x=1&amp;y=2"/
  );
  assert.match(html, /href="https:\/\/tienda\.example\/baja\?token=abc"/);
  assert.match(html, /M \/ Negro/);
});

test("restock email has a plain text twin and subject", () => {
  const { subject, text } = renderRestockEmail(input);
  assert.equal(subject, `Volvió ${input.productName}`);
  assert.match(text, /\(M \/ Negro\) volvió a estar disponible/);
  assert.ok(text.includes(input.productUrl));
  assert.ok(text.includes("Cancelar avisos: " + input.unsubscribeUrl));
});
