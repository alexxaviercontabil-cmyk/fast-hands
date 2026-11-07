// =====================================================================
//  Catálogo da loja (usado pelo servidor E pelo navegador)
//  Pra mudar preço ou criar item novo, é só mexer aqui.
//  cat: base (boneco), hat (chapéu), glasses (óculos), extra (acessório)
// =====================================================================
(function (root) {
  const CATALOG = [
    // ---- bonecos ----
    { id: 'human', cat: 'base', name: 'Humano', price: 0 },
    { id: 'robot', cat: 'base', name: 'Robô', price: 300 },
    { id: 'cat', cat: 'base', name: 'Gato', price: 350 },
    { id: 'bear', cat: 'base', name: 'Urso', price: 350 },
    { id: 'alien', cat: 'base', name: 'Alien', price: 400 },
    { id: 'zombie', cat: 'base', name: 'Zumbi', price: 450 },
    { id: 'ninja', cat: 'base', name: 'Ninja', price: 500 },
    { id: 'skeleton', cat: 'base', name: 'Caveira', price: 600 },
    // ---- chapéus ----
    { id: 'cap', cat: 'hat', name: 'Boné', price: 0 },
    { id: 'beanie', cat: 'hat', name: 'Gorro', price: 80 },
    { id: 'party', cat: 'hat', name: 'Chapéu de festa', price: 100 },
    { id: 'chef', cat: 'hat', name: 'Chapéu de chef', price: 150 },
    { id: 'headphones', cat: 'hat', name: 'Fone gamer', price: 150 },
    { id: 'cowboy', cat: 'hat', name: 'Chapéu de vaqueiro', price: 200 },
    { id: 'tophat', cat: 'hat', name: 'Cartola', price: 250 },
    { id: 'wizard', cat: 'hat', name: 'Chapéu de mago', price: 300 },
    { id: 'viking', cat: 'hat', name: 'Elmo viking', price: 350 },
    { id: 'halo', cat: 'hat', name: 'Auréola', price: 400 },
    { id: 'crown', cat: 'hat', name: 'Coroa', price: 500 },
    // ---- óculos ----
    { id: 'round', cat: 'glasses', name: 'Óculos redondo', price: 0 },
    { id: 'shades', cat: 'glasses', name: 'Óculos escuro', price: 60 },
    { id: 'heart', cat: 'glasses', name: 'Óculos de coração', price: 120 },
    { id: 'star', cat: 'glasses', name: 'Óculos de estrela', price: 150 },
    { id: 'visor', cat: 'glasses', name: 'Visor futurista', price: 180 },
    { id: 'monocle', cat: 'glasses', name: 'Monóculo', price: 200 },
    // ---- acessórios ----
    { id: 'mustache', cat: 'extra', name: 'Bigode', price: 80 },
    { id: 'flower', cat: 'extra', name: 'Florzinha', price: 90 },
    { id: 'bowtie', cat: 'extra', name: 'Gravata borboleta', price: 100 },
    { id: 'scarf', cat: 'extra', name: 'Cachecol', price: 120 },
    { id: 'beard', cat: 'extra', name: 'Barba', price: 150 },
    { id: 'cape', cat: 'extra', name: 'Capa de herói', price: 250 },
    { id: 'chain', cat: 'extra', name: 'Corrente de ouro', price: 300 }
  ];
  const FREE = CATALOG.filter(i => i.price === 0).map(i => i.id);
  // moedas ganhas
  const REWARDS = { play: 10, perCard: 1, maxCards: 20, win: 50, start: 150 };
  const api = { CATALOG, FREE, REWARDS, byId: Object.fromEntries(CATALOG.map(i => [i.id, i])) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FH_CATALOG = api;
})(this);
