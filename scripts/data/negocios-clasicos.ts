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


  // ── BARRIDO DE RECOMENDADOS POR FAMOSOS (dominio público) ──────────────────
  // Investigado con fuentes rastreables. Los que no pudieron confirmarse van sin
  // atribución: el libro vale igual, el nombre colgado sin fuente no.
  // TODOS los IDs verificados contra el RDF de Gutenberg antes de commitear.
  {
    id: 1540,
    note: "The Tempest · Shakespeare",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Barack Obama", "Reid Hoffman"],
  },
  {
    id: 1400,
    note: "Great Expectations · Dickens",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Oprah Winfrey", "Richard Branson"],
  },
  {
    id: 120,
    note: "Treasure Island · R. L. Stevenson",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Barack Obama", "Richard Branson"],
  },
  {
    id: 45438,
    note: "La isla del tesoro (español) · Stevenson",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Barack Obama", "Richard Branson"],
  },
  {
    id: 64317,
    note: "The Great Gatsby · Fitzgerald",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Barack Obama", "Haruki Murakami"],
  },
  {
    id: 84,
    note: "Frankenstein · Mary Shelley",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Stephen King", "Marc Andreessen"],
  },
  {
    id: 3600,
    note: "Essays of Michel de Montaigne (Essais)",
    categorias: ["Filosofía", "Recomendados por los grandes"],
    recomendadoPor: ["Alain de Botton", "Patrick Collison"],
  },
  {
    id: 1497,
    note: "The Republic · Platón",
    categorias: ["Filosofía", "Recomendados por los grandes"],
    recomendadoPor: ["Maria Popova", "Patrick Collison"],
  },
  {
    id: 2554,
    note: "Crime and Punishment · Dostoievski",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Jordan Peterson"],
  },
  {
    id: 61851,
    note: "El crimen y el castigo (español) · Dostoievski",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Jordan Peterson"],
  },
  {
    id: 8117,
    note: "The Possessed / Demons · Dostoievski",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Jordan Peterson"],
  },
  {
    id: 600,
    note: "Notes from Underground · Dostoievski",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Jordan Peterson"],
  },
  {
    id: 4363,
    note: "Beyond Good and Evil · Nietzsche",
    categorias: ["Filosofía", "Recomendados por los grandes"],
    recomendadoPor: ["Jordan Peterson"],
  },
  {
    id: 28054,
    note: "The Brothers Karamazov · Dostoievski",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Haruki Murakami"],
  },
  {
    id: 77334,
    note: "El proceso (español) · Kafka",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Haruki Murakami"],
  },
  {
    id: 2600,
    note: "War and Peace · Tolstói",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Stephen King"],
  },
  {
    id: 1399,
    note: "Anna Karenina · Tolstói",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Oprah Winfrey"],
  },
  {
    id: 98,
    note: "A Tale of Two Cities · Dickens",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Oprah Winfrey"],
  },
  {
    id: 61887,
    note: "Historia de dos ciudades (español) · Dickens",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Oprah Winfrey"],
  },
  {
    id: 75170,
    note: "The Sound and the Fury · Faulkner",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Oprah Winfrey"],
  },
  {
    id: 132,
    note: "The Art of War · Sun Tzu",
    categorias: ["Negocios y emprendimientos", "Recomendados por los grandes"],
    recomendadoPor: ["Kobe Bryant"],
  },
  {
    id: 205,
    note: "Walden · Thoreau",
    categorias: ["Desarrollo personal", "Recomendados por los grandes"],
    recomendadoPor: ["Natalie Portman"],
  },
  {
    id: 2944,
    note: "Essays — First Series (Self-Reliance) · Emerson",
    categorias: ["Desarrollo personal", "Recomendados por los grandes"],
    recomendadoPor: ["Barack Obama"],
  },
  {
    id: 1524,
    note: "Hamlet · Shakespeare",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Barack Obama"],
  },
  {
    id: 56454,
    note: "Hamlet (español) · Shakespeare",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Barack Obama"],
  },
  {
    id: 1653,
    note: "The Imitation of Christ · Tomás de Kempis",
    categorias: ["Desarrollo personal", "Recomendados por los grandes"],
    recomendadoPor: ["Bill Clinton"],
  },
  {
    id: 219,
    note: "Heart of Darkness · Conrad",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Stephen King"],
  },
  {
    id: 345,
    note: "Dracula · Bram Stoker",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Stephen King"],
  },
  {
    id: 43,
    note: "The Strange Case of Dr. Jekyll and Mr. Hyde · Stevenson",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Stephen King"],
  },
  {
    id: 62627,
    note: "El caso extraño del Doctor Jekyll (español) · Stevenson",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Stephen King"],
  },
  {
    id: 730,
    note: "Oliver Twist · Dickens",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Stephen King"],
  },
  {
    id: 1695,
    note: "The Man Who Was Thursday · Chesterton",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Neil Gaiman"],
  },
  {
    id: 68061,
    note: "Lud-in-the-Mist · Hope Mirrlees",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Neil Gaiman"],
  },
  {
    id: 1023,
    note: "Bleak House · Dickens",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Neil Gaiman"],
  },
  {
    id: 68283,
    note: "The Call of Cthulhu · Lovecraft",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Neil Gaiman"],
  },
  {
    id: 216,
    note: "The Tao Teh King (Tao Te Ching) · Lao Tsé",
    categorias: ["Filosofía", "Recomendados por los grandes"],
    recomendadoPor: ["Rick Rubin", "Josh Waitzkin"],
  },
  {
    id: 17195,
    note: "A Message to Garcia · Elbert Hubbard",
    categorias: ["Negocios y emprendimientos", "Recomendados por los grandes"],
    recomendadoPor: ["Joe De Sena"],
  },
  {
    id: 2500,
    note: "Siddhartha · Hermann Hesse",
    categorias: ["Clásicos", "Recomendados por los grandes"],
  },
  {
    id: 201,
    note: "Flatland · Edwin A. Abbott",
    categorias: ["Ciencia", "Recomendados por los grandes"],
    recomendadoPor: ["Carl Sagan"],
  },
  {
    id: 62,
    note: "A Princess of Mars · Burroughs",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Carl Sagan"],
  },
  {
    id: 815,
    note: "Democracy in America vol. 1 · Tocqueville",
    categorias: ["Historia", "Recomendados por los grandes"],
    recomendadoPor: ["Patrick Collison"],
  },
  {
    id: 1184,
    note: "The Count of Monte Cristo · Dumas",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Patrick Collison"],
  },
  {
    id: 20,
    note: "Paradise Lost · Milton",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Patrick Collison"],
  },
  {
    id: 67092,
    note: "El paraíso perdido (español) · Milton",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Patrick Collison"],
  },
  {
    id: 1727,
    note: "The Odyssey · Homero",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Patrick Collison"],
  },
  {
    id: 3296,
    note: "Confessions · San Agustín",
    categorias: ["Filosofía", "Recomendados por los grandes"],
    recomendadoPor: ["Patrick Collison"],
  },
  {
    id: 9662,
    note: "An Enquiry Concerning Human Understanding · Hume",
    categorias: ["Filosofía", "Recomendados por los grandes"],
    recomendadoPor: ["Patrick Collison"],
  },
  {
    id: 228,
    note: "The Aeneid · Virgilio",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Patrick Collison"],
  },
  {
    id: 1170,
    note: "Anabasis · Jenofonte",
    categorias: ["Historia", "Recomendados por los grandes"],
    recomendadoPor: ["Patrick Collison"],
  },
  {
    id: 2434,
    note: "New Atlantis · Francis Bacon",
    categorias: ["Filosofía", "Recomendados por los grandes"],
    recomendadoPor: ["Patrick Collison"],
  },
  {
    id: 58881,
    note: "A Philosophical Essay on Probabilities · Laplace",
    categorias: ["Ciencia", "Recomendados por los grandes"],
    recomendadoPor: ["Patrick Collison"],
  },
  {
    id: 6317,
    note: "Sailing Alone Around the World · Slocum",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Paul Graham"],
  },
  {
    id: 37134,
    note: "The Elements of Style (ed. 1918) · Strunk",
    categorias: ["Desarrollo personal", "Recomendados por los grandes"],
    recomendadoPor: ["Tobi Lütke"],
  },
  {
    id: 164,
    note: "Twenty Thousand Leagues Under the Sea · Verne",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Richard Branson"],
  },
  {
    id: 236,
    note: "The Jungle Book · Kipling",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Richard Branson"],
  },
  {
    id: 69552,
    note: "El libro de las tierras vírgenes (español) · Kipling",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Richard Branson"],
  },
  {
    id: 16,
    note: "Peter Pan · J. M. Barrie",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Richard Branson"],
  },
  {
    id: 76,
    note: "Adventures of Huckleberry Finn · Mark Twain",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Richard Branson"],
  },
  {
    id: 73328,
    note: "The Outermost House · Henry Beston",
    categorias: ["Clásicos", "Recomendados por los grandes"],
    recomendadoPor: ["Richard Branson"],
  },
];
