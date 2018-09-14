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

const getGameRemote = () => {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.onload = () => {
      if (request.status >= 200 && request.status < 400) {
        resolve(JSON.parse(request.responseText))
      } else {
        reject(request)
      }
    }
    request.onerror = () => { reject(request) }
    request.open('GET', `${location.pathname}.json`, true)
    request.send()
  })
}

const saveGame = () => {
  if (typeof getGameLocal === 'function') {
    return new Promise((resolve) => { resolve() })
  }

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.onload = () => {
      if (request.status >= 200 && request.status < 400) {
        resolve(JSON.parse(request.responseText))
      } else {
        reject(request)
      }
    }
    request.onerror = () => { reject(request) }
    request.open('PUT', `${location.pathname}.json`, true)
    request.setRequestHeader('Content-Type', 'application/json; charset=UTF-8')
    request.send(JSON.stringify(game))
  })
}

const drawTile = (tile) => {
  const { units, occupant, base } = tile
  const { color, drawX, drawY } = local[getKey(tile)]

  ctx.beginPath()
  ctx.arc(drawX, drawY, d * .7, 0, 2 * Math.PI)

  ctx.fillStyle = color
  ctx.fill()

  if (typeof occupant === 'number') {
    const player = game.players[occupant]
    const [r, g, b] = player.color
    const a = base ? '1' : '0.5'
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`
    ctx.fill()
  }

  if (units) {
    ctx.fillStyle = '#000'
    ctx.font = `${Math.round(canvas.width / 30)}px Helvetica Neue`
    const metrics = ctx.measureText(units)
    ctx.fillText(units, drawX - (metrics.width / 2), drawY + Math.round(canvas.width / 86))
  }

  if (game.sourceTile === getKey(tile)) {
    ctx.lineWidth = Math.round(canvas.width / 250)
    ctx.strokeStyle = '#fff'
    ctx.stroke()
  }
}

const getNeighbors = (tile) =>
  local[getKey(tile)]
    .neighbors
    .map(n => game.tiles[local[n].index])

const getLocal = (tiles) => {
  const tilesByCoord = {}
  const drawCoords = {}
  const neighbors = {}

  tiles.forEach((tile, index) => {
    const key = getKey(tile)
    const { x, y } = tile

    let drawX = x * fooX * 2
    let drawY = y * (d + fooY)

    if (y % 2 === 0) {
      drawX -= fooX
    }

    drawX += fooX * 2 + 7
    drawY += d + 14

    drawCoords[key] = { drawX, drawY }
    tilesByCoord[key] = index
  })

  tiles.forEach((tile) => {
    neighbors[getKey(tile)] =
      getNeighborCoords(tile.x, tile.y)
        .map(([x, y]) => `${x},${y}`)
        .filter((key) => tilesByCoord.hasOwnProperty(key))
  })

  return tiles.reduce((acc, tile) => {
    const key = getKey(tile)
    const index = tilesByCoord[key]
    const { drawX, drawY } = drawCoords[key]
    const colorVariant = Math.round(Math.random() * 30 + 190)

    acc[key] = {
      color: `rgb(${colorVariant}, ${colorVariant}, ${colorVariant})`,
      drawX,
      drawY,
      neighbors: neighbors[key],
      index
    }

    return acc
  }, {})
}

const drawStatus = () => {
  const newStatus = JSON.stringify([status, buttonLabel])
  const lastStatus = statusEl.dataset.lastStatus

  if (lastStatus === newStatus) {
    return
  }

  statusEl.dataset.lastStatus = newStatus

  const [r, g, b] = getCurrentPlayer(game).color
  statusEl.style.backgroundColor = `rgb(${r}, ${g}, ${b})`

  let newHTML = status

  if (buttonLabel) {
    newHTML += ` <button id="status-action">${buttonLabel}</button>`
  }

  statusEl.innerHTML = newHTML

  if (buttonLabel) {
    statusEl
      .querySelector('#status-action')
      .addEventListener('click', () => { onAction({ type: 'click' }) })
  }
}

const setStatus = () => {
  const alive = game.players.filter(p => !p.lost)
  buttonLabel = null

  if (alive.length === 1) {
    status = `${alive[0].name} won!`
    return
  }

  const player = getCurrentPlayer(game)

  if (!getBase(player.index)) {
    status = `${player.name}, choose your base.`
    return
  }

  if (!game.sourceTile) {
    buttonLabel = 'Pass'
    status = `${player.name}, choose your source tile or pass.`
    return
  }

  const sourceTile = getSourceTile()

  const count = local[getKey(sourceTile)].initialUnits
  let units = `up to ${count} units`

  if (count === 1) {
    units = `1 unit`
  }

  buttonLabel = 'End'
  status = `${player.name}, place ${units} and end your turn.`
}

const tick = () => {
  setStatus()
  draw()
  window.requestAnimationFrame(tick)
}

const draw = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const later = []

  game.tiles.forEach((tile) => {
    if (game.sourceTile === getKey(tile)) {
      later.push(tile)
      return
    }

    drawTile(tile)
  })

  later.forEach((tile) => {
    drawTile(tile)
  })

  drawStatus()
}

const getTileAt = (ix, iy) => {
  for (tile of game.tiles) {
    const { drawX, drawY } = local[getKey(tile)]
    const dx = Math.abs(ix - drawX)
    const dy = Math.abs(iy - drawY)

    if (Math.sqrt(dx * dx + dy * dy) <= d) {
      return tile
    }
  }

  return null
}

const getBase = (playerIndex) =>
  game.tiles.filter(t => t.occupant === playerIndex && t.base)[0]

const getBaseBonus = (playerIndex) => {
  const player = game.players[playerIndex]

  // find every occupied tile in contiguous territory from base
  const seen = [getBase(player.index)]

  let lastSeen = 1

  while (true) {
    seen.forEach((tile) => {
      getNeighbors(tile).forEach((neighbor) => {
        if (seen.indexOf(neighbor) === -1 && neighbor.occupant === player.index) {
          seen.push(neighbor)
        }
      })
    })

    if (seen.length === lastSeen) {
      break;
    }

    lastSeen = seen.length
  }

  const paths = seen.map((tile) =>
    getDistanceOnTerritory(getBase(player.index), tile, player.index)
  )

  // return longest distance
  return Math.max.apply(this, paths)
}

const getCurrentPlayer = (game) =>
  game.players[game.turn % game.players.length]

const endTurn = () => {
  game.turn++

  const player = getCurrentPlayer(game)
  const base = getBase(player.index)

  if (base && game.turn > game.players.length * 2 - 1) {
    base.units = base.units || 0
    base.units += getBaseBonus(player.index)
  }

  saveGame().then(() => {
    turnInProgress = false
  })
}

const getKey = (tile) => `${tile.x},${tile.y}`

const getDistanceOnTerritory = (fromTile, toTile, playerIndex) => {
  const openSet = []
  const closedSet = []
  const links = {}

  links[getKey(fromTile)] = null
  openSet.push(fromTile)

  while (openSet.length) {
    const current = openSet.shift()

    if (toTile === current) {
      const actionList = []

      let state = current
      let count = 0

      while (state) {
        count++
        state = links[getKey(state)]
      }

      return count
    }

    getNeighbors(current)
      .filter(t => t.occupant === playerIndex || t === toTile)
      .filter(t => closedSet.indexOf(t) === -1)
      .forEach((neighbor) => {
        if (openSet.indexOf(neighbor) === -1) {
          links[getKey(neighbor)] = current
          openSet.push(neighbor)
        }

        closedSet.push(current)
      })
  }

  return -1
}

const getSourceTile = () => game.tiles[local[game.sourceTile].index]

const onAction = (action) => {
  const { type, player, tile } = action

  turnInProgress = true

  if (type === 'click') {
    game.sourceTile = null
    endTurn()
    return
  }

  if (type === 'set-base') {
    if (typeof tile.occupant !== 'number') {
      tile.occupant = player.index
      tile.base = true
      tile.units = 5
      endTurn()
    }

    return
  }

  if (type === 'set-source') {
    if (tile.occupant === player.index) {
      const key = getKey(tile)
      local[key].initialUnits = tile.units
      game.sourceTile = key
    }

    return
  }

  const sourceTile = getSourceTile()

  if (getDistanceOnTerritory(sourceTile, tile, player.index) === -1) {
    return
  }

  if (typeof tile.occupant === 'number' && tile.occupant !== player.index) {
    if ((sourceTile.units || 0) > (tile.units || 0)) {
      tile.units = tile.units || 0
      tile.units++
      const oldOccupant = tile.occupant
      tile.occupant = player.index
      sourceTile.units = sourceTile.units || 0
      sourceTile.units -= tile.units
      if (!sourceTile.units) {
        delete sourceTile.units
      }

      if (!sourceTile.units && !sourceTile.base) {
        sourceTile.occupant = null
      }

      if (tile.base) {
        tile.base = false
        game.players[oldOccupant].lost = true
        game.finished = game.players.filter(p => !p.lost).length === 1
      }
    }

    return
  }

  if (sourceTile.units) {
    sourceTile.units--
    if (!sourceTile.units) {
      delete sourceTile.units
    }
    tile.units = tile.units || 0
    tile.units++
    tile.occupant = player.index

    if (!sourceTile.units && !sourceTile.base) {
      sourceTile.occupant = null
    }

    return
  }
}

const onClick = (e) => {
  if (game.finished) {
    return
  }

  const offsetX = Math.round((e.offsetX / canvas.clientWidth) * canvas.width)
  const offsetY = Math.round((e.offsetY / canvas.clientHeight) * canvas.height)

  const tile = getTileAt(offsetX, offsetY)

  if (!tile) {
    return
  }

  const player = getCurrentPlayer(game)

  let type = 'click-tile'

  if (!getBase(player.index)) {
    type = 'set-base'
  } else if (!game.sourceTile) {
    type = 'set-source'
  }

  onAction({ type, player, tile })
}

const canvas = document.querySelector('canvas')
const statusEl = document.querySelector('#status')
const ctx = canvas.getContext('2d')

let status = null
let buttonLabel = null
let game = null
let d = null
let fooX = null
let fooY = null
let local = null
let turnInProgress = false

const refreshGame = () => {
  if (!turnInProgress) {
    getGame().then((gameResponse) => {
      if (!turnInProgress) {
        game = gameResponse
      }
    })
  }
}

canvas.addEventListener('click', onClick)

getGame().then((gameResponse) => {
  game = gameResponse

  d = canvas.width / game.width / 1.95
  fooX = Math.sqrt(Math.pow(d, 2) - Math.pow(d / 2, 2))
  fooY = Math.sqrt(Math.pow(d, 2) - Math.pow(fooX, 2))
  local = getLocal(game.tiles)

  setInterval(refreshGame, 1000)

  tick()
})

