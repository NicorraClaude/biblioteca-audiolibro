"use client";

import { useEffect, useRef } from "react";

// Contenedor con scroll horizontal que RECUERDA dónde quedó.
//
// Sin esto, al entrar a un libro y volver con el botón "atrás", el navegador
// restaura el scroll vertical de la página pero los carruseles vuelven al
// principio: el libro que estabas mirando desaparece de la vista y hay que
// buscarlo de nuevo. La posición se guarda por fila y dura lo que dura la
// pestaña (sessionStorage), que es exactamente el tiempo que importa.
export function FilaScroll({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const clave = `fila:${id}`;

    const guardado = sessionStorage.getItem(clave);
    if (guardado) el.scrollLeft = Number(guardado);

    // Con debounce: el evento scroll dispara decenas de veces por segundo y no
    // hace falta escribir en cada una.
    let t: number | undefined;
    const alScrollear = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => sessionStorage.setItem(clave, String(el.scrollLeft)), 120);
    };
    el.addEventListener("scroll", alScrollear, { passive: true });
    return () => {
      el.removeEventListener("scroll", alScrollear);
      window.clearTimeout(t);
    };
  }, [id]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
