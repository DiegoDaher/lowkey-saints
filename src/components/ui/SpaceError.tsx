import Image from "next/image";
import StoreAction from "@/components/ui/StoreAction";
import styles from "./SpaceError.module.css";

const messages = {
  404: {
    title: "Esta página no existe",
    description: "La página que buscas no está en este universo.",
  },
  401: {
    title: "Esta área está restringida",
    description:
      "No podemos darte acceso a esta página. Puedes volver al inicio y seguir explorando.",
  },
};

export default function SpaceError({ code }: { code: 404 | 401 }) {
  const { title, description } = messages[code];

  return (
    <main className={styles.page}>
      <div className={styles.scene} aria-hidden="true">
        <div className={styles.orbit} />
        <span className={styles.code}>{code}</span>
        <div className={styles.astronaut}>
          <Image
            src="/images/material/astronauta.png"
            alt=""
            fill
            sizes="(max-width: 600px) 40vw, 290px"
            className={styles.image}
            preload
          />
        </div>
        <div className={styles.chromeStars}>
          <Image
            src="/images/material/3_Chromastars.png"
            alt=""
            fill
            sizes="(max-width: 600px) 23vw, 180px"
            className={styles.image}
          />
        </div>
        <div className={styles.monoStars}>
          <Image
            src="/images/material/StarsMono.png"
            alt=""
            fill
            sizes="(max-width: 600px) 16vw, 100px"
            className={styles.image}
          />
        </div>
        <span className={styles.sparkOne}>✦</span>
        <span className={styles.sparkTwo}>✦</span>
      </div>
      <div className={styles.content}>
        <p className={styles.eyebrow}>
          Disculpa, creo que esto no era lo que estabas buscando
        </p>
        <h1 className={styles.title}>
          <span className="sr-only">Error {code}: </span>
          {title}
        </h1>
        <p className={styles.description}>{description}</p>
        <StoreAction href="/">Volver al inicio</StoreAction>
      </div>
    </main>
  );
}
