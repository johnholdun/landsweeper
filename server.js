const express = require('express')
const bodyParser = require('body-parser')
const fs = require('fs')
const sqlite3 = require('sqlite3').verbose()

const dbFile = './.data/games.db'

const db = new sqlite3.Database(dbFile)

db.serialize(() => {
  if (!fs.existsSync(dbFile)) {
    db.run('CREATE TABLE games (key text, data json)')
  }
})

const getGameLocal = () => {
  const initGrid = (width, height) => {
    const tiles = []

    for (let y = 0; y < height; y++) {
      for (let x = 0; x <= width; x++) {
        tiles.push({ x, y, land: false })
      }
    }

    return tiles
  }

  const makeHex = (tiles) => {
    const width = 8

    const removals = [
      [2, 2],
      [1, 2],
      [1, 1],
      [0, 1],
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 2],
      [2, 2]
    ]

    return tiles.filter((tile) => {
      const { x, y } = tile
      const [left, right] = removals[y]
      return x >= left && width - x >= right
    })
  }

  const createLand = (tiles, totalLand) => {
    const lands = {}

    const addLand = () => {
      let landY = 0
      let landX = 0

      if (Object.keys(lands).length === 0) {
        landX = 4
        landY = 4
      } else {
        const keys = Object.keys(lands)
        const [x, y] = keys[Math.floor(keys.length * Math.random())].split(',').map(i => parseInt(i, 10))
        const neighbors = getNeighborCoords(x, y)
        const [foo, bar] = neighbors[Math.floor(neighbors.length * Math.random())]
        landX = foo
        landY = bar
      }

      const landTile = tiles.filter(({ x, y }) => landX === x && landY === y)[0]

      if (landTile && !landTile.land) {
        landTile.land = true
        lands[[landX, landY]] = true
      }
    }

    while (Object.keys(lands).length < totalLand) {
      addLand()
    }

    const landTiles = tiles.filter(t => t.land)

    landTiles.forEach(t => { delete t.land })

    return landTiles
  }

  const width = 8
  const height = 9

  const game = {
    width,
    height,
    // tiles: createLand(initGrid(width, height), Math.round(Math.random() * 20 + 40)),
    tiles: makeHex(initGrid(width, height)),
    players: [
      {
        index: 0,
        name: 'Red',
        color: [245, 49, 35],
        lost: false
      },
      {
        index: 1,
        name: 'Blue',
        color: [56, 79, 231],
        lost: false
      }
    ],
    turn: 0,
    sourceTile: null,
    finished: false,
  }

  return new Promise((resolve) => { resolve(game) })
}


// TODO: this is used server-side and client-side
const getNeighborCoords = (x, y) => {
  return [
    [y % 2 == 0 ? x - 1 : x, y - 1],
    [y % 2 == 0 ? x : x + 1, y - 1],
    [x - 1, y],
    [x + 1, y],
    [y % 2 == 0 ? x - 1 : x, y + 1],
    [y % 2 == 0 ? x : x + 1, y + 1]
  ]
}

// TODO: this is used server-side and client-side
const getGame = () => {
  if (typeof getGameLocal === 'function') {
    if (typeof game !== 'undefined' && game) {
      return new Promise((resolve) => { return game })
    }

    return getGameLocal()
  } else {
    return getGameRemote()
  }
}

const app = express()

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json({ strict: true }))
app.use(express.static('public'))

app.get('/', (request, response) => {
  response.sendFile(`${__dirname}/views/index.html`)
})

app.get('/how-to-play', (request, response) => {
  response.sendFile(`${__dirname}/views/how-to-play.html`)
})

app.get('/games/new', (request, response) => {
  const max = parseInt('ffff', 16)
  const min = parseInt('1000', 16)
  const slug = Math.round(Math.random() * (max - min) + min).toString(16)

  try {
    db.serialize(() => {
      getGame().then((game) => {
        db.run(
          `INSERT INTO games (key, data) VALUES (?, ?)`,
          [slug, JSON.stringify(game)],
          (err) => {
            if (err) {
              response.json({ errors: [err] })
              return
            }
          }
        )
      })
    })

    response.redirect(`/games/${slug}`)
  } catch (e) {
    response.json({ errors: [e.message] })
  }
})

app.get('/games/:slug.json', (request, response) => {
  const { slug } = request.params

  db.all('SELECT data FROM games WHERE key = ?', slug, (err, rows) => {
    if (!rows.length) {
      response.json({ errors: [`no game with slug ${slug}`]})
      return
    }

    response.json(JSON.parse(rows[0].data))
  })
})

app.put('/games/:slug.json', (request, response) => {
  const { slug } = request.params

  const game = request.body

  // TODO: validate game

  db.all('UPDATE games SET data = ? WHERE key = ?', [JSON.stringify(game), slug], (err) => {
    if (err) {
      response.json({ errors: [err]})
      return
    }

    response.json({ saved: true })
  })
})

app.get('/games/:slug', (request, response) => {
  response.sendFile(`${__dirname}/views/game.html`)
})

const listener = app.listen(process.env.PORT, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})

