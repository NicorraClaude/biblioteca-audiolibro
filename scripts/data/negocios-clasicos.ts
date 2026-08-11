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
  // 🏆 Los grandes del "personal development" y riqueza
  { id: 25763, note: "Think and Grow Rich · Napoleon Hill (1937)" },
  { id: 25473, note: "The Science of Getting Rich · Wallace D. Wattles (1910)" },
  { id: 4507, note: "As a Man Thinketh · James Allen (1903)" },
  { id: 21291, note: "Acres of Diamonds · Russell H. Conwell" },
  { id: 8581, note: "The Art of Money Getting · P. T. Barnum" },
  { id: 935, note: "Self-Help · Samuel Smiles (1859)" },
  { id: 25275, note: "How to Live on 24 Hours a Day · Arnold Bennett" },
  { id: 5052, note: "The Master Key System · Charles F. Haanel" },
  { id: 44839, note: "The Way to Wealth · Benjamin Franklin" },
  { id: 148, note: "Autobiography of Benjamin Franklin" },
  { id: 43004, note: "The Life and Work of Andrew Carnegie" },
  { id: 17976, note: "My Life and Work · Henry Ford" },
  { id: 3300, note: "The Wealth of Nations · Adam Smith" },
  { id: 30107, note: "Principles of Political Economy · J. S. Mill" },
  { id: 32449, note: "How to Get On in the World · Sam Small" },
  { id: 20260, note: "Pushing to the Front · Orison Swett Marden" },
  { id: 21522, note: "The Optimist's Good Morning · Florence Hobart Perin" },
  { id: 12345, note: "The Prince · Machiavelli" },
  { id: 3300, note: "An Inquiry into the Nature and Causes of the Wealth of Nations" },
  { id: 46423, note: "The Efficient Life · Luther H. Gulick" },
  // en español
  { id: 12220, note: "Cartas a un joven español que se dedica a la carrera diplomática (curado)" },
];
