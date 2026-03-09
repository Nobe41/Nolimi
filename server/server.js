// server/server.js — API backend optionnelle (Node/Express).
// Pour plus tard : sauvegarde projets, export STL/PDF côté serveur.
'use strict';

const http = require('http');
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Nolimi API — prêt pour extensions.\n');
});

server.listen(PORT, () => {
  console.log('Nolimi server écoute sur le port', PORT);
});
