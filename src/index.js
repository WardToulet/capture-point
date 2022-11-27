const path = require('path');
const fs = require('fs');

const fastify = require('fastify')();
const fastifyView = require('@fastify/view');
const FastfiyStatic = require('@fastify/static');
const FastfiyFormBody = require('@fastify/formbody');
const ejs = require('ejs');

class PointManager {
  points;

  constructor() {
    this.points = JSON.parse(fs.readFileSync('./data.json'));
  }

  createPoint(point) {
    this.points.push(point);
    fs.writeFileSync('./data.json', JSON.stringify(this.points));
  }

  getAllPoints() {
    return this.points;
  }

  getPoint(uuid) {
    return this.points?.find(p => p.uuid === uuid);
  }
}

const pointManager = new PointManager();

class Game {
  _points
  _progress
  _state
  _lastCapture
  _timeout = 1000 * 60 * 10;

  constructor(count) {
    // Get random points
    console.log(count);
    this._points = pointManager.getAllPoints().sort(() => Math.random()-0.5).slice(0, count);
    this._state = 'idle';
    this.start();

    console.log(this._points);
  }

  start() {
    this._state = 'playing';
    this._progress = 0;
    this._lastCapture = Date.now();
  }

  tryCapture(uuid) {
    if (this._points[this._progress].uuid === uuid) {
      this._progress++;
      this._lastCapture = Date.now();
      if (this._progress == this._points.length) {
        this._state = 'victory';
        return 'victory';
      } else {
        return 'captured';
      }
    } else {
      return 'invalid';
    }
  }

  tick() {
    if (Date.now() - this._lastCapture >= this._timeout) {
      this._state = 'game-over';
    }
  }

  get state() {
    return this._state;
  }

  get nextPoint() {
    return this._points[this._progress];
  }
}

class GameManager {
  _game;

  constructor() {
    setInterval(() => {
      this._game?.tick();
      console.log(this._game?.state || 'no-game')
    }, 1000)
  }

  create(count) {
    this._game = new Game(count);
  }

  get state() {
    return this._game?.state || 'no-game';
  }
}

const gameManager = new GameManager();

/**
 * Serve the main page
 **/
fastify.get('/', async (req, res) => res.view('index'));
fastify.get('/dash', async (req, res) => res.view('dash'));
fastify.get('/map', async (req, res) => res.view('map'));

fastify.post('/game/start', async (req, res) => {
    gameManager.create(req.body.count);
});

fastify.get('/capture/:uuid', async (req, res) => {
  const uuid = req.params.uuid;
  const point = pointManager.getPoint(req.params.uuid);

  if (!point) {
    return res.view('register', { uuid: req.params.uuid });
  }

  const state = gameManager.state;
  console.log('state', state)

  if (state === 'no-game') {
    return res.view('no-game');
  }

  if (state === 'idle') {
    return res.view('idle');
  }

  if (state === 'game-over') {
    return res.view('game-over');
  }

  if (state === 'victory') {
    return res.view('victory');
  }

  if (state === 'playing') {
    console.log(gameManager._game);
    const result = gameManager._game?.tryCapture(point.uuid);
    console.log('result', result);

    if (result === 'invalid') {
      return res.view('capture-invalid', point);
    }

    if (result === 'captured') {
      return res.view('capture-success', gameManager._game?.nextPoint);
    }

    if (result === 'victory') {
      return res.view('victory');
    }
  }
});

fastify.post('/point/*', async (req, res) => {
  pointManager.createPoint(req.body);
  return res.view('register-success', req.body);
});

fastify.get('/api/point', async (req, res) => pointManager.getAllPoints());

fastify.register(FastfiyFormBody);
fastify.register(FastfiyStatic, {
  root: path.join(__dirname, 'static')
});
fastify.register(fastifyView, {
  root: path.join(__dirname, 'views'),
  engine: { ejs },
})

const start = async () => {
  try {
    fastify.listen({ port: 8080 });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
