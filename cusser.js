const cusses = {
  x: ['ass','bag','shit','head','hat','tard','fuck','lord','wit','face','wad','sucker','boy','stain','stick','nozzle','clown','waffle','nugget','goblin'],
  y: ['dumb','scum','douche','shit','dick','fuck','dip','ass','dog','lib','butt','cock','dirt','bum','trump','twat','cum','piss','wank','poop'],
};

const templates = [
  'eat my ass, {}',
  'fuck you, {}',
  'suck my piss, {}',
  'kiss my piss, {}',
  'eat shit, {}',
  'eat a dick, {}',
  'go fuck yourself, {}',
  'blow me, {}',
  'get bent, {}',
  'kill yourself, {}',
  'sit on it, {}',
  'eat a bag of dicks, {}',
  'suck my ass, {}',
  'lick my nuts, {}',
  'get fucked, {}',
  'your mom\'s a {}',
  'sit on it and spin, {}',
  'eat my shorts, {}',
  'ingest rat poison, {}',
  'take a hike, {}',
  'shove it, {}',
  'put that in your pipe and smoke it, {}',
  'take a long walk off a short pier, {}',
  'log off, {}',
  'i porked your mom, {}',
  'i\'m gonna kick your ass, {}',
  'try this on for size, {}',
  'you fuckin suck, {}',
  'you\'re a pathetic, unloveable {}',
  'go to hell, {}',
  'die in agony, {}',
  'you\'re a fucking joke, {}',
  'nobody likes you, {}',
  'you dumb, ugly {}',
  'rot in hell, {}',
];

function getRandom(max = 20) {
  return Math.floor(Math.random() * max);
}

function randomCuss() {
  const { x, y } = cusses;
  const r1 = getRandom();
  const r2 = getRandom();
  return `${y[r1]}${x[r2]}`;
}

function randomInsult() {
  const insult = templates[getRandom(templates.length)];
  return insult.replace('{}', randomCuss());
}

module.exports = randomInsult;
