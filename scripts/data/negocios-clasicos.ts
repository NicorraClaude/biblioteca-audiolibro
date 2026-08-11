// Clásicos de NEGOCIOS/EMPRENDIMIENTO/RIQUEZA en dominio público.
// Cada uno es un ID de Project Gutenberg. Se ingestan con la categoría
// "Negocios y emprendimientos" forzada (aunque Gutenberg los tenga en otras).
// Son la base "gratis con audio completo" del nicho, para el lanzamiento.
export type CuradoPublico = {
  id: number; // ID en Project Gutenberg
  note: string;
  // Si se omite, cae en "Negocios y emprendimientos". Sirve para sumar títulos de
  // otras categorías (la colección de recomendados por famosos es literatura,
  // historia y ciencia, no solo negocios) sin necesitar otro ingestor.
  categorias?: string[];
  // Quién lo recomienda públicamente. Va en la descripción: es el gancho.
  // Solo nombres con atribución rastreable — acá no se inventa nada.
  recomendadoPor?: string[];
};

export const CLASICOS_NEGOCIOS: CuradoPublico[] = [
  // ⚠️ TODOS los IDs de acá fueron verificados contra el RDF de Gutenberg
  // (título real vs. el que dice la nota). La versión anterior tenía 13 de 19 mal:
  // el catálogo terminó con "Murphy: A Message to Dog Lovers", una novela en
  // finlandés y un misterio del Padre Brown etiquetados como negocios, mientras
  // faltaban los que sí importaban. Antes de sumar un ID nuevo acá, comprobalo:
  //   curl -sL https://www.gutenberg.org/ebooks/<id>.rdf | grep dcterms:title

  // 🏆 Desarrollo personal y riqueza
  { id: 59844, note: "The Science of Getting Rich · Wallace D. Wattles (1910)" },
  { id: 4507, note: "As a Man Thinketh · James Allen (1903)" },
  { id: 368, note: "Acres of Diamonds · Russell H. Conwell" },
  { id: 8581, note: "The Art of Money Getting · P. T. Barnum" },
  { id: 935, note: "Self Help · Samuel Smiles (1859)" },
  { id: 2274, note: "How to Live on 24 Hours a Day · Arnold Bennett" },
  { id: 21291, note: "Pushing to the Front · Orison Swett Marden" },

  // 🏭 Empresarios y economía clásica
  { id: 43855, note: "Franklin's Way to Wealth · Benjamin Franklin" },
  { id: 148, note: "The Autobiography of Benjamin Franklin", recomendadoPor: ["Charlie Munger"] },
  { id: 17976, note: "Autobiography of Andrew Carnegie" },
  { id: 7213, note: "My Life and Work · Henry Ford" },
  { id: 3300, note: "The Wealth of Nations · Adam Smith", recomendadoPor: ["Warren Buffett"] },
  { id: 30107, note: "Principles of Political Economy · J. S. Mill" },
  { id: 46423, note: "A Contribution to the Critique of Political Economy · Marx" },
  { id: 1232, note: "The Prince · Machiavelli" },

  // 📚 Recomendados por figuras públicas — dominio público, van con libro COMPLETO.
  // Los que ya estaban en el catálogo (Moby Dick, Jane Eyre, Meditaciones,
  // Douglass, Incidents in the Life of a Slave Girl) solo suman la categoría.
  {
    id: 147,
    note: "Common Sense · Thomas Paine (1776)",
    categorias: ["Historia", "Recomendados por los grandes"],
    recomendadoPor: ["Lin-Manuel Miranda"],
  },
  {
    id: 1938,
    note: "Resurrection · Leo Tolstoy (1899)",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Bono"],
  },
  {
    id: 14975,
    note: "Southern Horrors: Lynch Law in All Its Phases · Ida B. Wells (1892)",
    categorias: ["Historia", "Recomendados por los grandes"],
    // Sin atribución: la lista de GQ no aclara si los eligió Kaepernick o la
    // redacción. El texto vale por sí mismo, así que entra sin colgarle un nombre.
  },
  {
    id: 2701,
    note: "Moby Dick · Herman Melville",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Lin-Manuel Miranda"],
  },
  {
    id: 1260,
    note: "Jane Eyre · Charlotte Brontë",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Lin-Manuel Miranda"],
  },
  {
    id: 2680,
    note: "Meditations · Marco Aurelio",
    categorias: ["Desarrollo personal", "Recomendados por los grandes"],
    recomendadoPor: ["Naval Ravikant", "Arnold Schwarzenegger"],
  },
];
